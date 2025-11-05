import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
    collection,
    DocumentData,
    onSnapshot,
    query,
    where,
} from 'firebase/firestore';
import { NativeModules } from 'react-native'; // 1. NativeModules 임포트
import { auth, db } from '../../../firebaseConfig';

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

const PLACES_STORAGE_KEY = 'focusPlaces';
const LOCK_STATE_KEY = 'currentLockState';

let firestoreUnsubscribe: () => void | undefined;

/**
 * Firestore 문서를 'Place' 객체로 변환
 * (참고: 이 단계에서 'blockedApps' 필드에는 아직 "카테고리"가 들어 있습니다)
 */
const transformDocToPlace = (doc: DocumentData): Place | null => {
    const data = doc.data();

    // (필수 필드 확인 로직은 동일)
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
        isActive: data.activate ?? false,
        // ✅ 중요: Firestore의 'blockedAppCategories'를 'blockedApps'로 매핑
        // 이 배열은 "번역" 단계를 거치기 전까지 ["Social", "Game"]을 담고 있습니다.
        blockedApps: data.blockedAppCategories ?? [],
    };
};

/**
 * (신규) 카테고리 목록을 실제 패키지 목록으로 '번역'하는 헬퍼 함수
 */
const translateCategoriesToPackages = (
    places: Place[],
    installedApps: InstalledApp[]
): Place[] => {
    // 1. 빠른 조회를 위한 카테고리 -> 패키지 맵 생성
    // 예: { "social": ["com.instagram.android", "com.facebook.katana"] }
    const categoryMap = new Map<string, string[]>();
    for (const app of installedApps) {
        const appCat = app.category.toLowerCase(); // "Social" -> "social"
        if (!categoryMap.has(appCat)) {
            categoryMap.set(appCat, []);
        }
        categoryMap.get(appCat)!.push(app.packageName);
    }

    // 2. 장소 목록을 순회하며 'blockedApps' 필드를 번역된 패키지 목록으로 교체
    return places.map(place => {
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
};

/**
 * 사용자가 속한 그룹장소 목록을 실시간으로 감지하고 AsyncStorage에 저장
 * (수정됨: '번역' 로직 추가)
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
                    const place = transformDocToPlace(doc); // (blockedApps: ["Social"])
                    if (place) {
                        placesWithCategories.push(place);
                    }
                });

                console.log('[Sync Debug] 1. Firestore 문서는 변환 완료.'); // 👈 로그 추가

                // 2. ✅ (핵심) 네이티브 모듈을 호출해 설치된 앱 목록 가져오기
                const { BlockedApps } = NativeModules;

                console.log('[Sync Debug] 2. 네이티브 모듈 로드. getInstalledApps 호출 시작...'); // 👈 로그 추가

                const installedApps: InstalledApp[] = await BlockedApps.getInstalledApps();

                console.log(`[Sync Debug] 3. getInstalledApps 완료! ${installedApps.length}개 앱 발견.`); // 👈 로그 추가

                // 3. ✅ "번역" 단계: 카테고리 목록 -> 패키지 목록
                const translatedPlaces = translateCategoriesToPackages(
                    placesWithCategories,
                    installedApps
                );

                console.log('[Sync Debug] 4. 카테고리 번역 완료.'); // 👈 로그 추가

                // 4. "번역된" 최종 목록을 AsyncStorage에 저장
                await AsyncStorage.setItem(
                    PLACES_STORAGE_KEY,
                    JSON.stringify(translatedPlaces)
                );
                
                console.log(
                    `[Sync Service] ${translatedPlaces.length}개의 장소를 AsyncStorage에 동기화했습니다.`
                );
                // console.log("최종 저장 데이터:", JSON.stringify(translatedPlaces, null, 2)); // (디버깅용)

            } catch (error) {
                console.error('[Sync Service] 동기화 중 심각한 오류 발생:', error);
            }
        },
        (error) => {
            console.error('[Sync Service] Firestore 리스너 오류:', error);
        }
    );
};

// ... (stopSync 함수는 동일) ...
const stopSync = async () => {
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = undefined;
    }
    await AsyncStorage.removeItem(PLACES_STORAGE_KEY);
    await AsyncStorage.removeItem(LOCK_STATE_KEY);
    console.log('[Sync Service] 동기화 중지 및 AsyncStorage 초기화.');
};


// ... (startSync 함수는 동일) ...
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