import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebaseConfig";

// 앱 테마 색상 정의
const THEME_COLOR = "#0D4093";

export default function EmailSignUp() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ Input 포커스 상태 추가
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    const passwordValid = password.length >= 8;
    setIsPasswordValid(passwordValid);

    const emailValid = /\S+@\S+\.\S+/.test(email);
    setIsEmailValid(emailValid);

    setIsFormValid(passwordValid && emailValid);
  }, [email, password]);

  const handleContinue = async () => {
    if (!isFormValid || loading) return;
    setLoading(true);

    try {
      await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      setErrorMessage(null);
      // set_user_info.tsx 화면으로 이동
      router.push("/(auth)/set_user_info");
    } catch (error: any) {
      let msg = "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      switch (error.code) {
        case "auth/email-already-in-use":
          msg = "이미 가입된 이메일 주소입니다.";
          break;
        case "auth/invalid-email":
          msg = "유효하지 않은 이메일 형식입니다.";
          break;
        case "auth/weak-password":
          msg = "비밀번호는 최소 8자 이상이어야 합니다.";
          break;
        default:
          console.log("Firebase Signup Error:", error.code, error.message);
          break;
      }
      setErrorMessage(msg);
      Alert.alert("회원가입 오류", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissKeyboard = () => Keyboard.dismiss();

  return (
    <TouchableWithoutFeedback onPress={handleDismissKeyboard} accessible={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
          {/* 상단 (헤더, 폼) */}
          <View style={styles.topContainer}>
            

            <Text style={styles.title}>이메일로 가입</Text>

            <View style={styles.inputContainer}>
              {/* 이메일 */}
              <View
                style={[
                  styles.inputWrapper,
                  // ✅ 포커스 스타일에 따라 borderColor 변경
                  {
                    borderColor: emailFocused ? THEME_COLOR : "#E0E0E0",
                  },
                ]}
              >
                <Ionicons
                  style={styles.icon}
                  name="mail-outline"
                  size={22}
                  color={emailFocused ? THEME_COLOR : "grey"}
                />
                <TextInput
                  style={styles.input}
                  placeholder="이메일"
                  placeholderTextColor="grey"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)} // ✅ 포커스 이벤트
                  onBlur={() => setEmailFocused(false)} // ✅ 블러 이벤트
                />
              </View>

              {/* 비밀번호 */}
              <View
                style={[
                  styles.inputWrapper,
                  {
                    borderColor: passwordFocused ? THEME_COLOR : "#E0E0E0",
                  },
                ]}
              >
                <Ionicons
                  style={styles.icon}
                  name="lock-closed-outline"
                  size={22}
                  color={passwordFocused ? THEME_COLOR : "grey"}
                />
                <TextInput
                  style={styles.input}
                  placeholder="암호 (최소 8자)"
                  placeholderTextColor="grey"
                  secureTextEntry={!isPasswordVisible}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)} // ✅ 포커스 이벤트
                  onBlur={() => setPasswordFocused(false)} // ✅ 블러 이벤트
                />
                {/* ✅ 비밀번호 유효성 검사 아이콘으로 변경 */}
                {password.length > 0 && (
                  <Ionicons
                    name={
                      isPasswordValid
                        ? "checkmark-circle-outline"
                        : "close-circle-outline"
                    }
                    size={22}
                    color={isPasswordValid ? "green" : "red"}
                    style={styles.passwordIndicatorIcon}
                  />
                )}
                <TouchableOpacity
                  style={styles.passwordVisibilityToggle}
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  <Ionicons
                    name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="grey"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <TouchableOpacity
              style={styles.loginTextContainer}
              onPress={() => router.push("/email_login")}
            >
              <Text style={styles.loginText}>
                <Text style={styles.loginPrompt}>계정이 있으신가요? </Text>
                {/* ✅ 로그인 링크 색상 변경 */}
                <Text style={styles.loginLink}>로그인</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* 하단 (버튼) */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                // ✅ 활성화 시 테마 색상 적용
                {
                  backgroundColor:
                    isFormValid && !loading ? THEME_COLOR : "#ccc",
                },
              ]}
              onPress={handleContinue}
              disabled={!isFormValid || loading}
              activeOpacity={0.7}
            >
              <Text style={styles.continueButtonText}>
                {loading ? "처리 중..." : "계속하기"}
              </Text>
            </TouchableOpacity>
          </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20, // 가로 여백
  },
  keyboardAvoidingView: {
    flex: 1,
    width: "100%",
    // ✅ 상단과 하단을 분리
    justifyContent: "space-between",
  },
  topContainer: {
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontSize: 32, // 폰트 크기 조절
    fontWeight: "bold",
    marginBottom: 40,
    marginTop: 60, // 뒤로가기 버튼 공간 확보
  },
  inputContainer: {
    width: "100%",
    maxWidth: 350,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    // ✅ 테두리 굵기
    borderWidth: 1.5,
    borderColor: "#E0E0E0", // 기본 테두리 색상
    // ✅ borderRadius 25로 변경
    borderRadius: 25,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 50,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#000",
    fontSize: 16,
  },
  // ✅ 비밀번호 유효성 검사 아이콘 스타일
  passwordIndicatorIcon: {
    marginRight: 10,
  },
  passwordVisibilityToggle: {
    padding: 5,
  },
  errorText: {
    color: "red",
    fontSize: 14,
    marginVertical: 8,
    textAlign: "center",
  },
  loginTextContainer: {
    marginTop: 20,
  },
  loginText: {
    textAlign: "center",
  },
  loginPrompt: {
    fontSize: 14,
    color: "#888",
  },
  loginLink: {
    fontSize: 14,
    // ✅ 테마 색상 적용
    color: THEME_COLOR,
    fontWeight: "bold",
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 350,
    alignSelf: "center", // 하단 버튼 중앙 정렬
    paddingTop: 270, // 하단 여백
  },
  continueButton: {
    width: "100%",
    // ✅ 높이 50px로 고정
    height: 50,
    // ✅ borderRadius 25로 변경
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center", // 텍스트 중앙 정렬
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});