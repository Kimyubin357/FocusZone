// app/(contexts)/join.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  DocumentData, // [추가] 타입 임포트
  DocumentSnapshot,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput, // [추가]
  TouchableOpacity, // [추가]
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";

export default function JoinGroupPage() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  // --- [추가] UI 상태 관리 ---
  const [status, setStatus] = useState("초대 코드를 확인하는 중입니다...");
  const [isLoading, setIsLoading] = useState(true);
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [groupToJoin, setGroupToJoin] =
    useState<DocumentSnapshot<DocumentData> | null>(null);
  const [nickname, setNickname] = useState("");
  // ---

  useEffect(() => {
    // 딥링크 코드가 없으면 바로 리디렉션
    if (!code) {
      Alert.alert("오류", "초대 코드가 올바르지 않습니다.", [
        {
          text: "확인",
          onPress: () =>
            router.replace("/(protected)/(tabs)/(group_zone)/group_zone"),
        },
      ]);
      return;
    }

    // [수정] 인증 상태 리스너
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        unsubscribe(); // 한번만 실행되도록 리스너 해제
        processInvitation(user.uid); // 로그인된 유저 UID 전달
      } else {
        // 로그인 되어 있지 않다면 로그인 페이지로 보냄
        Alert.alert("로그인 필요", "그룹에 참여하려면 로그인이 필요합니다.", [
          {
            text: "확인",
            onPress: () => router.replace("/(auth)/login_main"),
          },
        ]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, router]);

  // [수정] 1. 그룹 정보 확인 로직
  const processInvitation = async (uid: string) => {
    try {
      setStatus("그룹 정보를 찾는 중입니다...");
      setIsLoading(true);

      // 2. 초대 코드로 그룹 찾기
      const groupLocationsRef = collection(db, "groupLocations");
      const q = query(groupLocationsRef, where("inviteCode", "==", code));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error("해당 초대 코드를 가진 그룹을 찾을 수 없습니다.");
      }

      const groupDoc = snapshot.docs[0];
      const groupId = groupDoc.id;

      // 3. 이미 멤버인지 확인
      const memberRef = doc(db, "groupLocations", groupId, "members", uid);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        Alert.alert("알림", "이미 참여하고 있는 그룹입니다.", [
          {
            text: "확인",
            onPress: () =>
              router.replace("/(protected)/(tabs)/(group_zone)/group_zone"),
          },
        ]);
        return;
      }

      // [수정] 4. 닉네임 입력을 위해 상태 업데이트
      const userProfileSnap = await getDoc(doc(db, "users", uid));
      const displayName =
        userProfileSnap.data()?.displayName ??
        auth.currentUser?.displayName ??
        "새 멤버";

      setNickname(displayName); // 기본 닉네임 설정
      setGroupToJoin(groupDoc); // 가입할 그룹 정보 저장
      setStatus(`'${groupDoc.data().groupName}' 그룹 참여`);
      setIsLoading(false);
      setShowNicknameInput(true); // 닉네임 입력 UI 표시
    } catch (error: any) {
      console.error("그룹 확인 중 오류:", error);
      setStatus("오류가 발생했습니다.");
      Alert.alert("오류", error.message ?? "그룹 정보를 불러오지 못했습니다.", [
        {
          text: "확인",
          onPress: () =>
            router.replace("/(protected)/(tabs)/(group_zone)/group_zone"),
        },
      ]);
    }
  };

  // [추가] 2. 닉네임 입력 후 실제 가입 로직
  const handleConfirmJoin = async () => {
    const user = auth.currentUser;
    if (!user || !groupToJoin) return; // 유저나 그룹 정보가 없으면 중단
    if (!nickname.trim()) {
      Alert.alert("알림", "사용할 닉네임을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setShowNicknameInput(false);
    setStatus("그룹에 참여하는 중입니다...");

    try {
      const groupId = groupToJoin.id;
      const memberRef = doc(db, "groupLocations", groupId, "members", user.uid);

      const batch = writeBatch(db);

      // [수정] members 서브 컬렉션에 문서 추가 (요청사항 반영)
      batch.set(memberRef, {
        role: "member",
        uid: user.uid,
        groupNickname: nickname.trim(), // [수정] 입력받은 닉네임
        joinedAt: serverTimestamp(),
        status: "inactive", // [추가] 초기 상태
      });

      // groupLocations 문서의 memberCount 1 증가
      batch.update(groupToJoin.ref, {
        memberCount: increment(1),
      });

      await batch.commit();

      Alert.alert("환영합니다!", "그룹에 성공적으로 참여했습니다.", [
        {
          text: "확인",
          onPress: () =>
            router.replace("/(protected)/(tabs)/(group_zone)/group_zone"),
        },
      ]);
    } catch (error) {
      console.error("그룹 참여 중 오류:", error);
      setStatus("오류가 발생했습니다.");
      Alert.alert("오류", "그룹 참여 중 문제가 발생했습니다. 다시 시도해주세요.", [
        {
          text: "확인",
          onPress: () =>
            router.replace("/(protected)/(tabs)/(group_zone)/group_zone"),
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 로딩 중이거나 닉네임 입력창이 아닐 때 */}
        {isLoading && (
          <>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.statusText}>{status}</Text>
          </>
        )}

        {/* 닉네임 입력창 표시 */}
        {showNicknameInput && groupToJoin && (
          <View style={styles.inputContainer}>
            <Text style={styles.title}>
              '{groupToJoin.data().groupName}' 그룹
            </Text>
            <Text style={styles.label}>그룹에서 사용할 닉네임을 입력하세요</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="닉네임"
              autoFocus
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleConfirmJoin}
            >
              <Text style={styles.buttonText}>참여하기</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  statusText: {
    marginTop: 20,
    fontSize: 16,
    color: "#4B5563",
  },
  // [추가] 닉네임 입력 UI 스타일
  inputContainer: {
    width: "100%",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
    marginBottom: 20,
  },
  button: {
    width: "100%",
    height: 52,
    backgroundColor: "#2563EB",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});