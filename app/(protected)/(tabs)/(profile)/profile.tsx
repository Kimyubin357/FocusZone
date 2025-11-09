// app/(protected)/(tabs)/(profile)/profile.tsx
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
} from "firebase/storage"; // 🚨 Storage 함수 임포트


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

  const pickImage = async () => {
    // 1. 이미지 선택 (정사각형 강제)
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1, // Manipulator에서 압축할 것이므로 여기선 1(원본)로 둠
    });

    if (result.canceled) {
      return;
    }

    const sourceUri = result.assets[0].uri;

    try {
      // 2. 이미지 리사이즈 및 압축
      const manipResult = await ImageManipulator.manipulateAsync(
        sourceUri, // 원본 이미지 URI
        [
          // ✅ 프로필 이미지에 적합한 500x500 픽셀로 리사이즈
          { resize: { width: 500, height: 500 } } 
        ],
        { 
          compress: 0.7, // ✅ 70% 품질로 압축
          format: ImageManipulator.SaveFormat.JPEG // JPEG로 저장
        }
      );

      // 3. 리사이즈된 이미지의 URI를 상태에 저장
      setProfileImage(manipResult.uri);

    } catch (error) {
      console.error("이미지 처리 중 에러:", error);
      Alert.alert("오류", "이미지를 처리하는 중 문제가 발생했습니다.");
    }
  };

  // ✅ [수정 1] 이미지를 Storage에 업로드하고 URL을 반환하는 함수
  const uploadImageAsync = async (uri: string) => {
    // 1. URI로부터 Blob(파일 데이터) 생성
    const response = await fetch(uri);
    const blob = await response.blob();

    // 2. Storage 참조 생성 (파일 경로/이름 지정)
    // 'profileImages/[유저UID].jpeg'로 저장
    const storageRef = ref(storage, `profileImages/${user!.uid}`);

    // 3. 파일 업로드
    const uploadTask = await uploadBytesResumable(storageRef, blob);

    // 4. 업로드 완료 후 다운로드 URL 가져오기
    const downloadURL = await getDownloadURL(uploadTask.ref);
    return downloadURL;
  };

  // ✅ [수정 2] handleSave 함수
  const handleSave = async () => {
    if (!user) return;

    let profileUrlToSave = profileImage; // 기본값 (변경 안 할 경우)

    try {
      // 1. 이미지가 변경되었는지 확인 (로컬 file 경로인지 확인)
      if (profileImage.startsWith("file://")) {
        // 2. 이미지가 변경되었으면 Storage에 업로드
        profileUrlToSave = await uploadImageAsync(profileImage);
        // 이제 profileUrlToSave는 'https://...' 웹 URL입니다.
      }

      // 3. 저장할 데이터 객체 (웹 URL 또는 변경 안 된 닉네임)
      const updatedData = {
        nickname: nickname.trim(),
        profileImage: profileUrlToSave, // 🚨 storage 웹 URL을 저장
      };

      // 4. Firestore 업데이트
      await updateDoc(doc(db, "users", user.uid), updatedData);

      // 5. AuthContext 및 AsyncStorage 업데이트
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
