import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Alert, NativeModules } from "react-native";
//노윤석 추가코드
import {
    arrayUnion,
    doc,
    getDoc,
    increment,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../../firebaseConfig";
//노윤석 끝
// ⭐️ [추가] Notification 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 네이티브 모듈 및 상수 정의
const { BlockedApps } = NativeModules;
const LOCATION_TASK_NAME = "background-location-task";
const LOCK_STATE_KEY = "currentLockState";
const MIN_ACCURACY_THRESHOLD = 50;

// [수정] 1. 사용하는 모든 키 정의
const PERSONAL_PLACES_KEY = "personalFocusPlaces";
const GROUP_PLACES_KEY = "groupfocusPlaces";
const GROUP_SYNC_STATUS_KEY = "groupSyncStatus";

// 🚨 'locationSyncService'가 이미 카테고리 번역을 완료했으므로,
// 🚨 이 파일(locationService)은 CATEGORIZED_APPS_KEY가 *필요 없습니다.*

// =========================
// [STATS] 통계 유틸 (기존과 동일)
// =========================
const STATS_CUR_KEY = (userId: string) => `currentSessions:${userId}`;
const STATS_DAY_KEY = (u: string, p: string, ymd: string) =>
    `stats:${u}:${p}:${ymd}`;
type CurrentSession = { placeId: string; startedAt: number };
type FinishedSession = {
    id: string;
    placeId: string;
    startedAt: number;
    endedAt: number;
    durationMs: number;
};

//노윤석 추가코드
/** 현재 placeId가 "그룹장소"인지 AsyncStorage 캐시로 판별 */
const isGroupPlace = async (placeId: string) => {
    try {
        const raw = await AsyncStorage.getItem(GROUP_PLACES_KEY);
        if (!raw) return false;
        const arr: any[] = JSON.parse(raw);
        return Array.isArray(arr) && arr.some((p) => p?.id === placeId);
    } catch {
        return false;
    }
};

/** Firestore: days/{YYYY-MM-DD} 문서를 존재 보장(enter시), interval 추가/합계 누적(exit시) */
const upsertGroupDayDocOnEnter = async ({
    placeId,
    uid,
    startedAt,
}: {
    placeId: string;
    uid: string;
    startedAt: number;
}) => {
    const ymd = toYMD(new Date(startedAt));
    const dayRef = doc(
        db,
        "groupLocations",
        placeId,
        "memberStats",
        uid,
        "days",
        ymd
    );
    const snap = await getDoc(dayRef);
    if (!snap.exists()) {
        await setDoc(dayRef, {
            totalMs: 0,
            intervals: [],
            updatedAt: serverTimestamp(),
        });
    } else {
        await updateDoc(dayRef, { updatedAt: serverTimestamp() });
    }
};

const upsertGroupDayDocOnExit = async ({
    placeId,
    uid,
    startedAt,
    endedAt,
}: {
    placeId: string;
    uid: string;
    startedAt: number;
    endedAt: number;
}) => {
    const ymd = toYMD(new Date(startedAt));
    const dayRef = doc(
        db,
        "groupLocations",
        placeId,
        "memberStats",
        uid,
        "days",
        ymd
    );

    const durationMs = Math.max(0, endedAt - startedAt);

    // 트랜잭션: totalMs 누적 + intervals append + updatedAt 갱신
    await runTransaction(db, async (tx) => {
        const cur = await tx.get(dayRef);
        if (!cur.exists()) {
            tx.set(dayRef, {
                totalMs: durationMs,
                intervals: [{ startedAt, endedAt, durationMs }],
                updatedAt: serverTimestamp(),
            });
        } else {
            // arrayUnion을 쓰면 중복 방지에도 유리(동일 객체일 때)
            tx.update(dayRef, {
                totalMs: increment(durationMs),
                intervals: arrayUnion({ startedAt, endedAt, durationMs }),
                updatedAt: serverTimestamp(),
            });
        }
    });
};

const updateMemberStatus = async (
    placeId: string, // placeId가 이 컨텍스트에서는 groupId입니다.
    uid: string,
    status: "active" | "inactive"
) => {
    if (!uid || !placeId) {
        console.warn("[STATS] updateMemberStatus: uid 또는 placeId가 없습니다.");
        return;
    }

    try {
        // 1. [추가] 그룹장(ownerId)인지 확인하기 위해 부모 문서를 가져옵니다.
        const groupDocRef = doc(db, "groupLocations", placeId);
        const groupDocSnap = await getDoc(groupDocRef);

        if (!groupDocSnap.exists()) {
            console.warn(`[STATS] updateMemberStatus: 그룹 문서 ${placeId}를 찾을 수 없습니다.`);
            return;
        }

        const ownerId = groupDocSnap.data()?.ownerId;

        // 2. [추가] 현재 사용자가 그룹장이면, status 업데이트를 건너뜁니다.
        if (uid === ownerId) {
            console.log(`[STATS] 사용자가 그룹장(${uid})이므로 status 업데이트를 건너뜁니다.`);
            return; 
        }

        // 3. [기존 로직] 그룹장이 아닌 멤버만 status를 업데이트합니다.
        const memberRef = doc(db, "groupLocations", placeId, "members", uid);
        
        await setDoc(memberRef, {
            status: status,
        }, { merge: true });

        console.log(`[STATS] Member ${uid} status in ${placeId} updated to ${status}`);
    } catch (e) {
        console.error(`[STATS] Failed to update member status for ${uid} in ${placeId}`, e);
    }
};
//노윤석 끝
function toYMD(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export async function statsLogEnter({
    userId = "local",
    placeId,
    startedAt = Date.now(),
}: {
    userId?: string;
    placeId: string;
    startedAt?: number;
}) {
    try {
        const key = STATS_CUR_KEY(userId);
        const raw = await AsyncStorage.getItem(key);
        const cur: CurrentSession[] = raw ? JSON.parse(raw) : [];
        if (!cur.find((c) => c.placeId === placeId)) {
            cur.push({ placeId, startedAt });
            await AsyncStorage.setItem(key, JSON.stringify(cur));
        }
        //노윤석 추가코드
        // 그룹장소면 Firestore에도 '해당 일자 문서' 존재 보장(인터벌은 exit에서 추가)
        const authedUid = auth?.currentUser?.uid ?? userId;
        if (authedUid && authedUid !== "local" && (await isGroupPlace(placeId))) {
            await upsertGroupDayDocOnEnter({ placeId, uid: authedUid, startedAt });
            // 👇 [신규] 멤버 상태 "active"로 변경
            await updateMemberStatus(placeId, authedUid, "active");
        }
        //노윤석 끝
    } catch (e) {
        console.log("[STATS] logEnter error", e);
    }
}
export async function statsLogExit({
    userId = "local",
    placeId,
    endedAt = Date.now(),
}: {
    userId?: string;
    placeId: string;
    endedAt?: number;
}) {
    try {
        const curKey = STATS_CUR_KEY(userId);
        const raw = await AsyncStorage.getItem(curKey);
        const cur: CurrentSession[] = raw ? JSON.parse(raw) : [];
        const row = cur.find((c) => c.placeId === placeId);
        if (!row) return;

        const remain = cur.filter((c) => c.placeId !== placeId);
        await AsyncStorage.setItem(curKey, JSON.stringify(remain));

        const startedAt = row.startedAt;
        const durationMs = Math.max(0, endedAt - startedAt);
        const dayKey = STATS_DAY_KEY(userId, placeId, toYMD(new Date(startedAt)));
        const dayRaw = await AsyncStorage.getItem(dayKey);
        const day: FinishedSession[] = dayRaw ? JSON.parse(dayRaw) : [];
        day.push({
            id: `${startedAt}-${endedAt}`,
            placeId,
            startedAt,
            endedAt,
            durationMs,
        });
        await AsyncStorage.setItem(dayKey, JSON.stringify(day));

        //노윤석 추가코드
        // 그룹장소면 Firestore에도 동일 인터벌 추가 + totalMs 누적
        const authedUid = auth?.currentUser?.uid ?? userId;
        if (authedUid && authedUid !== "local" && (await isGroupPlace(placeId))) {
            await upsertGroupDayDocOnExit({
                placeId,
                uid: authedUid,
                startedAt,
                endedAt,
            });
            // 👇 [신규] 멤버 상태 "inactive"로 변경
            await updateMemberStatus(placeId, authedUid, "inactive");
        }
        //노윤석 끝
    } catch (e) {
        console.log("[STATS] logExit error", e);
    }
}
// =========================
// 데이터 타입 정의
// =========================
type Place = {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radius: number;
    isActive: boolean;
    blockedApps: string[]; // 👈 Sync 서비스가 번역한 최종 목록
};

// =========================
// 유틸 함수 (기존과 동일)
// =========================
const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

// ⭐️ [추가] 위치 업데이트 처리 로직 (백그라운드 태스크와 공유)
const processLocationUpdate = async (currentLocation: any) => {
    // 1. 정확도 필터링
    if (currentLocation?.coords?.accuracy > MIN_ACCURACY_THRESHOLD) {
        console.log(
            `Ignoring inaccurate location. Accuracy: ${currentLocation.coords.accuracy}m`
        );
        return;
    }

    try {
        // 2a. 동기화 상태 플래그 확인
        const groupSyncStatus = await AsyncStorage.getItem(GROUP_SYNC_STATUS_KEY);
        const isGroupDataSynced = groupSyncStatus === "SYNCED";

        // 2b. [핵심 수정] 개인 장소 로드 (안전하게 파싱)
        const personalPlacesRaw = await AsyncStorage.getItem(PERSONAL_PLACES_KEY);
        let personalPlaces: Place[] = [];
        if (personalPlacesRaw) {
            try {
                const parsed = JSON.parse(personalPlacesRaw);
                if (Array.isArray(parsed)) {
                    personalPlaces = parsed.filter((p) => p && p.id);
                }
            } catch (parseError) {
                console.error("Failed to parse PERSONAL_PLACES_KEY:", parseError);
            }
        }

        // 2c. [핵심 수정] 그룹 장소 로드 (안전하게 파싱)
        const groupPlacesRaw = await AsyncStorage.getItem(GROUP_PLACES_KEY);
        let groupPlaces: Place[] = [];

        if (isGroupDataSynced && groupPlacesRaw) {
            try {
                const parsedGroupPlaces: any[] | null = JSON.parse(groupPlacesRaw);
                if (Array.isArray(parsedGroupPlaces)) {
                    groupPlaces = parsedGroupPlaces.filter((p) => p && p.id);
                }
            } catch (parseError) {
                console.error("Failed to parse GROUP_PLACES_KEY:", parseError);
            }
        } else if (!isGroupDataSynced && groupPlacesRaw) {
            console.log(
                "[Location Task] 네트워크 오프라인. 저장된 그룹 장소를 무시합니다."
            );
        }

        // 2d. [완성] 정제/변환된 두 목록을 하나로 합침
        const places: Place[] = [...personalPlaces, ...groupPlaces];

        // 3. [핵심 수정] 장소가 없으면 잠금 해제 처리 (예외처리)
        if (places.length === 0) {
            const lastLockStateRaw = await AsyncStorage.getItem(LOCK_STATE_KEY);
            if (lastLockStateRaw) {
                const lastLockState: { state?: "LOCKED" | "UNLOCKED" } =
                    JSON.parse(lastLockStateRaw);
                if (lastLockState.state === "LOCKED") {
                    console.log("[Location Task] No active places found. Unlocking.");
                    await BlockedApps.setBlockedApps([]);

                    const inside = (lastLockState as any).insidePlaceIds || [];
                    for (const pid of inside) {
                        await statsLogExit({ userId: "local", placeId: pid });
                    }

                    await AsyncStorage.setItem(
                        LOCK_STATE_KEY,
                        JSON.stringify({ state: "UNLOCKED", apps: [], insidePlaceIds: [] })
                    );
                }
            }
            return;
        }

        // 4. 반경 계산 (정제된 데이터로 안전하게 실행)
        const activePlaces = places.filter((p) => p.isActive);

        let isInsideAnyZone = false;
        let combinedBlockedApps = new Set<string>();
        const insidePlaceIds: string[] = [];
        const insidePlaceNames: string[] = []; // ⭐️ [추가] 장소 이름 수집



        for (const place of activePlaces) {
            const distance = getDistance(
                currentLocation.coords.latitude,
                currentLocation.coords.longitude,
                place.latitude,
                place.longitude
            );

            if (distance <= place.radius) {
                isInsideAnyZone = true;
                insidePlaceIds.push(place.id);
                insidePlaceNames.push(place.name); 

                if (place.blockedApps && Array.isArray(place.blockedApps)) {
                    place.blockedApps.forEach((app) => combinedBlockedApps.add(app));
                }
            }
        }

        const appsToBlock = Array.from(combinedBlockedApps);

        // 5. 상태 관리 (기존과 동일)
        const lastLockStateRaw = await AsyncStorage.getItem(LOCK_STATE_KEY);
        const lastLockState: {
            state?: "LOCKED" | "UNLOCKED";
            apps?: string[];
            insidePlaceIds?: string[];
        } = lastLockStateRaw ? JSON.parse(lastLockStateRaw) : {};

        const prevInside = new Set(lastLockState.insidePlaceIds || []);
        const nowInside = new Set(insidePlaceIds);

        const entered: string[] = [];
        const exited: string[] = [];
        nowInside.forEach((id) => {
            if (!prevInside.has(id)) entered.push(id);
        });
        prevInside.forEach((id) => {
            if (!nowInside.has(id)) exited.push(id);
        });

        for (const pid of entered) {
            await statsLogEnter({ userId: "local", placeId: pid });
        }
        for (const pid of exited) {
            await statsLogExit({ userId: "local", placeId: pid });
        }

        // 상태 변경 확인
        const newLockState = isInsideAnyZone ? "LOCKED" : "UNLOCKED";
        const hasStateChanged =
            newLockState !== lastLockState.state ||
            JSON.stringify(appsToBlock.sort()) !==
            JSON.stringify((lastLockState.apps || []).sort()) ||
            JSON.stringify(insidePlaceIds.sort()) !==
            JSON.stringify((lastLockState.insidePlaceIds || []).sort());

        if (hasStateChanged) {
            console.log(
                `[Location Task] State changed to ${newLockState}. Apps:`,
                appsToBlock,
                "Inside:",
                insidePlaceIds
            );
            console.log(
                "[Location Debug] setBlockedApps 호출 준비:",
                isInsideAnyZone,
                appsToBlock.length,
                "개 앱"
            );

      // ⭐️ [수정] Alert → Notification
      if (newLockState === "LOCKED" && lastLockState.state !== "LOCKED") {
        // UNLOCKED → LOCKED (새로 진입)
        const placeName = insidePlaceNames[0] || "집중장소";

        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🔒 집중 모드 시작",
            body: `"${placeName}"에 진입했습니다.\n${appsToBlock.length}개 앱이 차단됩니다.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // 즉시 표시
        });
      } else if (newLockState === "UNLOCKED" && lastLockState.state === "LOCKED") {
        // LOCKED → UNLOCKED (이탈)
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🔓 집중 모드 종료",
            body: "집중장소에서 벗어났습니다.\n앱 차단이 해제되었습니다.",
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });
      }
            // 네이티브 모듈에 차단 목록 전달. 네이티브 서비스(AppLockService.kt)가 이를 사용해 앱 차단 로직 실행.
            await BlockedApps.setBlockedApps(isInsideAnyZone ? appsToBlock : []);
            await AsyncStorage.setItem(
                LOCK_STATE_KEY,
                JSON.stringify({
                    state: newLockState,
                    apps: appsToBlock,
                    insidePlaceIds,
                })
            );
        }
    } catch (err) {
        console.error("Error in location update:", err);
    }
};

// ⭐️ [추가] 강제 업데이트 함수 (export)
export const forceLocationTaskUpdate = async () => {
    console.log("[forceLocationTaskUpdate] 🔄 Force update triggered");

    try {
        // 현재 위치 가져오기
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });

        console.log("[forceLocationTaskUpdate] 📍 Current location:", {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy,
        });

        // 백그라운드 태스크와 동일한 로직 실행
        await processLocationUpdate(location);

        console.log("[forceLocationTaskUpdate] ✅ Update completed");
    } catch (e) {
        console.error("[forceLocationTaskUpdate] ❌ Error:", e);
    }
};

// =============================================================
// 🚨 [수정] 백그라운드 위치 추적 작업 (공유 함수 사용)
// =============================================================
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error("TaskManager Error:", error);
        return;
    }
    if (data) {
        const { locations } = data as any;
        const currentLocation = locations[0];

        console.log("[Location Task] 📍 Background update triggered");
        await processLocationUpdate(currentLocation);
    }
});

/**
 * 위치 추적 시작 함수 (UI에서 호출)
 */

export const startLocationTask = async () => {
    // ✅ 가장 먼저 추적 상태 확인
     // ⭐️ [추가] Notification 권한 요청
  const { status: notifStatus } = await Notifications.requestPermissionsAsync();
  if (notifStatus !== "granted") {
    console.warn("Notification permission not granted");
  }
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
    );

    if (isTracking) {
        console.log("⚠️ Location tracking is already active. Skipping start.");
        return; // 여기서 함수 종료
    }

    // ✅ 네이티브 앱 차단 서비스 시작
    try {
        await BlockedApps.startAppLockService();
        console.log("✅ Native AppLockService started.");
    } catch (e) {
        console.error("❌ Failed to start AppLockService", e);
        Alert.alert(
            "서비스 오류",
            "앱 차단 서비스를 시작하는 데 실패했습니다."
        );
        return;
    }

    // ✅ 위치 추적 시작
    try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 3 * 1000,
            distanceInterval: 0,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
                notificationTitle: "집중 모드",
                notificationBody: "집중장소 인근인지 확인 중입니다.",
                notificationColor: "#4A90E2",
            },
        });
        console.log("✅ Location tracking started successfully.");
    } catch (e) {
        console.error("❌ Failed to start location tracking:", e);
        // 실패 시 서비스도 정리
        try {
            await BlockedApps.stopAppLockService();
        } catch (cleanupError) {
            console.error("Failed to cleanup service:", cleanupError);
        }
    }

};

/**
 * 위치 추적 중지 함수 (UI에서 호출)
 */
export const stopLocationTask = async () => {
    // ... (기존과 동일)
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
    );
    if (isTracking) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

        // 중지 시, 이탈 로깅 처리
        try {
            const lastLockStateRaw = await AsyncStorage.getItem(LOCK_STATE_KEY);
            const lastLockState: { insidePlaceIds?: string[] } = lastLockStateRaw
                ? JSON.parse(lastLockStateRaw)
                : {};
            const inside = lastLockState.insidePlaceIds || [];
            for (const pid of inside) {
                await statsLogExit({ userId: "local", placeId: pid });
            }
        } catch (e) {
            console.log("[STATS] stopLocationTask finalize error", e);
        }

        // 서비스 중지 시에는 무조건 잠금 해제
        await BlockedApps.setBlockedApps([]);

        // ✅ [핵심 수정 2] 네이티브 앱 차단 서비스 명시적 중지 요청
        try {
            await BlockedApps.stopAppLockService();
            console.log("Native AppLockService stopped.");
        } catch (e) {
            console.error("Failed to stop AppLockService", e);
        }

        await AsyncStorage.removeItem(LOCK_STATE_KEY);
        console.log("Location tracking stopped and apps unlocked.");
    }
};