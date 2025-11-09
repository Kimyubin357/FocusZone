// src/services/auth/authContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { createContext, PropsWithChildren, useEffect, useState } from "react";
import { NativeModules } from "react-native"; // 🚨 [수정 1] NativeModules 임포트

// 네이티브 모듈 접근
const { BlockedApps } = NativeModules;

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

  // 🚨 [수정 2] 로그아웃 시 삭제할 모든 키 정의
  const allUserStorageKeys = [
    authStorageKey,
    "personalFocusPlaces",  // 개인 장소 키
    "groupfocusPlaces",     // 그룹 장소 키
    "groupSyncStatus",      // 그룹 동기화 상태 키
    "currentLockState",     // 현재 잠금 상태 키
    "categorizedInstalledApps", // 앱 카테고리 맵 키
    
  ];

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
  const logOut = async () => {
    try {
      // 1. 네이티브 모듈을 호출하여 앱 잠금 즉시 해제
      if (BlockedApps) {
        await BlockedApps.setBlockedApps([]);
        console.log("[AuthContext] Apps unlocked.");
      }
    } catch (e) {
      console.error("[AuthContext] Failed to unlock apps:", e);
    }

    try {
      // 2. 정의된 모든 키를 AsyncStorage에서 한 번에 삭제
      await AsyncStorage.multiRemove(allUserStorageKeys);
      console.log("[AuthContext] All user data cleared from AsyncStorage.");
    } catch (e) {
      console.error("[AuthContext] Failed to clear AsyncStorage:", e);
    }

    // 3. React 상태 업데이트
    setIsLoggedIn(false);
    setUser(undefined);

    // 4. 로그인 페이지로 이동
    router.replace("/(auth)/login_main");
  };

  //auth context를 사용해서 모든 하위 컴포넌트에 상태를 전달하는 역할을 함
  return (
    <AuthContext.Provider value={{ isReady, isLoggedIn, user, logIn, logOut , updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}