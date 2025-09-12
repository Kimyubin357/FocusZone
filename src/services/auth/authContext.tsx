import AsyncStroage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { createContext, PropsWithChildren, useEffect, useState } from "react";

type AuthState = {
    isLoggedIn : boolean,
    isReady : boolean,
    logIn: () => void;
    logOut: () => void;
}

export const AuthContext = createContext<AuthState>({
    isLoggedIn: false,
    isReady: false,
    logIn: () => {},
    logOut: () => {},
});

export function AuthProvider({ children }: PropsWithChildren ){
    const [isReady, setIsReady] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);//useState는 현재 상태를 관리하기 위한 함수
    //현재 상태값(변수), 상태를 업데이트 하는 함수 = 초기값은 false
    const router = useRouter();

    const authStorageKey = "auth-key";

    const storeAuthState = async(newState: {isLoggedIn: boolean}) => {
        try{
            const jsonValue = JSON.stringify(newState);
            await AsyncStroage.setItem(authStorageKey, jsonValue);
        }catch (error){
            console.log("saving error", error);
        }
    }

    useEffect(() => {
        const getAuthState = async() => {
            try{
                const value = await AsyncStroage.getItem(authStorageKey);
                if(value !== null){
                    const auth = JSON.parse(value);
                    setIsLoggedIn(auth.isLoggedIn);
                }
            }catch(error){
                console.log("componet reder error", error);
            }
            setIsReady(true);
        };
        getAuthState();
    }, []);//컴포넌트가 처음 렌더링 될 때 실행됨

    const logIn = () => {//로그인 할 경우
        setIsLoggedIn(true);//상태값을 변경하고

        storeAuthState({isLoggedIn: true});//비동기 함수로 상태를 저장

        router.replace("/(protected)/(tabs)");//페이지 라우터 변경
    }
    const logOut = () => {
        setIsLoggedIn(false);
        storeAuthState({isLoggedIn: false});
        router.replace("/(auth)/login_main");
    }

    //auth context를 사용해서 모든 하위 컴포넌트에 상태를 전달하는 역할을 함
    return (
        <AuthContext.Provider value={{ isReady, isLoggedIn, logIn, logOut }}>
            {children}
        </AuthContext.Provider>
    )
}