import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
        screenOptions={{
            headerShown: true, // 헤더를 보이게 설정
            title: '', // 제목을 숨겨서 뒤로 가기 버튼만 남김
            headerTransparent: true, // 헤더 배경을 투명하게 만듦 (선택 사항)
            headerLeft: undefined, // 기존의 뒤로 가기 버튼을 그대로 사용
        }}
    >
        <Stack.Screen 
            name="login_main" 
            
        />
        <Stack.Screen 
            name="(email)" 
            
        />
    </Stack>
  );
}
