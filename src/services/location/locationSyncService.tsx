// src/services/location/locationSyncService.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
    collection,
    DocumentData,
    onSnapshot,
    query,
    where,
} from 'firebase/firestore';
import { NativeModules } from 'react-native';
import { auth, db } from '../../../firebaseConfig';
import { forceLocationTaskUpdate } from './locationService';

// 네이티브 모듈에서 가져올 앱 정보 타입
type InstalledApp = {
    packageName: string;
    appName: string;
    icon: string;
    category: string;
};

// locationService.tsx가 사용하는 'Place' 타입 정의
type Place = {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radius: number;
    isActive: boolean;
    blockedApps: string[]; // 최종 "패키지 목록"이 저장될 곳
};

const GROUP_PLACES_STORAGE_KEY = 'groupfocusPlaces';
const GROUP_SYNC_STATUS_KEY = 'groupSyncStatus';
const LOCK_STATE_KEY = 'currentLockState';

// 🚨 [신규] 'locationService'가 참조할 카테고리-앱 맵 키
// 🚨 이 키는 locationService.tsx의 CATEGORIZED_APPS_KEY와 *반드시* 일치해야 함
const CATEGORIZED_APPS_KEY = "categorizedInstalledApps";

let firestoreUnsubscribe: () => void | undefined;

/**
 * Firestore 문서를 'Place' 객체로 변환
 */
const transformDocToPlace = (doc: DocumentData): Place | null => {
    const data = doc.data();

    if (
        !data.groupName ||
        !data.address ||
        !data.latitude ||
        !data.longitude ||
        typeof data.radius !== 'number'
    ) {
        console.warn(`Firestore 문서 ${doc.id}에 필수 필드가 누락되었습니다.`);
        return null;
    }

    return {
        id: doc.id,
        name: data.groupName,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        radius: data.radius,
        // 🚨 [핵심 수정] data.activate -> data.isActive
        isActive: data.isActive ?? false, // 👈 DB의 'isActive' 필드 참조
        // (아직 번역 전) 카테고리 목록
        blockedApps: data.blockedAppCategories ?? [],
    };
};

/**
 * 카테고리 목록을 실제 패키지 목록으로 '번역'하는 헬퍼 함수
 * (수정: 카테고리 맵을 AsyncStorage에도 저장)
 */
const translateCategoriesToPackages = (
    places: Place[],
    installedApps: InstalledApp[]
): { translatedPlaces: Place[], categoryMap: Map<string, string[]> } => { // 👈 반환 타입 수정
    // 1. 카테고리 -> 패키지 맵 생성
    const categoryMap = new Map<string, string[]>();
    for (const app of installedApps) {
        const appCat = app.category.toLowerCase(); // "Social" -> "social"
        if (!categoryMap.has(appCat)) {
            categoryMap.set(appCat, []);
        }
        categoryMap.get(appCat)!.push(app.packageName);
    }

    // 2. 장소 목록을 순회하며 'blockedApps' 필드를 번역된 패키지 목록으로 교체
    const translatedPlaces = places.map(place => {
        const finalBlockedPackages = new Set<string>();

        // place.blockedApps는 현재 ["Social", "Game"] 같은 카테고리 목록임
        place.blockedApps.forEach(category => {
            const packages = categoryMap.get(category.toLowerCase());
            if (packages) {
                packages.forEach(pkg => finalBlockedPackages.add(pkg));
            }
        });

        // 번역된 패키지 목록으로 교체
        return {
            ...place,
            blockedApps: Array.from(finalBlockedPackages)
        };
    });

    // 3. 맵과 목록 동시 반환
    return { translatedPlaces, categoryMap };
};

/**
 * 사용자가 속한 그룹장소 목록을 실시간으로 감지하고 AsyncStorage에 저장
 */
const setupFirestoreListener = (user: User) => {
    const uid = user.uid;
    const q = query(
        collection(db, 'groupLocations'),
        where('memberIds', 'array-contains', uid)
    );

    firestoreUnsubscribe = onSnapshot(
        q,
        async (snapshot) => {
            try {
                // 1. Firestore 문서를 (아직 번역 안 된) Place[] 배열로 변환
                const placesWithCategories: Place[] = [];
                snapshot.forEach((doc) => {
                    // 🚨 [수정 1] 'isActive'가 올바르게 설정됨
                    const place = transformDocToPlace(doc);
                    if (place) {
                        placesWithCategories.push(place);
                    }
                });

                console.log('[Sync Debug] 1. Firestore 문서는 변환 완료.');

                // 2. 네이티브 모듈 호출
                const { BlockedApps } = NativeModules;
                console.log('[Sync Debug] 2. getInstalledApps 호출 시작...');
                const installedApps: InstalledApp[] = await BlockedApps.getInstalledApps();
                console.log(`[Sync Debug] 3. getInstalledApps 완료! ${installedApps.length}개 앱 발견.`);

                // 3. "번역" 단계
                // 🚨 [수정 2] categoryMap도 함께 받음
                const { translatedPlaces, categoryMap } = translateCategoriesToPackages(
                    placesWithCategories,
                    installedApps
                );
                console.log('[Sync Debug] 4. 카테고리 번역 완료.');

                // 4. "번역된" 최종 목록을 AsyncStorage에 저장
                await AsyncStorage.setItem(
                    GROUP_PLACES_STORAGE_KEY,
                    JSON.stringify(translatedPlaces) // (isActive: true가 이제 포함됨)
                );

                // 5. 🚨 [신규] 'locationService'가 사용할 카테고리 맵도 저장
                // (Map은 JSON 저장이 안되므로 Object로 변환)
                const categoryMapObject = Object.fromEntries(categoryMap);
                await AsyncStorage.setItem(
                    CATEGORIZED_APPS_KEY,
                    JSON.stringify(categoryMapObject)
                );

                // 6. 동기화 성공 플래그 설정
                await AsyncStorage.setItem(GROUP_SYNC_STATUS_KEY, 'SYNCED');

                console.log(
                    `[Sync Service] ${translatedPlaces.length}개의 장소를 AsyncStorage에 동기화했습니다. (상태: SYNCED)`
                );
                
                // ✅ [수정 2] 동기화 직후, locationService에 즉시 재검사를 강제합니다.
                console.log('[Sync Service] locationService에 즉시 재검사 신호 전송...');
                await forceLocationTaskUpdate();

            } catch (error) {
                console.error('[Sync Service] 동기화 중 심각한 오류 발생:', error);
                await AsyncStorage.setItem(GROUP_SYNC_STATUS_KEY, 'OFFLINE');
            }
        },
        async (error) => {
            console.error('[Sync Service] Firestore 리스너 오류 (네트워크 끊김 등):', error);
            await AsyncStorage.setItem(GROUP_SYNC_STATUS_KEY, 'OFFLINE');
        }
    );
};

const stopSync = async () => {
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = undefined;
    }
};

export const startSync = () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (!firestoreUnsubscribe) {
                console.log('[Sync Service] 로그인 감지, Firestore 리스너 시작.');
                setupFirestoreListener(user);
            }
        } else {
            console.log('[Sync Service] 로그아웃 감지, 리스너 중지.');
            stopSync();
        }
    });
};