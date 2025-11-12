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

// 앱 테마 색상 정의
const THEME_COLOR = "#0D4093";

export default function SetUserInfo() {
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const { logIn } = useContext(AuthContext);

  // ✅ Input 포커스 상태 추가
  const [nicknameFocused, setNicknameFocused] = useState(false);

  // UserType의 provider 타입을 정의
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
    if (firebaseProviderId === "password") return "email";
    return "email";
  };

  // Firestore에 저장
  const saveUserProfile = async (finalNick: string) => {
    if (!auth.currentUser) {
      console.error("No authenticated user found!");
      return;
    }

    const { uid, email, photoURL } = auth.currentUser;
    const firebaseProviderId =
      auth.currentUser.providerData[0]?.providerId || "password";
    const appProvider = getAppProvider(firebaseProviderId);

    const userData_for_firebase = {
      uid,
      email: email ?? "",
      nickname: finalNick,
      nicknameLower: finalNick.toLowerCase(),
      profileImage: photoURL || "",
      provider: appProvider,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", uid), userData_for_firebase);

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
    if (loading || !nicknameValid) {
      Alert.alert(
        "닉네임 확인",
        "닉네임은 2~12자, 한글/영문/숫자/밑줄(_)만 가능합니다."
      );
      return;
    }

    setLoading(true);
    const trimmedNick = nickname.trim();
    try {
      const available = await checkNicknameDuplicate(trimmedNick);
      if (!available) {
        Alert.alert("중복 닉네임", "이미 사용 중인 닉네임입니다.");
        setLoading(false); // ✅ 중복 시 로딩 중지
        return;
      }

      const userData = await saveUserProfile(trimmedNick);
      logIn(userData!);
    } catch (e) {
      console.log("닉네임 저장 오류:", e);
      Alert.alert("오류", "닉네임 저장에 실패했습니다.");
      setLoading(false); // ✅ 에러 시 로딩 중지
    }
    // setLoading(false)는 성공 시 logIn -> 라우팅 후 필요 없음
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

  // 안드로이드 뒤로가기 버튼 방지
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        return true; // 뒤로가기 막기
      }
    );
    return () => backHandler.remove();
  }, []);

  return (
    <TouchableWithoutFeedback onPress={handleDismissKeyboard} accessible={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        {/* ✅ 'space-between' 레이아웃 적용 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          {/* 상단 (헤더, 폼) */}
          <View style={styles.topContainer}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleExit} style={styles.closeButton}>
                <Ionicons name="close-outline" size={30} color="black" />
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>누구라고 해야 할까요?</Text>

            {/* ✅ Input 스타일 수정 (포커스 적용) */}
            <View style={[
              styles.inputWrapper,
              { borderBottomColor: nicknameFocused ? THEME_COLOR : '#ccc' }
            ]}>
              <TextInput
                style={styles.input}
                placeholder="닉네임 (2~12자, 한글/영문/숫자/_)"
                placeholderTextColor="grey"
                autoCapitalize="none"
                value={nickname}
                onChangeText={setNickname}
                returnKeyType="done"
                onFocus={() => setNicknameFocused(true)}
                onBlur={() => setNicknameFocused(false)}
              />
            </View>

            {!nicknameValid && nickname.length > 0 && (
              <Text style={styles.errorText}>
                닉네임은 2~12자, 한글/영문/숫자/밑줄(_)만 가능합니다.
              </Text>
            )}
          </View>

          {/* 하단 (버튼) */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton, // ✅ 'pill-shape' 적용
                {
                  backgroundColor: nicknameValid && !loading ? THEME_COLOR : "#ccc", // ✅ 테마 색상 적용
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

// ✅ 스타일 수정
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20, // 가로 여백
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
  header: {
    width: '100%',
    alignItems: 'flex-start', // 'X' 버튼을 왼쪽으로
    marginTop: 10,
  },
  closeButton: {
    padding: 10, // 터치 영역 확보
  },
  title: {
    fontSize: 32, // 타이틀 크기 통일
    fontWeight: "bold",
    marginTop: 40,
    marginBottom: 50, // 인풋과의 간격
    textAlign: "center",
  },
  inputWrapper: {
    borderBottomWidth: 2, // 굵기 조절
    borderBottomColor: "#ccc",
    width: '100%',
    maxWidth: 350,
    marginBottom: 10,
  },
  input: {
    fontSize: 18,
    paddingVertical: 12,
    height: 50, // 높이 확보
    textAlign: 'center', // 닉네임은 중앙 정렬
  },
  errorText: {
    color: "red",
    fontSize: 13,
    textAlign: 'center',
    width: '100%',
    maxWidth: 350,
    marginTop: 5,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
    paddingBottom: 20, // 하단 여백
  },
  continueButton: {
    width: "100%",
    height: 50, // 'pill-shape' 높이
    borderRadius: 25, // 'pill-shape' 둥근 모서리
    alignItems: "center",
    justifyContent: 'center',
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16, // 폰트 크기 통일
    fontWeight: "bold",
  },
});