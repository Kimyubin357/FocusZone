import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Alert, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from '../../components/Button';

// Firebase 및 Auth 관련
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import { AuthContext } from "../../src/services/auth/authContext";

// Google 로그인 (expo-auth-session)
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Apple 로그인 (expo-apple-authentication)
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();


export default function LoginMain() {
  const router = useRouter();
  const { logIn } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const checkUserDocAndNavigate = async (user: User) => {
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      // 1. 기존 사용자: Firestore에서 프로필 정보를 가져와 로그인 처리
      const userData = userDocSnap.data();
      // AuthContext의 logIn이 UserType을 기대하므로, 
      // Firestore 데이터가 UserType과 일치하는지 확인해야 합니다.
      console.log('[LoginMain] existing user found, logging in:', user.uid);
      logIn(userData as any); // (타입 캐스팅은 Firestore 데이터 구조에 맞게 조정)
      // 직접 보호된 화면으로 이동하여 레이아웃의 타이밍 문제를 피합니다.
      router.replace('/(protected)/(tabs)/(focus_zone)');
    } else {
      // 2. 신규 사용자: 닉네임 설정 화면으로 이동
      router.replace("/(auth)/set_user_info");
    }
  };

  // --- 1. Google 로그인 ---
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useIdTokenAuthRequest({
    // ‼️ .env 파일 등으로 관리하세요
    clientId: "374303258798-c1n9868e16b8j6sjasprocguoltpgaj6.apps.googleusercontent.com",
    androidClientId: "374303258798-jb4uvb1qb931ub00jntaod88509e2h5j.apps.googleusercontent.com",
  });

  useEffect(() => {
    const handleGoogleResponse = async (response: any) => {
      // 1. "success" 응답이 아니면 즉시 종료
      if (response?.type !== 'success') {
        if (response?.type === 'error') {
            console.log('Google Sign-In Error:', response.error);
            Alert.alert("로그인 오류", "Google 로그인 중 오류가 발생했습니다.");
        } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
            // ‼️ [수정] 사용자가 취소했으므로 로딩 상태를 반드시 해제합니다.
            console.log('Google Sign-In Canceled/Dismissed');
        }
        setLoading(false); // 👈 [수정] 'success'가 아닌 모든 경우에 로딩을 끈다
        return; 
      }

      // 2. "success" 응답이면, 로딩을 켜고 로그인 시도
      // ‼️ [수정] setLoading(true)는 handleGoogleLogin에서 이미 호출했으므로
      //    여기서는 중복 호출할 필요가 없습니다. (기존 코드와 동일)
      //    setLoading(true); 
      
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);

      try {
        const userCredential = await signInWithCredential(auth, credential);
        console.log('[LoginMain] signInWithCredential success:', userCredential.user.uid);
        await checkUserDocAndNavigate(userCredential.user);
        // 성공 후 안전하게 로딩 상태 해제
        setLoading(false);
      } catch (error: any) {
        console.error("Google Sign-In Error:", error);
        Alert.alert("로그인 실패", error.message);
        setLoading(false); // 👈 실패 시에는 로딩을 끈다
      }
    };
    
    // 🔽 [수정] !loading 조건을 제거하여 'cancel'이나 'error' 응답도 처리할 수 있게 합니다.
    if (googleResponse) {
      handleGoogleResponse(googleResponse);
    }
  }, [googleResponse]); // 👈 [수정] 의존성 배열에서 'loading'을 제거합니다.

  const handleGoogleLogin = () => {
    if (loading) return;
    setLoading(true);
    googlePromptAsync();
  };

  // --- 2. Apple 로그인 ---
  const handleAppleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken } = appleCredential;
      if (!identityToken) {
        throw new Error("Apple identityToken을 받지 못했습니다.");
      }

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
      });

      const userCredential = await signInWithCredential(auth, credential);
      await checkUserDocAndNavigate(userCredential.user);

    } catch (e: any) {
      if (e.code === 'ERR_CANCELED') {
        console.log("Apple login canceled");
      } else {
        console.error("Apple Sign-In Error:", e);
        Alert.alert("로그인 실패", "Apple 로그인 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- 3. Naver/Kakao (추후 구현) ---
  const handleNaverLogin = () => {
    if (loading) return;
    Alert.alert("준비 중", "네이버 로그인은 현재 준비 중입니다.");
    // console.log('Naver login')
  };

  const handleKakaoLogin = () => {
    if (loading) return;
    Alert.alert("준비 중", "카카오 로그인은 현재 준비 중입니다.");
    // console.log('Kakao login')
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>
        집중장소 {'\n'}
        시작해볼까요?
      </Text>

      <View style={styles.buttonContainer}>
        <CustomButton
          title="이메일로 계속하기"
          backgroundColor="#2196F3"
          onPress={() => router.push('/email_signup')}
          disabled={loading}
        />
        <Text style={styles.orText}>또는</Text>
        <CustomButton
          title="네이버로 계속하기"
          backgroundColor="#03C75A"
          onPress={handleNaverLogin} // ✅ 핸들러 연결
          disabled={loading}
        />
        <CustomButton
          title="카카오로 계속하기"
          backgroundColor="#FEE500"
          textColor="#000000"
          onPress={handleKakaoLogin} // ✅ 핸들러 연결
          disabled={loading}
        />
        <CustomButton
          title="Apple로 계속하기"
          backgroundColor="#000000"
          onPress={handleAppleLogin} // ✅ 핸들러 연결
          disabled={loading}
        />
        <CustomButton
          title="Google로 계속하기"
          backgroundColor="#F2F2F2"
          textColor="#000000"
          onPress={handleGoogleLogin} // ✅ 핸들러 연결
          disabled={loading}
        />
      </View>
      <Text style={styles.termsText}>
        계속하면, 개인정보 보호정책 및 이용약관에 동의하게 됩니다
      </Text>
    </SafeAreaView>
  );
}; // ✅ 컴포넌트 종료

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 350,
  },
  orText: {
    textAlign: 'center',
    marginVertical: 15,
    fontSize: 16,
    color: '#888',
  },
  termsText: {
    marginTop: 20,
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});

