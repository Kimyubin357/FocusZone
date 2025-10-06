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
import React, { useContext, useMemo, useState } from "react";
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

export default function SetUserInfo() {
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const { logIn } = useContext(AuthContext);

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

  // Firestore에 저장
  const saveUserProfile = async (finalNick: string) => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const email = auth.currentUser.email ?? "";

    const userData_for_firebase = {
      uid,
      email,
      nickname: finalNick,
      nicknameLower: finalNick.toLowerCase(),
      profileImage: "",
      provider: "email",
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", uid), userData_for_firebase);
    
    const userData = {
      uid,
      email,
      nickname: finalNick,
      profileImage: "",
      provider: "email" as const,
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
