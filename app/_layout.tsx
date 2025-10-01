// app/_layout.tsx
import { AuthProvider } from "@/src/services/auth/authContext";
import { useFonts } from 'expo-font';
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// SplashScreen을 숨기지 않도록 설정
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  });

  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, animation: "none" }}>
          <Stack.Screen name="(protected)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </AuthProvider>
      </GestureHandlerRootView>
  );
}
