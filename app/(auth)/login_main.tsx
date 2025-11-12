import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
// Firebase 및 Auth 관련
import {
  GoogleAuthProvider,
  signInWithCredential,
  User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import { AuthContext } from "../../src/services/auth/authContext";

// Google 로그인 (expo-auth-session)
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 상단 타이틀 영역 */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>
          집중장소 {'\n'}
          시작해볼까요?
        </Text>
      </View>

      {/* 하단 버튼 및 약관 영역 */}
      <View style={styles.bottomContainer}>
        <View style={styles.buttonContainer}>
          {/* 이메일로 계속하기 버튼 */}
          <TouchableOpacity
            style={[styles.button, styles.emailButton]}
            onPress={() => router.push('/email_signup')}
            disabled={loading}
          >
            <Ionicons
              name="mail-outline"
              size={22}
              color="white"
              style={styles.icon}
            />
            <Text style={[styles.buttonText, styles.emailButtonText]}>
              이메일로 계속하기
            </Text>
          </TouchableOpacity>

          <Text style={styles.orText}>또는</Text>

          {/* Google로 계속하기 버튼 */}
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Ionicons
              name="logo-google"
              size={22}
              color="black"
              style={styles.icon}
            />
            <Text style={[styles.buttonText, styles.googleButtonText]}>
              Google로 계속하기
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.termsText}>
          계속하면, 개인정보 보호정책 및 이용약관에 동의하게 됩니다
        </Text>
      </View>
    </SafeAreaView>
  );
}; // ✅ 컴포넌트 종료

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    // ✅ 화면을 상단/하단으로 나누기 위해 space-between 사용
    justifyContent: 'space-between',
    paddingVertical: 20, // 위아래 여백 추가
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center', // 제목을 중앙(세로)으로
    alignItems: 'center', // 제목을 중앙(가로)으로
    paddingTop: 40, // 상단 여백 추가
  },
  title: {
    fontSize: 36, // 폰트 크기 조절
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 50, // 줄 간격 조절
  },
  bottomContainer: {
    paddingBottom: 20, // 하단 여백
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center', // 가로 중앙 정렬
  },
  orText: {
    textAlign: 'center',
    marginVertical: 15,
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  termsText: {
    marginTop: 25, // 버튼 영역과의 간격
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  // --- ✅ 새로운 버튼 스타일 ---
  button: {
    flexDirection: 'row', // 아이콘과 텍스트를 가로로 배열
    alignItems: 'center',
    justifyContent: 'center', // 내용을 중앙 정렬
    height: 50,
    borderRadius: 25, // 둥근 모서리
    paddingHorizontal: 20,
    width: '100%',
  },
  icon: {
    marginRight: 12, // 아이콘과 텍스트 사이 간격
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600', // 텍스트 굵기
  },
  // 이메일 버튼
  emailButton: {
    backgroundColor: '#2196F3',
  },
  emailButtonText: {
    color: '#FFFFFF',
  },
  // 구글 버튼
  googleButton: {
    backgroundColor: '#F2F2F2',
    // 얇은 테두리 추가
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  googleButtonText: {
    color: '#000000',
  },
});

