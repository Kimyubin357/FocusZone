// app/(protected)/(tabs)/(group_zone)/add.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../../../firebaseConfig"; // ✅ RN용 인스턴스 사용

export default function AddGroupPlace() {
  const router = useRouter();
  const params = useLocalSearchParams(); // 위치 정보 받기

  const isEditMode = params.editMode === "true";
  const placeId = params.placeId;

  const [locationName, setlocationName] = useState(
    isEditMode ? (params.name as string) : "새로운 집중장소"
  );
  const [address, setAddress] = useState(
    (params.address as string) || "51-1, 충대로13번길, 청주시"
  );
  const [latitude] = useState(
    params.latitude ? Number(params.latitude) : undefined
  ); // 위도
  const [longitude] = useState(
    params.longitude ? Number(params.longitude) : undefined
  ); // 경도
  const [radius] = useState(params.radius ? Number(params.radius) : 400); // 반경

  const appsBlockedCount = 0; // 차단된 앱 수 (임시)

  // ✅ 요일 선택 상태
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const toggleDay = (idx: number) => {
    setSelectedDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
    );
  };

  const addLocation = async () => {
    const user = auth.currentUser;
    if (
      user &&
      locationName.trim() !== "" &&
      address &&
      address !== "주소를 선택하세요"
    ) {
      try {
        const groupLocationCollection = collection(db, "groupLocations");

        await addDoc(groupLocationCollection, {
          locationName: locationName.trim(),
          address: address as string,
          latitude,
          longitude,
          radius,
          userId: user.uid,
          // ✅ 요일 저장 (0=일 ~ 6=토)
          activeDays: [...selectedDays]
            .map((d) => Number(d))
            .filter((d) => d >= 0 && d <= 6)
            .sort((a, b) => a - b),
        });

        Alert.alert("성공", "그룹장소가 등록되었습니다.", [
          {
            text: "확인",
            onPress: () => {
              router.dismissAll();
              router.push("/(protected)/(tabs)/(group_zone)/group_zone");
            },
          },
        ]);
      } catch (e: any) {
        Alert.alert("에러", String(e?.message ?? e));
      }
    } else {
      Alert.alert("안내", "그룹장소명과 주소를 확인해 주세요.");
    }
  };

  const goToMap = () => {
    const mapParams: Record<string, any> = {
      latitude,
      longitude,
      radius,
      address,
    };
    if (isEditMode) {
      Object.assign(mapParams, {
        editMode: "true",
        placeId,
        locationName,
      });
    }
    router.replace({
      pathname: "/(protected)/(tabs)/(group_zone)/map",
      params: mapParams,
    });
  };

  const onCancel = () =>
    router.replace("/(protected)/(tabs)/(group_zone)/group_zone");

  return (
    <SafeAreaView>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={[styles.headerAction, { color: "#EF4444" }]}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? "그룹장소 수정" : "그룹장소 등록"}
        </Text>
        <TouchableOpacity onPress={addLocation}>
          <Text style={[styles.headerAction, { color: "#2563EB" }]}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.label}>그룹장소명</Text>
          <TextInput
            style={styles.input}
            placeholder="예) 도서관, 스터디카페"
            value={locationName}
            onChangeText={setlocationName}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>위치</Text>
          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.8}
            onPress={goToMap}
          >
            <Ionicons name="navigate-outline" size={18} color="#2563EB" />
            <Text style={styles.rowBtnText}>
              {address || "주소를 선택하세요"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>반지름</Text>
          <Text style={styles.rowBtnText}>{radius}m</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>차단할 앱</Text>
          <TouchableOpacity style={styles.rowBtn} activeOpacity={0.8}>
            <Ionicons name="grid-outline" size={18} color="#2563EB" />
            <Text style={styles.rowBtnText}>
              앱 목록{" "}
              <Text style={{ color: "#2563EB", fontWeight: "bold" }}>
                {appsBlockedCount}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* ✅ 요일 선택 */}
        <Text
          style={{
            fontSize: 14,
            color: "#111827",
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          요일 선택
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DAYS.map((label, idx) => {
            const active = selectedDays.includes(idx);
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => toggleDay(idx)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active ? "#2563EB" : "#D1D5DB",
                  backgroundColor: active ? "#DBEAFE" : "#F3F4F6",
                }}
              >
                <Text
                  style={{
                    fontWeight: "700",
                    color: active ? "#1E40AF" : "#6B7280",
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  headerAction: { fontSize: 15, fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  label: { fontSize: 13, color: "#6B7280", marginBottom: 8 },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  rowBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  rowBtnText: { marginLeft: 8, color: "#111827", fontSize: 15 },
});
