import { AuthContext } from "@/src/services/auth/authContext";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from "expo-image-picker";

import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { db, storage } from "../../../../firebaseConfig";

import {
  doc,
  updateDoc
} from "firebase/firestore";

import {
  Alert,
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient'; // ✅ 3. LinearGradient import

const THEME_COLOR = "#0D4093";

export default function Profile() {
  const { user, logOut, updateUser } = useContext(AuthContext);
  const router = useRouter();

  const bottomSheetRef = useRef<BottomSheet>(null);

  // ✅ 1. 바텀시트 열림 상태 추적
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const isPasswordUser = user?.provider === "email";

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "확인", style: "destructive", onPress: () => logOut() },
    ]);
  };

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [profileImage, setProfileImage] = useState("");

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || "");
      setProfileImage(user.profileImage || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const snapPoints = useMemo(() => ["60%"], []);

  // ✅ 1. 바텀시트 상태 변경 시 호출될 핸들러
  const handleSheetChanges = (index: number) => {
    setIsSheetOpen(index > -1);
  };

  // ✅ 1. OS 뒤로가기 버튼 처리
  useEffect(() => {
    const backAction = () => {
      if (isSheetOpen) {
        bottomSheetRef.current?.close();
        return true; // 뒤로가기 기본 동작(앱 종료 등) 막기
      }
      return false; // 기본 동작 허용
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [isSheetOpen]); // isSheetOpen 상태가 변경될 때마다 이펙트 재실행


  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images, // ✅ 수정
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

    if (result.canceled) {
      return;
    }

    const sourceUri = result.assets[0].uri;

    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        sourceUri, 
        [
          { resize: { width: 500, height: 500 } } 
        ],
        { 
          compress: 0.7, 
          format: ImageManipulator.SaveFormat.JPEG
        }
      );
      setProfileImage(manipResult.uri);
    } catch (error) {
      console.error("이미지 처리 중 에러:", error);
      Alert.alert("오류", "이미지를 처리하는 중 문제가 발생했습니다.");
    }
  };

  const uploadImageAsync = async (uri: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `profileImages/${user!.uid}`);
    const uploadTask = await uploadBytesResumable(storageRef, blob);
    const downloadURL = await getDownloadURL(uploadTask.ref);
    return downloadURL;
  };

  const handleSave = async () => {
    if (!user) return;

    let profileUrlToSave = profileImage; 

    try {
      if (profileImage.startsWith("file://")) {
        profileUrlToSave = await uploadImageAsync(profileImage);
      }

      const updatedData = {
        nickname: nickname.trim(),
        profileImage: profileUrlToSave,
      };

      await updateDoc(doc(db, "users", user.uid), updatedData);
      updateUser(updatedData);

      Alert.alert("저장 완료", "프로필이 업데이트되었습니다.");
      bottomSheetRef.current?.close();
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
          // ✅ 3. profileHeader -> profileHeaderPressable 스타일 변경
          style={styles.profileHeaderPressable}
          onPress={() => bottomSheetRef.current?.expand()}
        >
          {/* ✅ 3. 그라데이션 배경 추가 */}
          <LinearGradient
            colors={['#E9EFFF', '#FFFFFF']} // 연한 파란색 -> 흰색
            style={styles.profileHeaderGradient}
          >
            <View style={styles.avatarWrapper}>
              <Image
                source={
                  user?.profileImage
                    ? { uri: user.profileImage }
                    : require("@/assets/images/user_default_logo.png")
                }
                style={styles.avatar}
              />
            </View>
            <View style={styles.nicknameContainer}>
              <Text style={styles.nickname}>{user?.nickname}</Text>
              
            </View>
          </LinearGradient>
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
            <Text style={styles.rowTextError}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        {/* 앱 환경설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 환경설정</Text>
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

      {/* 바텀시트 부분 */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={handleSheetChanges} // ✅ 1. onChange 핸들러 연결
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
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.bottom_avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="camera-outline" size={30} color="#888" />
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
            style={[styles.input, { backgroundColor: "#f5f5f5", color: '#666' }]}
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
  // ✅ 3. profileHeader -> profileHeaderPressable로 변경 (스타일 분리)
  profileHeaderPressable: {
    marginTop: 15,
    borderBottomWidth: 1.5,
    borderBottomColor: "#eee",
  },
  // ✅ 3. 그라데이션을 위한 스타일
  profileHeaderGradient: {
    alignItems: "center",
    paddingVertical: 45,
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
  nicknameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    justifyContent: 'center', 
    width: '100%',
  },
  nickname: {
    fontSize: 20,
    fontWeight: "bold",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "#eee", 
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold", 
    marginBottom: 5,
    color: THEME_COLOR,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowText: {
    fontSize: 16,
  },
  // ✅ 2. 로그아웃 텍스트 (빨간색)
  rowTextError: {
    fontSize: 16,
    color: 'red',
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
    color: "red",
    fontSize: 16,
  },
  save: {
    color: THEME_COLOR,
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
    marginTop: 10,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#ccc",
    borderRadius: 25,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 10,
  },
  logoutBtn: {
    backgroundColor: "#fff0f0",
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: 'center',
    marginTop: 20,
  },
  logoutText: {
    color: "red",
    fontWeight: "bold",
    fontSize: 16,
  },
  deleteBtn: {
    marginTop: 15,
    alignItems: "center",
  },
});