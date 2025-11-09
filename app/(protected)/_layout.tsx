import { AuthContext } from "@/src/services/auth/authContext";
import { Redirect, Stack, useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

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
            if (!authState.isReady) return;
            if (!authState.isLoggedIn) return;

            // ✅ 로그인된 상태에서만 권한 체크 시작
            const result = await checkAllPermissions();

            if (!result.allGranted) {
                router.replace("/permission");
                return;
            }

            // ✅ 권한 모두 OK → 서비스 시작
            startSync();
            await new Promise(r => setTimeout(r, 3000));
            startLocationTask();

            // ✅ 권한 체크 완료
            setPermissionChecked(true);
        };

        verifyPermissions();

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

    // ✅ 로그인 준비 안 됨 → 아무것도 렌더링 X
    if (!authState.isReady) return null;

    // ✅ 로그인 안 됨 → 로그인 페이지
    if (!authState.isLoggedIn) {
        return <Redirect href="/login_main" />;
    }

    // ✅ 권한 체크 완료 전까진 공간 유지
    if (!permissionChecked) return null;

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
