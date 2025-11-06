import { AuthContext } from "@/src/services/auth/authContext";
import { Redirect, Stack } from "expo-router";
import { useContext, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native'; // 1. AppState 임포트
import { startLocationTask } from '../../src/services/location/locationService';
import { startSync } from '../../src/services/location/locationSyncService';

export default function ProtectedLayout() {
    const authState = useContext(AuthContext);//하위 컴포넌트로 전달받은 정보값 불러오기
    const appState = useRef(AppState.currentState); // 2. 현재 상태 추적
    useEffect(() => {
        // (앱 부팅/로그인 시 1회 실행)
        const initializeServices = async () => {
            // 1. 동기화 *리스너* 실행 (이 함수는 즉시 리턴됩니다)
            startSync(); 

            // 🚨 [수정] 경합 상태(Race Condition) 방지를 위한 임시 딜레이
            // startSync()가 Firestore에서 데이터를 받아 AsyncStorage에 저장할 시간을 줍니다.
            console.log("Waiting 3 seconds for initial sync...");
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
            console.log("Wait complete. Starting location task.");
            
            // 2. 동기화가 (아마도) 끝난 후 위치 작업 시작
            startLocationTask();
        };

        initializeServices();

        // 3. AppState 리스너 등록
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            // 앱이 백그라운드에 있다가 다시 포그라운드로 돌아왔을 때
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                console.log('App has come to the foreground, re-syncing...');
                startSync(); // 4. 동기화 로직을 다시 실행!
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove(); // 5. 컴포넌트 언마운트 시 리스너 제거
        };

    }, []); // 빈 배열: 마운트 시 1회만 실행

    if (!authState.isReady) {
        return null;//아직 준비가 안되었으면 아무것도 렌더링 하지 않음
    }

    if (!authState.isLoggedIn) {
        return <Redirect href="/login_main" />;
    }


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