import { AuthContext } from "@/src/services/auth/authContext";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../../../firebaseConfig";

import {
  doc,
  updateDoc
} from "firebase/firestore";

import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";


export default function Profile() {
  const { user, logOut, updateUser } = useContext(AuthContext);
  const router = useRouter();

  const bottomSheetRef = useRef<BottomSheet>(null);

  const isPasswordUser = user?.provider === "email";

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "확인", style: "destructive", onPress: () => logOut() },
    ]);
  };

  //바텀시트 기능들 정의
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [profileImage, setProfileImage] = useState("");

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || "");
      setProfileImage(user.profileImage || "");
      setEmail(user.email || "");
    }
  }, [user]); // user 객체가 바뀔 때마다 실행

  // snapPoints
  const snapPoints = useMemo(() => ["60%"], []);

  // 이미지 선택
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  // ✅ handleSave 함수를 수정합니다.
  const handleSave = async () => {
    if (!user) return;

    // 저장할 데이터 객체
    const updatedData = {
      nickname: nickname.trim(),
      profileImage,
    };

    try {
      // 1. Firestore 업데이트
      await updateDoc(doc(db, "users", user.uid), updatedData);

      // 2. AuthContext 및 AsyncStorage 업데이트
      updateUser(updatedData);

      Alert.alert("저장 완료", "프로필이 업데이트되었습니다.");
      bottomSheetRef.current?.close(); // 바텀시트 닫기
    } catch (error) {
      console.error(error);
      Alert.alert("에러", "프로필 저장 중 문제가 발생했습니다.");
    }
  };

  const closeBottomSheet = () => bottomSheetRef.current?.close();
  return (
    <View style={{ flex: 1 }}>

      <ScrollView style={styles.container}>
        {/* 상단 프로필 */}
        <TouchableOpacity
          style={styles.profileHeader}
          onPress={() => bottomSheetRef.current?.expand()}
        >
          <View style={styles.avatarWrapper}>
            <Image
              source={
                user?.profileImage
                  ? { uri: user.profileImage }
                  : require("@/assets/images/react-logo.png")
              }
              style={styles.avatar}
            />
            <View style={styles.cameraIconWrapper}>
              <Text style={{ fontSize: 16 }}>📷</Text>
            </View>
          </View>
          <Text style={styles.nickname}>{user?.nickname}</Text>
        </TouchableOpacity>

        {/* 계정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => bottomSheetRef.current?.expand()}
          >
            <Text style={styles.rowText}>닉네임 변경</Text>
          </TouchableOpacity>

          {isPasswordUser && (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push("/(auth)/email_forget_pwd")}
            >
              <Text style={styles.rowText}>비밀번호 변경</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>계정 삭제</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <Text style={styles.rowText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        {/* 앱 환경설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 환경설정</Text>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>다크모드</Text>
            <Text style={{ color: "blue" }}>끄기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>알림 설정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>캐시 데이터 삭제</Text>
          </TouchableOpacity>
        </View>

        {/* 앱 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 정보</Text>
          <View style={styles.row}>
            <Text style={styles.rowText}>앱 버전</Text>
            <Text>v1.0.0</Text>
          </View>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>오픈소스 라이선스</Text>
          </TouchableOpacity>
        </View>

        {/* 고객지원 & 정책 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>고객지원 & 정책</Text>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>이용약관</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>개인정보정책</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ✅ 바텀시트 부분 */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
      >
        <BottomSheetView style={styles.bottom_container}>
          {/* 상단 버튼 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={closeBottomSheet}>
              <Text style={styles.cancel}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.save}>저장</Text>
            </TouchableOpacity>
          </View>

          {/* 프로필 이미지 */}
          <TouchableOpacity onPress={pickImage} style={{ alignItems: "center", marginBottom: 15 }}>
            {/* ✅ 이미지 선택 시 바로 미리보기가 반영되도록 'profileImage' 상태를 사용합니다. */}
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.bottom_avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text>+</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* 닉네임 */}
          <Text style={styles.label}>닉네임</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            style={styles.input}
          />

          {/* 이메일 */}
          <Text style={styles.label}>계정</Text>
          <TextInput
            value={email}
            editable={false}
            style={[styles.input, { backgroundColor: "#f5f5f5" }]}
          />

          {/* 로그아웃 */}
          <TouchableOpacity
            onPress={() => {
              Alert.alert("로그아웃", "정말 로그아웃 하시겠습니까?", [
                { text: "취소", style: "cancel" },
                { text: "확인", onPress: () => logOut() },
              ]);
            }}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>

          {/* 계정 삭제 (UI만) */}
          <TouchableOpacity disabled style={styles.deleteBtn}>
            <Text style={{ color: "gray" }}>계정 삭제</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 45,
    marginTop: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#ddd",
  },
  cameraIconWrapper: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 4,
  },
  nickname: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "bold",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowText: {
    fontSize: 16,
  },

  // BottomSheet styles
  bottom_container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  cancel: {
    color: "gray",
    fontSize: 16,
  },
  save: {
    color: "blue",
    fontWeight: "bold",
    fontSize: 16,
  },
  bottom_avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
  },
  logoutBtn: {
    backgroundColor: "#fff0f0",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  logoutText: {
    color: "red",
    fontWeight: "bold",
  },
  deleteBtn: {
    marginTop: 15,
    alignItems: "center",
  },
});
