// app/(contexts)/join.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";

export default function JoinGroupPage() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [status, setStatus] = useState("초대 코드를 확인하는 중입니다...");

  useEffect(() => {
    // 딥링크 코드가 없으면 바로 리디렉션
    if (!code) {
      Alert.alert("오류", "초대 코드가 올바르지 않습니다.", [
        { text: "확인", onPress: () => router.replace("/(protected)/(tabs)/(group_zone)/group_zone") },
      ]);
      return;
    }

    const processInvitation = async () => {
      // 1. 로그인 상태 확인
      const user = auth.currentUser;
      if (!user) {
        // 나중에 로그인 후 돌아오게 하려면 async-storage에 code를 저장해두는 로직 추가 가능
        Alert.alert("로그인 필요", "그룹에 참여하려면 로그인이 필요합니다.", [
          { text: "확인", onPress: () => router.replace("/(auth)/login_main") },
        ]);
        return;
      }
      
      setStatus("그룹 정보를 찾는 중입니다...");
      
      // 2. 초대 코드로 그룹 찾기
      const groupLocationsRef = collection(db, "groupLocations");
      const q = query(groupLocationsRef, where("inviteCode", "==", code));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setStatus("존재하지 않는 그룹입니다.");
        Alert.alert("오류", "해당 초대 코드를 가진 그룹을 찾을 수 없습니다.", [
          { text: "확인", onPress: () => router.replace("/(protected)/(tabs)/(group_zone)/group_zone") },
        ]);
        return;
      }
      
      const groupDoc = snapshot.docs[0];
      const groupId = groupDoc.id;
      const groupData = groupDoc.data();

      if (groupData.ownerId === user.uid) {
      Alert.alert("알림", "본인이 생성한 그룹입니다.\n그룹 목록에서 확인하세요.");
      router.replace("/(protected)/(tabs)/(group_zone)/group_zone");

      return;
      }
      
      // 3. 이미 멤버인지 확인
      const memberRef = doc(db, "groupLocations", groupId, "members", user.uid);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
         Alert.alert("알림", "이미 참여하고 있는 그룹입니다.", [
          { text: "확인", onPress: () => router.replace("/(protected)/(tabs)/(group_zone)/group_zone") },
        ]);
        return;
      }
      
      setStatus("그룹에 참여하는 중입니다...");
      
      // 4. 그룹에 멤버로 추가 (Batch 사용)
      try {
        const batch = writeBatch(db);
        const userProfileSnap = await getDoc(doc(db, "users", user.uid));
        const displayName = userProfileSnap.data()?.displayName ?? user.displayName ?? "새 멤버";
        
        // members 서브 컬렉션에 문서 추가
        batch.set(memberRef, {
          role: "member",
          uid: user.uid,
          groupNickname: displayName,
          joinedAt: serverTimestamp(),
        });

        // groupLocations 문서의 memberCount 1 증가
        batch.update(groupDoc.ref, {
          memberCount: increment(1),
        });
        
        await batch.commit();
        
        Alert.alert("환영합니다!", "그룹에 성공적으로 참여했습니다.", [
          { text: "확인", onPress: () => router.replace("/(protected)/(tabs)/(group_zone)/group_zone") },
        ]);
        
      } catch (error) {
        console.error("그룹 참여 중 오류:", error);
        setStatus("오류가 발생했습니다.");
         Alert.alert("오류", "그룹 참여 중 문제가 발생했습니다. 다시 시도해주세요.", [
          { text: "확인", onPress: () => router.replace("/(protected)/(tabs)/(group_zone)/group_zone") },
        ]);
      }
    };

    const unsubscribe = auth.onAuthStateChanged(user => {
        if(user) {
            unsubscribe(); // 한번만 실행되도록 리스너 해제
            processInvitation();
        } else {
            // 로그인 되어 있지 않다면 로그인 페이지로 보냄
            Alert.alert("로그인 필요", "그룹에 참여하려면 로그인이 필요합니다.", [
                { text: "확인", onPress: () => router.replace("/(auth)/login_main") },
            ]);
        }
    });

  }, [code, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.statusText}>{status}</Text>
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
});
