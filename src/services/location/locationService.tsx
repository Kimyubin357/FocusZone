import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert, NativeModules } from 'react-native';

// 네이티브 모듈 및 상수 정의
const { BlockedApps } = NativeModules;
const LOCATION_TASK_NAME = 'background-location-task';
const LOCK_STATE_KEY = 'currentLockState'; // 현재 잠금 상태를 저장할 키
const MIN_ACCURACY_THRESHOLD = 50; // 50m보다 오차 반경이 큰 데이터는 무시

// 데이터 타입 정의 (index.tsx와 일치시키는 것이 좋습니다)
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
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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
    console.error('TaskManager Error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    const currentLocation = locations[0];

    // 1. 정확도 필터링: 오차가 너무 큰 데이터는 무시
    if (currentLocation.coords.accuracy > MIN_ACCURACY_THRESHOLD) {
      console.log(`Ignoring inaccurate location. Accuracy: ${currentLocation.coords.accuracy}m`);
      return;
    }

    try {
      // 2. 저장된 장소 정보 불러오기
      const savedPlacesRaw = await AsyncStorage.getItem('focusPlaces');
      if (!savedPlacesRaw) return;

      const places: Place[] = JSON.parse(savedPlacesRaw);
      const activePlaces = places.filter((p) => p.isActive);

      let isInsideAnyZone = false;
      let combinedBlockedApps = new Set<string>();

      // 3. 반경 계산: 활성화된 모든 장소에 대해 반경 내에 있는지 확인
      for (const place of activePlaces) {
        const distance = getDistance(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          place.latitude,
          place.longitude,
        );

        if (distance <= place.radius) {
          isInsideAnyZone = true;
          place.blockedApps.forEach((app) => combinedBlockedApps.add(app));
        }
      }

      const appsToBlock = Array.from(combinedBlockedApps);
      const newLockState = isInsideAnyZone ? 'LOCKED' : 'UNLOCKED';
      
      // 4. 상태 관리: 이전 상태와 달라졌을 때만 네이티브 모듈 호출
      const lastLockStateRaw = await AsyncStorage.getItem(LOCK_STATE_KEY);
      const lastLockState = lastLockStateRaw ? JSON.parse(lastLockStateRaw) : {};
      
      const hasStateChanged = newLockState !== lastLockState.state || 
                              JSON.stringify(appsToBlock) !== JSON.stringify(lastLockState.apps);

      if (hasStateChanged) {
        console.log(`State changed to ${newLockState}. Apps:`, appsToBlock);
        await BlockedApps.setBlockedApps(isInsideAnyZone ? appsToBlock : []);
        await AsyncStorage.setItem(LOCK_STATE_KEY, JSON.stringify({ state: newLockState, apps: appsToBlock }));
      }

    } catch (err) {
      console.error('Error in background task:', err);
    }
  }
});

/**
 * 위치 추적 시작 함수 (UI에서 호출)
 */
export const startLocationTask = async () => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    Alert.alert('권한 필요', '정확한 위치 측정을 위해 위치 권한을 항상 허용해주세요.');
    return;
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    Alert.alert('권한 필요', '백그라운드 위치 권한을 허용해야 앱이 꺼져있을 때도 집중장소를 인식할 수 있습니다.');
    return;
  }

  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isTracking) {
    console.log('Location tracking is already active.');
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation, // 최고 정확도 설정
    timeInterval: 3 * 1000, // 1분마다
    distanceInterval: 5, // 20m 이상 움직였을 때
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: '집중 모드',
      notificationBody: '집중장소 인근인지 확인 중입니다.',
      notificationColor: '#4A90E2',
    },
  });
  console.log('Location tracking started.');
};

/**
 * 위치 추적 중지 함수 (UI에서 호출)
 */
export const stopLocationTask = async () => {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    // 서비스 중지 시에는 무조건 잠금 해제
    await BlockedApps.setBlockedApps([]);
    await AsyncStorage.removeItem(LOCK_STATE_KEY);
    console.log('Location tracking stopped and apps unlocked.');
  }
};