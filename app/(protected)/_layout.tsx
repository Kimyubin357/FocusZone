import { AuthContext } from "@/src/services/auth/authContext";
import { Stack, useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

import { startLocationTask } from "@/src/services/location/locationService";
import { startSync } from "@/src/services/location/locationSyncService";
import { checkAllPermissions } from "@/src/services/permissions/permissionChecker";

export default function ProtectedLayout() {
    const authState = useContext(AuthContext);
    const router = useRouter();
    const appState = useRef(AppState.currentState);

    const [permissionChecked, setPermissionChecked] = useState(false);

    useEffect(() => {
        const verifyPermissions = async () => {

            // ✅ 로그인된 상태에서만 권한 체크 시작
            const result = await checkAllPermissions();

            if (!result.allGranted) {
                router.replace("/permission");
                return;
            }

            setPermissionChecked(true);

            // ✅ [수정] 서비스 시작은 백그라운드에서 비동기로 수행
            //        (이 함수를 기다릴 필요 없음)
            const startServices = async () => {
                startSync();
                // 3초 딜레이가 꼭 필요했다면 여기에 두되, 
                // setPermissionChecked(true) 보다는 뒤에 있어야 합니다.
                await new Promise(r => setTimeout(r, 3000));
                startLocationTask();
            };
            startServices();
        };

        if (authState.isReady && authState.isLoggedIn) {
            verifyPermissions();
        }

        const sub = AppState.addEventListener("change", async (nextState) => {
            if (
                appState.current.match(/inactive|background/) &&
                nextState === "active"
            ) {
                // ✅ 앱으로 돌아올 때 권한 상태 다시 확인
                const result = await checkAllPermissions();
                if (!result.allGranted) {
                    router.replace("/permission");
                    return;
                }

                startSync();
                startLocationTask();
            }

            appState.current = nextState;
        });

        return () => sub.remove();
    }, [authState.isReady, authState.isLoggedIn]);


    if (!permissionChecked) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // ✅ 권한 체크 완료 시에만 (tabs) 렌더링
    return (
        <Stack>
            <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false }}
            />
        </Stack>
    )
}
