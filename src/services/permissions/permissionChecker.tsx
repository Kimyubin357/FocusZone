// src/services/permissions/permissionChecker.tsx
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { NativeModules } from "react-native";

const { BlockedApps } = NativeModules;

export type PermissionStatus = 'GRANTED' | 'DENIED' | 'UNDETERMINED';

interface PermissionResult {
    location: PermissionStatus;
    notifications: PermissionStatus;
    overlay: PermissionStatus;
    usageStats: PermissionStatus;
    allGranted: boolean;
}

/**
 * 4가지 필수 권한의 현재 상태를 확인합니다.
 */
export async function checkAllPermissions(): Promise<PermissionResult> {
    const results: Partial<PermissionResult> = {};

    // 1. 위치 권한 (백그라운드)
    const { status: locStatus } = await Location.getBackgroundPermissionsAsync();
    results.location = locStatus === 'granted' ? 'GRANTED' : locStatus === 'denied' ? 'DENIED' : 'UNDETERMINED';

    // 2. 알림 권한
    let notifStatus: PermissionStatus = 'UNDETERMINED';
    try {
        const hasNotificationPermission = await BlockedApps.checkNotificationPermission();
        results.notifications = hasNotificationPermission ? 'GRANTED' : 'DENIED';
    } catch (e) {
        console.error("Failed to check Notifications permission:", e);
    }
    results.notifications = notifStatus;

    // 3. 다른 앱 위에 표시 권한 (Overlay)
    try {
        // 네이티브 모듈 호출
        const hasOverlay = await BlockedApps.checkOverlayPermission();
        results.overlay = hasOverlay ? 'GRANTED' : 'DENIED';
    } catch (e) {
        console.error("Failed to check Overlay permission:", e);
        results.overlay = 'DENIED';
    }

    // 4. 사용량 접근 권한 (Usage Stats)
    try {
        // 네이티브 모듈 호출
        const hasUsageStats = await BlockedApps.checkUsageStatsPermission();
        results.usageStats = hasUsageStats ? 'GRANTED' : 'DENIED';
    } catch (e) {
        console.error("Failed to check Usage Stats permission:", e);
        results.usageStats = 'DENIED';
    }

    const allGranted = (
        results.location === 'GRANTED' &&
        results.notifications === 'GRANTED' &&
        results.overlay === 'GRANTED' &&
        results.usageStats === 'GRANTED'
    );

    return {
        ...results as PermissionResult,
        allGranted
    };
}

/**
 * 특정 권한을 요청하는 헬퍼 함수입니다. (UsageStats/Overlay는 설정 화면으로 리다이렉트)
 */
export async function requestPermission(type: keyof PermissionResult) {
    switch (type) {
        case 'location':
            // Foreground 먼저 요청 (필수)
            await Location.requestForegroundPermissionsAsync();
            // Background 요청
            return Location.requestBackgroundPermissionsAsync();
        case 'notifications':
            // Expo Notifications 요청
            return Notifications.requestPermissionsAsync();
        case 'overlay':
            // 네이티브 모듈에서 설정 화면을 직접 엽니다.
            BlockedApps.requestOverlayPermission();
            break;
        case 'usageStats':
            // 네이티브 모듈에서 설정 화면을 직접 엽니다.
            BlockedApps.requestUsageStatsPermission();
            break;
    }
}