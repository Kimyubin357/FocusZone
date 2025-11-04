import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
    collection,
    DocumentData,
    onSnapshot,
    query,
    where,
} from 'firebase/firestore';
import { auth, db } from '../../../firebaseConfig';

// locationService.tsx가 사용하는 'Place' 타입 정의
// (기억하고 계신 필드명 기준으로 Firestore 문서를 변환합니다)
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

const PLACES_STORAGE_KEY = 'focusPlaces'; // locationService.tsx와 동일한 키
const LOCK_STATE_KEY = 'currentLockState'; // locationService.tsx와 동일한 키

// 리스너 해제 함수를 저장하기 위한 변수
let firestoreUnsubscribe: () => void | undefined;

/**
 * Firestore 문서를 locationService가 사용하는 'Place' 객체로 변환
 */
const transformDocToPlace = (doc: DocumentData): Place | null => {
    const data = doc.data();

    // 필수 필드 확인
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
        name: data.groupName, // groupName -> name
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        radius: data.radius,
        isActive: data.activate ?? false, // activate -> isActive
        blockedApps: data.blockedAppCategories ?? [], // blockedAppCategories -> blockedApps
    };
};

/**
 * 사용자가 속한 그룹장소 목록을 실시간으로 감지하고 AsyncStorage에 저장
 */
const setupFirestoreListener = (user: User) => {
    const uid = user.uid;

    // 내가 '멤버'로 속한 모든 'groupLocations' 쿼리
    const q = query(
        collection(db, 'groupLocations'),
        where('memberIds', 'array-contains', uid)
    );

    firestoreUnsubscribe = onSnapshot(
        q,
        async (snapshot) => {
            // 1. Firestore 문서를 Place[] 배열로 변환
            const places: Place[] = [];
            snapshot.forEach((doc) => {
                const place = transformDocToPlace(doc);
                if (place) {
                    places.push(place);
                }
            });

            // 2. 변환된 목록을 AsyncStorage에 저장
            await AsyncStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify(places));
            console.log(
                `[Sync Service] ${places.length}개의 장소를 AsyncStorage에 동기화했습니다.`
            );
        },
        (error) => {
            console.error('[Sync Service] Firestore 리스너 오류:', error);
        }
    );
};

/**
 * 동기화 서비스 중지 (로그아웃 시)
 */
const stopSync = async () => {
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = undefined;
    }
    // 로그아웃 시 저장된 장소와 잠금 상태 모두 제거
    await AsyncStorage.removeItem(PLACES_STORAGE_KEY);
    await AsyncStorage.removeItem(LOCK_STATE_KEY);
    console.log('[Sync Service] 동기화 중지 및 AsyncStorage 초기화.');
};

/**
 * 동기화 서비스 시작 (앱 부팅 시)
 */
export const startSync = () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // 로그인 상태: 리스너 설정 (이미 있다면 중복 방지)
            if (!firestoreUnsubscribe) {
                console.log('[Sync Service] 로그인 감지, Firestore 리스너 시작.');
                setupFirestoreListener(user);
            }
        } else {
            // 로그아웃 상태: 리스너 해제 및 데이터 정리
            console.log('[Sync Service] 로그아웃 감지, 리스너 중지.');
            stopSync();
        }
    });
};
