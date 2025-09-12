// app/_layout.tsx
import { AuthProvider } from "@/utils/authContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";


export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style = "auto" />
      <Stack screenOptions={{ headerShown: false, animation: "none" }}>
        <Stack.Screen name="(protected)"/>
        <Stack.Screen name="(auth)" />
      </Stack>
    </AuthProvider>
  );
}