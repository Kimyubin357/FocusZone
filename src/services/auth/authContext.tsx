import { useRouter } from "expo-router";
import { createContext, PropsWithChildren, useState } from "react";
type AuthState = {
    isLoggedIn : boolean,
    logIn: () => void;
    logOut: () => void;
}

export const AuthContext = createContext<AuthState>({
    isLoggedIn: false,
    logIn: () => {},
    logOut: () => {},
});

export function AuthProvider({ children }: PropsWithChildren ){
    const [isLoggedIn, setIsLoggedIn] = useState(false);//useState는 현재 상태를 관리하기 위한 함수
    //현재 상태값(변수), 상태를 업데이트 하는 함수 = 초기값은 false
    const router = useRouter();

    const logIn = () => {//로그인 할 경우
        setIsLoggedIn(true);//상태값을 변경하고
        router.replace("/(protected)/(tabs)");//페이지 라우터 변경
    }
    const logOut = () => {
        setIsLoggedIn(false);
        router.replace("/(auth)/login_main");
    }

    //auth context를 사용해서 모든 하위 컴포넌트에 상태를 전달하는 역할을 함
    return (
        <AuthContext.Provider value={{ isLoggedIn, logIn, logOut }}>
            {children}
        </AuthContext.Provider>
    )
}