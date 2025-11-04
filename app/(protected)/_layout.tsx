import { AuthContext } from "@/src/services/auth/authContext";
import { Redirect, Stack } from "expo-router";
import React, { useContext, useEffect } from 'react';
import { startLocationTask } from '../../src/services/location/locationService';
import { startSync } from '../../src/services/location/locationSyncService';

export default function ProtectedLayout() {
    const authState = useContext(AuthContext);//하위 컴포넌트로 전달받은 정보값 불러오기


    if (!authState.isReady) {
        return null;//아직 준비가 안되었으면 아무것도 렌더링 하지 않음
    }

    if (!authState.isLoggedIn) {
        return <Redirect href="/login_main" />;
    }

    useEffect(() => {
        // (앱 부팅/로그인 시 1회 실행)

        // 1. Firestore -> AsyncStorage 동기화 서비스 시작
        startSync();

        // 2. AsyncStorage -> 네이티브 잠금 백그라운드 작업 시작
        // (startLocationTask는 내부적으로 권한을 요청합니다)
        startLocationTask();

        // TODO: 앱 종료 시 stopLocationTask/stopSync를 호출하는 로직이 필요할 수 있으나,
        // 보통은 OS가 관리하도록 둡니다. stopSync는 onAuthStateChanged가 처리합니다.

    }, []); // 빈 배열: 마운트 시 1회만 실행
    return (
        <Stack>
            <Stack.Screen
                name="(tabs)"
                options={{
                    headerShown: false,
                }}
            />
        </Stack>
    )
}