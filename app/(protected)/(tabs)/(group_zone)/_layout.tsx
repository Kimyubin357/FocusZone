import { Stack } from "expo-router";

export default function Layout() {
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="group_zone" options={{ headerTitle: '그룹장소', headerShown: false }} />
      <Stack.Screen name="add" options={{ headerTitle: '그룹장소 등록', headerShown: false }} />
      <Stack.Screen name="map" options={{ headerTitle: '지도에서 선택', headerShown: false }} />
    </Stack>
  );
}
