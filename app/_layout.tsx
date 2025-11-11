// app/_layout.tsx
import { AuthContext, AuthProvider } from "@/src/services/auth/authContext"; // 경로 확인
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from "expo-status-bar";
import React, { useContext, useEffect } from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// 스플래시 스크린을 숨기지 않음 (인증 로딩까지)
SplashScreen.preventAutoHideAsync();

// 1. [필수] RootLayout이 default export여야 합니다.
export default function RootLayout() {
  // 2. 최상위 레이아웃은 Provider들만 설정합니다.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AuthGuardAndLayout />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function AuthGuardAndLayout() {
  const { isReady, isLoggedIn } = useContext(AuthContext);
  const router = useRouter();
  const segments = useSegments(); // 현재 경로(스택)

  useEffect(() => {
    if (!isReady) {
      // 1. AuthContext가 AsyncStorage에서 상태를 로드할 때까지 대기
      //    (스플래시 스크린이 계속 보임)
      return;
    }

    // 2. 상태 로드 완료, 스플래시 스크린 숨기기
    SplashScreen.hideAsync();

    // 🔽 [수정] "스택 중독"을 막는 올바른 'Auth Guard' 로직

    const inAuthGroup = segments[0] === '(auth)';

    if (isLoggedIn && inAuthGroup) {
      // 3. 로그인 됨 + (auth) 그룹에 있음 (e.g., 로그인/가입 화면)
      //    -> (protected)로 강제 이동
      router.replace('/(protected)/(tabs)/(focus_zone)');

    } else if (!isLoggedIn && !inAuthGroup) {
      // 4. 로그인 안됨 + (auth) 그룹에 "없음" (e.g., (protected) 또는 /permission)
      //    -> (auth)로 강제 이동
      router.replace('/(auth)/login_main');
    }

    // 5. 그 외의 경우 (정상 상태)
    //    - 로그인 됨 + (protected) 그룹에 있음 -> OK
    //    - 로그인 안됨 + (auth) 그룹에 있음 -> OK

  }, [isReady, isLoggedIn, segments, router]);

  // 6. [수정] 스플래시/로딩 중에는 "아무것도" 렌더링하지 않음 (표준 방식)
  //    (useEffect가 스택을 교체할 때까지)
  if (!isReady) {
    return null;
  }

  // 7. isReady가 true가 되고, useEffect가 올바른 스택으로 보낸 후에 
  //    안전하게 렌더링
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, animation: "none" }}>
        <Stack.Screen name="(protected)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </>
  );
}