import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Alert, NativeModules } from "react-native";

// 네이티브 모듈 및 상수 정의
const { BlockedApps } = NativeModules;
const LOCATION_TASK_NAME = "background-location-task";
const LOCK_STATE_KEY = "currentLockState"; // 현재 잠금 상태를 저장할 키
const MIN_ACCURACY_THRESHOLD = 50; // 50m보다 오차 반경이 큰 데이터는 무시

// =========================
// [STATS] 집중 통계 적재 유틸 (AsyncStorage 버전)
// =========================

//수정됨: 통계용 현재 세션/일자별 세션 저장 키
const STATS_CUR_KEY = (userId: string) => `currentSessions:${userId}`; // [{placeId, startedAt}]
//수정됨: 특정 일자 세션 로그 키
const STATS_DAY_KEY = (u: string, p: string, ymd: string) =>
  `stats:${u}:${p}:${ymd}`;

//수정됨: 통계 유틸 타입
type CurrentSession = { placeId: string; startedAt: number };
type FinishedSession = {
  id: string;
  placeId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
};

//수정됨: 날짜 포맷(Y-M-D)
function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

//수정됨: 진입 로깅
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
    // 중복 진입 방지
    if (!cur.find((c) => c.placeId === placeId)) {
      cur.push({ placeId, startedAt });
      await AsyncStorage.setItem(key, JSON.stringify(cur));
      //console.log('[STATS] Enter logged:', placeId, new Date(startedAt).toISOString());
    }
  } catch (e) {
    console.log("[STATS] logEnter error", e);
  }
}

//수정됨: 이탈 로깅
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
    if (!row) return; // 진입 기록 없음

    // 현재 세션 제거
    const remain = cur.filter((c) => c.placeId !== placeId);
    await AsyncStorage.setItem(curKey, JSON.stringify(remain));

    // 완료 세션 저장
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
    //console.log('[STATS] Exit logged:', placeId, new Date(endedAt).toISOString(), 'dur:', durationMs);
  } catch (e) {
    console.log("[STATS] logExit error", e);
  }
}

// =========================
// 데이터 타입 정의 (index.tsx와 일치시키는 것이 좋습니다)
// =========================
type Place = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
  blockedApps: string[];
};

// 두 지점 간의 거리를 미터(m) 단위로 계산하는 함수
const getDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 미터 단위 거리
};

/**
 * 백그라운드 위치 추적 작업 정의
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("TaskManager Error:", error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    const currentLocation = locations[0];

    // 1. 정확도 필터링: 오차가 너무 큰 데이터는 무시
    if (currentLocation?.coords?.accuracy > MIN_ACCURACY_THRESHOLD) {
      console.log(
        `Ignoring inaccurate location. Accuracy: ${currentLocation.coords.accuracy}m`
      );
      return;
    }

    try {
      // 2. 저장된 장소 정보 불러오기
      const savedPlacesRaw = await AsyncStorage.getItem("focusPlaces");
      if (!savedPlacesRaw) return;

      const places: Place[] = JSON.parse(savedPlacesRaw);
      const activePlaces = places.filter((p) => p.isActive);

      let isInsideAnyZone = false;
      let combinedBlockedApps = new Set<string>();

      //수정됨: 현재 위치에서 반경 내에 포함된 placeId 목록도 수집
      const insidePlaceIds: string[] = []; //수정됨

      // 3. 반경 계산: 활성화된 모든 장소에 대해 반경 내에 있는지 확인
      for (const place of activePlaces) {
        const distance = getDistance(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          place.latitude,
          place.longitude
        );

        if (distance <= place.radius) {
          isInsideAnyZone = true;
          insidePlaceIds.push(place.id); //수정됨
          place.blockedApps.forEach((app) => combinedBlockedApps.add(app));
        }
      }

      const appsToBlock = Array.from(combinedBlockedApps);

      //수정됨: 이전 상태(잠금/앱/반경내 장소 ID들) 로드
      const lastLockStateRaw = await AsyncStorage.getItem(LOCK_STATE_KEY);
      const lastLockState: {
        state?: "LOCKED" | "UNLOCKED";
        apps?: string[];
        insidePlaceIds?: string[];
      } = lastLockStateRaw ? JSON.parse(lastLockStateRaw) : {};

      const prevInside = new Set(lastLockState.insidePlaceIds || []); //수정됨
      const nowInside = new Set(insidePlaceIds); //수정됨

      //수정됨: 진입/이탈 placeId 계산
      const entered: string[] = [];
      const exited: string[] = [];
      // nowInside 중 prev에 없던 것 = 새로 진입
      nowInside.forEach((id) => {
        if (!prevInside.has(id)) entered.push(id);
      });
      // prevInside 중 now에 없던 것 = 이탈
      prevInside.forEach((id) => {
        if (!nowInside.has(id)) exited.push(id);
      });

      //수정됨: 통계 로깅(진입/이탈)
      for (const pid of entered) {
        await statsLogEnter({ userId: "local", placeId: pid });
      }
      for (const pid of exited) {
        await statsLogExit({ userId: "local", placeId: pid });
      }

      // 4. 상태 관리: 이전 상태와 달라졌을 때만 네이티브 모듈 호출
      const newLockState = isInsideAnyZone ? "LOCKED" : "UNLOCKED";
      const hasStateChanged =
        newLockState !== lastLockState.state ||
        JSON.stringify(appsToBlock) !== JSON.stringify(lastLockState.apps) ||
        JSON.stringify(insidePlaceIds.sort()) !==
          JSON.stringify((lastLockState.insidePlaceIds || []).sort()); //수정됨

      if (hasStateChanged) {
        console.log(
          `State changed to ${newLockState}. Apps:`,
          appsToBlock,
          "Inside:",
          insidePlaceIds
        ); //수정됨
        await BlockedApps.setBlockedApps(isInsideAnyZone ? appsToBlock : []);
        //수정됨: insidePlaceIds 함께 저장
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
      console.error("Error in background task:", err);
    }
  }
});

/**
 * 위치 추적 시작 함수 (UI에서 호출)
 */
export const startLocationTask = async () => {
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== "granted") {
    Alert.alert(
      "권한 필요",
      "정확한 위치 측정을 위해 위치 권한을 항상 허용해주세요."
    );
    return;
  }

  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== "granted") {
    Alert.alert(
      "권한 필요",
      "백그라운드 위치 권한을 허용해야 앱이 꺼져있을 때도 집중장소를 인식할 수 있습니다."
    );
    return;
  }

  const isTracking = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (isTracking) {
    console.log("Location tracking is already active.");
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation, // 최고 정확도 설정
    timeInterval: 3 * 1000, // 1분마다
    distanceInterval: 5, // 20m 이상 움직였을 때
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "집중 모드",
      notificationBody: "집중장소 인근인지 확인 중입니다.",
      notificationColor: "#4A90E2",
    },
  });
  console.log("Location tracking started.");
};

/**
 * 위치 추적 중지 함수 (UI에서 호출)
 */
export const stopLocationTask = async () => {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

    //수정됨: 중지 시, 반경 내에 있던 모든 장소에 대해 이탈 로깅 처리
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
      console.log("[STATS] stopLocationTask finalize error", e); //수정됨
    }

    // 서비스 중지 시에는 무조건 잠금 해제
    await BlockedApps.setBlockedApps([]);
    await AsyncStorage.removeItem(LOCK_STATE_KEY);
    console.log("Location tracking stopped and apps unlocked.");
  }
};
