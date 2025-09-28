import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import React, { useContext, useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { AuthContext } from "../../src/services/auth/authContext";

export default function EmailSignUp() {
  const router = useRouter();
  const { logIn } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 닉네임 규칙: 2~12자, 한글/영문/숫자/밑줄
  const nicknameValid = useMemo(
    () => /^[\p{Script=Hangul}A-Za-z0-9_]{2,12}$/u.test(nickname.trim()),
    [nickname]
  );

  useEffect(() => {
    const passwordValid = password.length >= 8; // UI 기준 8자 이상
    setIsPasswordValid(passwordValid);

    const emailValid = /\S+@\S+\.\S+/.test(email);
    setIsEmailValid(emailValid);

    setIsFormValid(passwordValid && emailValid && nicknameValid);
  }, [email, password, nicknameValid]);

  const getPasswordIndicatorColor = () => {
    if (password.length === 0) return "#ccc";
    return isPasswordValid ? "green" : "red";
  };

  // 닉네임 중복 검사
  const checkNicknameDuplicate = async (name: string) => {
    const q = query(
      collection(db, "users"),
      where("nicknameLower", "==", name.toLowerCase())
    );
    const snap = await getDocs(q);
    return snap.empty; // 비어있으면 사용 가능
  };

  const handleContinue = async () => {
    if (!isFormValid || loading) return;

    const trimmedNick = nickname.trim();
    if (!nicknameValid || trimmedNick.length === 0) {
      Alert.alert(
        "닉네임 확인",
        "닉네임은 2~12자, 한글/영문/숫자/밑줄(_)만 가능합니다."
      );
      return;
    }

    setLoading(true);
    try {
      // 1) 닉네임 중복 검사
      const available = await checkNicknameDuplicate(trimmedNick);
      if (!available) {
        setLoading(false);
        Alert.alert(
          "중복 닉네임",
          "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요."
        );
        return;
      }

      // 2) Auth 회원가입
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // 3) Auth displayName 업데이트(선택이지만 있으면 편리)
      await updateProfile(cred.user, { displayName: trimmedNick });

      // 4) Firestore에 프로필 문서 생성 (users/{uid})
      const uid = cred.user.uid;
      await setDoc(doc(db, "users", uid), {
        uid,
        email: cred.user.email,
        nickname: trimmedNick,
        nicknameLower: trimmedNick.toLowerCase(),
        createdAt: serverTimestamp(),
      });

      setErrorMessage(null);

      // onAuthStateChanged 흐름을 쓰는 앱 구조라면 이 호출로 트리거
      logIn();
      // 또는 라우팅을 직접 하고 싶다면:
      // router.replace('/(protected)/(tabs)/(focus_zone)');
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
          // Firebase 기본 기준은 6자 이상이지만, 이 화면은 8자 기준으로 안내 중
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

  const handleDismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback
      onPress={handleDismissKeyboard}
      accessible={false}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <Text style={styles.title}>이메일로 가입</Text>

          <View style={styles.inputContainer}>
            {/* 이메일 */}
            <View style={styles.inputWrapper}>
              <Ionicons style={styles.icon} name="mail-outline" size={24} />
              <TextInput
                style={styles.input}
                placeholder="이메일"
                placeholderTextColor="grey"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* 닉네임 */}
            <View style={styles.inputWrapper}>
              <Ionicons style={styles.icon} name="person-outline" size={24} />
              <TextInput
                style={styles.input}
                placeholder="닉네임 (2~12자, 한글/영문/숫자/_)"
                placeholderTextColor="grey"
                autoCapitalize="none"
                value={nickname}
                onChangeText={setNickname}
                returnKeyType="done"
              />
            </View>
            {!nicknameValid && nickname.length > 0 && (
              <Text style={{ color: "red", marginBottom: 8 }}>
                닉네임 형식이 올바르지 않습니다.
              </Text>
            )}

            {/* 비밀번호 */}
            <View style={styles.inputWrapper}>
              <Ionicons
                style={styles.icon}
                name="lock-closed-outline"
                size={24}
              />
              <TextInput
                style={styles.input}
                placeholder="암호 (최소 8자)"
                placeholderTextColor="grey"
                secureTextEntry={!isPasswordVisible}
                value={password}
                onChangeText={setPassword}
              />
              <Text
                style={[
                  styles.passwordIndicator,
                  { color: getPasswordIndicatorColor() },
                ]}
              >
                {password.length}/8
              </Text>
              <TouchableOpacity
                style={styles.passwordVisibilityToggle}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              >
                <Ionicons
                  name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                  size={24}
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
              <Text style={styles.loginLink}>로그인</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                {
                  backgroundColor: isFormValid && !loading ? "#2196F3" : "#ccc",
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    padding: 20,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontSize: 40,
    fontWeight: "bold",
    marginBottom: 40,
    marginTop: 100,
  },
  inputContainer: {
    width: "100%",
    maxWidth: 350,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 17,
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
  },
  passwordIndicator: {
    fontSize: 14,
    fontWeight: "bold",
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
    color: "#2196F3",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 350,
    marginTop: "auto",
  },
  continueButton: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
