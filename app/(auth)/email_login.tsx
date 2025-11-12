import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from "firebase/firestore";
import React, { useContext, useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from '../../firebaseConfig';
import { AuthContext } from '../../src/services/auth/authContext';

// 앱 테마 색상 정의
const THEME_COLOR = "#0D4093";

export default function EmailLogin() {
  const router = useRouter();
  const { logIn } = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  
  // ✅ 로딩 및 포커스 상태 추가
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    // 비밀번호 유효성 검사 (로그인 시에는 8자가 아닐 수 있으므로, 0자 초과로 변경)
    const passwordValid = password.length > 0;
    setIsPasswordValid(passwordValid);

    // 이메일 유효성 검사
    const emailValid = /\S+@\S+\.\S+/.test(email);
    setIsEmailValid(emailValid);

    // 전체 폼 유효성 검사
    setIsFormValid(passwordValid && emailValid);
  }, [email, password]);

  const handleContinue = async () => {
    if (!isFormValid || loading) return;
    setLoading(true); // ✅ 로딩 시작

    try {
      // 1. Firebase Auth 로그인 시도
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const { uid } = userCredential.user;

      // 2. Firestore에서 uid로 사용자 문서 불러오기
      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        Alert.alert("오류", "사용자 정보가 존재하지 않습니다.");
        setLoading(false); // ✅ 로딩 중지
        return;
      }

      const userData = userSnap.data();

      // 3. AuthContext로 전달
      logIn({
        uid,
        email: userData.email,
        nickname: userData.nickname,
        profileImage: userData.profileImage || "",
        provider: "email",
      });

      // 성공 시 AuthContext의 onAuthStateChanged가 라우팅 처리
    } catch (error: any) {
      let errorMessage = "이메일 또는 비밀번호를 확인해주세요.";
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = "유효하지 않은 이메일 형식입니다.";
          break;
        case 'auth/user-not-found':
          errorMessage = "해당 이메일로 등록된 사용자가 없습니다.";
          break;
        case 'auth/invalid-credential':
          errorMessage = "이메일 또는 비밀번호가 일치하지 않습니다.";
          break;
        default:
          console.log("Login Error:", error.code, error.message);
      }
      Alert.alert("로그인 오류", errorMessage);
    } finally {
      setLoading(false); // ✅ 로딩 종료
    }
  };

  const handleDismissKeyboard = () => Keyboard.dismiss();

  return (
    <TouchableWithoutFeedback onPress={handleDismissKeyboard} accessible={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
        {/* ✅ KeyboardAvoidingView가 전체를 감싸고 space-between으로 정렬 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          {/* 상단 (헤더, 폼) */}
          <View style={styles.topContainer}>
            <Text style={styles.title}>이메일로 로그인</Text>

            <View style={styles.inputContainer}>
              {/* 이메일 Input */}
              <View style={[
                styles.inputWrapper,
                { borderColor: emailFocused ? THEME_COLOR : "#E0E0E0" }
              ]}>
                <Ionicons
                  style={styles.icon}
                  name='mail-outline'
                  size={22}
                  color={emailFocused ? THEME_COLOR : "grey"}
                />
                <TextInput
                  style={styles.input}
                  placeholder="이메일"
                  placeholderTextColor={'grey'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>

              {/* 비밀번호 Input */}
              <View style={[
                styles.inputWrapper,
                { borderColor: passwordFocused ? THEME_COLOR : "#E0E0E0" }
              ]}>
                <Ionicons
                  style={styles.icon}
                  name='lock-closed-outline'
                  size={22}
                  color={passwordFocused ? THEME_COLOR : "grey"}
                />
                <TextInput
                  style={styles.input}
                  placeholder="암호"
                  placeholderTextColor={'grey'}
                  secureTextEntry={!isPasswordVisible}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  style={styles.passwordVisibilityToggle}
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  <Ionicons name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color="grey" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 암호 잊음 */}
            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => router.push('/email_forget_pwd')}
            >
              {/* ✅ 스타일 변경 */}
              <Text style={styles.forgotPasswordText}>
                암호를 잊으셨나요?
              </Text>
            </TouchableOpacity>

          </View>

          {/* 하단 (버튼) */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                // ✅ 테마 색상 및 로딩 상태 적용
                { backgroundColor: isFormValid && !loading ? THEME_COLOR : '#ccc' }
              ]}
              onPress={handleContinue}
              disabled={!isFormValid || loading}
              activeOpacity={0.7}
            >
              {/* ✅ 로딩 텍스트 변경 */}
              <Text style={styles.continueButtonText}>
                {loading ? "로그인 중..." : "계속하기"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

// ✅ 'email_signup.tsx'와 동일한 스타일 구조 사용
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between', // 상단/하단 분리
  },
  topContainer: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    marginTop: 60,
  },
  inputContainer: {
    width: '100%',
    maxWidth: 350,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 25, // pill-shape
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 50, //
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#000000',
    fontSize: 16,
  },
  passwordVisibilityToggle: {
    padding: 5,
  },
  // ✅ '암호 잊음' 스타일
  forgotPasswordContainer: {
    marginTop: 15,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: THEME_COLOR,
    fontWeight: 'bold',
  },
  // ---
  buttonContainer: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
    paddingBottom: 20, // 하단 여백
  },
  continueButton: {
    width: '100%',
    height: 50, //
    borderRadius: 25, // pill-shape
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});