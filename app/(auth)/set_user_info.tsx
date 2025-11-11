//  app/(auth)/set_user_info.tsx
import { Ionicons } from "@expo/vector-icons";
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
  BackHandler,
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

export default function SetUserInfo() {
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const { logIn } = useContext(AuthContext);

  // UserType의 provider 타입을 정의 (AuthContext와 동일하게)
  type AppProvider = "google" | "naver" | "kakao" | "apple" | "email";

  // 닉네임 규칙 검사
  const nicknameValid = useMemo(
    () => /^[\p{Script=Hangul}A-Za-z0-9_]{2,12}$/u.test(nickname.trim()),
    [nickname]
  );

  // 닉네임 중복 검사
  const checkNicknameDuplicate = async (name: string) => {
    const q = query(
      collection(db, "users"),
      where("nicknameLower", "==", name.toLowerCase())
    );
    const snap = await getDocs(q);
    return snap.empty; // true면 사용 가능
  };

  const handleDismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // 자동 닉네임 생성 (X 버튼 누를 때)
  const generateAutoNickname = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `user${randomNum}`;
  };

  const getAppProvider = (firebaseProviderId: string): AppProvider => {
    if (firebaseProviderId.includes("google.com")) return "google";
    if (firebaseProviderId.includes("apple.com")) return "apple";

    // 이메일/비밀번호 가입 시 providerId는 "password"입니다.
    if (firebaseProviderId === "password") return "email";

    // (추후 Kakao/Naver 구현 시)
    // if (firebaseProviderId === "kakao.com") return "kakao";
    // if (firebaseProviderId === "naver.com") return "naver";

    // 기본값 (이메일 가입으로 처리)
    return "email";
  };
  // Firestore에 저장
  const saveUserProfile = async (finalNick: string) => {
    if (!auth.currentUser) {
      console.error("No authenticated user found!");
      return;
    }

    const { uid, email, photoURL } = auth.currentUser;

    // Firebase Auth에서 실제 providerId를 가져옵니다. (예: "google.com", "password")
    const firebaseProviderId = auth.currentUser.providerData[0]?.providerId || "password";

    // 앱에서 사용할 provider 타입으로 변환합니다. (예: "google", "email")
    const appProvider = getAppProvider(firebaseProviderId);

    const userData_for_firebase = {
      uid,
      email: email ?? "", // 소셜 로그인은 이메일이 null일 수 있음 (특히 Apple)
      nickname: finalNick,
      nicknameLower: finalNick.toLowerCase(),
      profileImage: photoURL || "", // 소셜 로그인 프로필 사진 활용
      provider: appProvider, // "email", "google.com", "apple.com", "kakao.com" 등
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", uid), userData_for_firebase);

    // AuthContext에 전달할 데이터
    const userData = {
      uid,
      email: email ?? "",
      nickname: finalNick,
      profileImage: photoURL || "",
      provider: appProvider,
    };
    return userData;
  };

  const handleContinue = async () => {
    if (loading) return;

    const trimmedNick = nickname.trim();
    if (!nicknameValid) {
      Alert.alert(
        "닉네임 확인",
        "닉네임은 2~12자, 한글/영문/숫자/밑줄(_)만 가능합니다."
      );
      return;
    }

    setLoading(true);
    try {
      const available = await checkNicknameDuplicate(trimmedNick);
      if (!available) {
        Alert.alert("중복 닉네임", "이미 사용 중인 닉네임입니다.");
        return;
      }

      const userData = await saveUserProfile(trimmedNick);
      logIn(userData!);
    } catch (e) {
      console.log("닉네임 저장 오류:", e);
      Alert.alert("오류", "닉네임 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async () => {
    const autoNick = generateAutoNickname();
    try {
      const userData = await saveUserProfile(autoNick);
      logIn(userData!);

    } catch (e) {
      console.log("자동 닉네임 저장 오류:", e);
    }
  };
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // 이 화면에서는 뒤로가기를 항상 막습니다.
        // true를 반환하면 기본 동작(앱 종료 등)을 막습니다.
        return true; 
      }
    );

    // 컴포넌트가 사라질 때 리스너를 제거합니다.
    return () => backHandler.remove();
  }, []); // 빈 배열로 마운트 시 1회만 실행

  return (
    <TouchableWithoutFeedback onPress={handleDismissKeyboard} accessible={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleExit}>
              <Ionicons name="close-outline" size={30} color="black" />
            </TouchableOpacity>
          </View>

          {/* 제목 */}
          <Text style={styles.title}>누구라고 해야 할까요?</Text>

          {/* 입력창 */}
          <View style={styles.inputWrapper}>
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

          {/* 경고문구 */}
          {!nicknameValid && nickname.length > 0 && (
            <Text style={styles.errorText}>
              닉네임은 2~12자, 한글/영문/숫자/밑줄(_)만 가능합니다.
            </Text>
          )}

          {/* 버튼 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                {
                  backgroundColor: nicknameValid && !loading ? "#2196F3" : "#ccc",
                },
              ]}
              onPress={handleContinue}
              disabled={!nicknameValid || loading}
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
    padding: 20,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    alignItems: "flex-start",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 40,
    marginBottom: 30,
    textAlign: "center",
  },
  inputWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginHorizontal: 20,
    marginBottom: 10,
  },
  input: {
    fontSize: 18,
    paddingVertical: 10,
  },
  errorText: {
    color: "red",
    fontSize: 13,
    marginLeft: 20,
    marginBottom: 10,
  },
  buttonContainer: {
    marginTop: "auto",
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  continueButton: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
