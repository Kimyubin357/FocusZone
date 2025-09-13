// app/_layout.tsx
import { AuthProvider } from "@/src/services/auth/authContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, animation: "none" }}>
          <Stack.Screen name="(protected)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
