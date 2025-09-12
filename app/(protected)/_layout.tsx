import { AuthContext } from "@/src/services/auth/authContext";
import { Redirect, Stack } from "expo-router";
import { useContext } from "react";

export default function ProtectedLayout() {
    const authState = useContext(AuthContext);//하위 컴포넌트로 전달받은 정보값 불러오기

    if(!authState.isReady){
        return null;//아직 준비가 안되었으면 아무것도 렌더링 하지 않음
    }
    
    if(!authState.isLoggedIn){
      return <Redirect href="/login_main"/>;
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