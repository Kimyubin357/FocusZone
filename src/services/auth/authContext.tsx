import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { createContext, PropsWithChildren, useEffect, useState } from "react";

type UserType = {
  uid: string;
  email: string;
  nickname: string;
  profileImage: string;
  provider: "google" | "naver" | "kakao" | "apple" | "email";
};

type AuthState = {
  isLoggedIn: boolean;
  isReady: boolean;
  user?: UserType;
  logIn: (user: UserType) => void;
  logOut: () => void;
  updateUser: (updatedData: Partial<UserType>) => void; // ✅ 사용자 정보 업데이트 함수
};

export const AuthContext = createContext<AuthState>({//전역 상태 관리 처음 만들때
  isLoggedIn: false,//로그인 상태 초기값 false (로그인 안된 상태)
  isReady: false,
  logIn: (user: UserType) => { },
  logOut: () => { },
  updateUser: (updatedData: Partial<UserType>) => { },
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false); //useState는 현재 상태를 관리하기 위한 함수
  const [user, setUser] = useState<AuthState["user"] | undefined>(undefined);
  //현재 상태값(변수), 상태를 업데이트 하는 함수 = 초기값은 false
  const router = useRouter();

  const authStorageKey = "auth-key"; //AsyncStorage에 저장할 때 사용할 키

  const storeAuthState = async (newState: {
    isLoggedIn: boolean;
    user?: AuthState["user"]
  }) => {
    try {
      if (newState.isLoggedIn && newState.user) { // 로그인이 되어 있는데 asyncstorage에 유저정보가 없으면 
        await AsyncStorage.setItem(authStorageKey, JSON.stringify(newState));// 그러면 저장을 하는 건데 로그인할 때
      } else {
        await AsyncStorage.removeItem(authStorageKey);
      }

    } catch (error) {
      console.log("AsyncStorage error", error);
    }
  };
  const updateUser = async (updatedData: Partial<UserType>) => {
    if (!user) return; // 사용자가 없으면 아무것도 하지 않음

    // 기존 user 정보에 새로운 데이터를 덮어씁니다.
    const newUser = { ...user, ...updatedData };

    setUser(newUser); // 1. React 상태를 업데이트합니다.
    await storeAuthState({ isLoggedIn: true, user: newUser }); // 2. AsyncStorage를 업데이트합니다.
  };

  useEffect(() => {
    const getAuthState = async () => {
      try {
        const value = await AsyncStorage.getItem(authStorageKey);
        if (value !== null) {
          const auth = JSON.parse(value);
          setIsLoggedIn(auth.isLoggedIn);
          setUser(auth.user);
        }
      } catch (error) {
        console.log("componet reder error", error);
      }
      setIsReady(true);
    };
    getAuthState();
  }, []); //컴포넌트가 처음 렌더링 될 때 실행됨

  const logIn = (userData: UserType) => {
    //로그인 할 경우
    setIsLoggedIn(true); //상태값을 변경하고
    setUser(userData);
    storeAuthState({ isLoggedIn: true, user: userData });
    router.replace("/(protected)/(tabs)/(focus_zone)");//페이지 라우터 변경
  }
  const logOut = () => {
    setIsLoggedIn(false);
    setUser(undefined);
    storeAuthState({ isLoggedIn: false });
    router.replace("/(auth)/login_main");
  }

  //auth context를 사용해서 모든 하위 컴포넌트에 상태를 전달하는 역할을 함
  return (
    <AuthContext.Provider value={{ isReady, isLoggedIn, user, logIn, logOut , updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}