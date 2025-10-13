// app/(protected)/(tabs)/(focus_zone)/add.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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

export default function AddFocusPlace() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const isEditMode = params.editMode === "true";
  const placeId = params.placeId as string | undefined;

  // ✅ 이름은 사용자가 타이핑한 값 유지가 중요하니 최초 한 번만 초기화
  const [name, setName] = useState(
    isEditMode ? (params.name as string) : "새로운 집중장소"
  );

  // 위치/반지름은 지도에서 돌아올 때 덮어씌울 수 있도록 초기값만 세팅
  const [address, setAddress] = useState<string>(
    (params.address as string) || "주소를 선택하세요"
  );
  const [latitude, setLatitude] = useState<number | undefined>(
    params.latitude ? Number(params.latitude) : undefined
  );
  const [longitude, setLongitude] = useState<number | undefined>(
    params.longitude ? Number(params.longitude) : undefined
  );
  const [radius, setRadius] = useState<number>(
    params.radius ? Number(params.radius) : (isEditMode ? 100 : 100) // 둘 다 100
  );

  const [appsBlockedCount, setAppsBlockedCount] = useState(0);

  // ✅ 포커스될 때 지도에서 저장해 둔 임시값(draft) 반영
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem("focusPlaceDraft");
          if (!raw) return;
          const draft = JSON.parse(raw);
          if (!isActive) return;

          if (draft.address) setAddress(draft.address);
          if (typeof draft.latitude === "number") setLatitude(draft.latitude);
          if (typeof draft.longitude === "number")
            setLongitude(draft.longitude);
          if (typeof draft.radius === "number") setRadius(draft.radius);
          // 차단된 앱 수 불러오기
          try {
            const blocked = await AsyncStorage.getItem("blockedApps");
            if (blocked && isActive) {
              const list = JSON.parse(blocked);
              setAppsBlockedCount(Array.isArray(list) ? list.length : 0);
            } else if (isActive) {
              setAppsBlockedCount(0);
            }
          } catch {}
        } catch (e) {
          // 무시
        }
      })();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem("focusPlaceDraft");
    } catch {}
  };

  const goToMap = () => {
    // ↪ 현재 설정값을 넘겨서 지도가 같은 상태로 시작
    router.push({
      pathname: "/(protected)/(tabs)/(focus_zone)/map",
      params: {
        latitude: latitude ?? "",
        longitude: longitude ?? "",
        radius: radius.toString(),
        address: address || "",
        ...(isEditMode && {
          editMode: "true",
          placeId: placeId,
          name: name,
        }),
      },
    });
  };

  const onCancel = async () => {
    await clearDraft();
    router.back();
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert("오류", "집중장소명을 입력해주세요.");
      return;
    }
    if (
      !address ||
      address === "주소를 선택하세요" ||
      latitude == null ||
      longitude == null
    ) {
      Alert.alert("오류", "위치를 선택해주세요.");
      return;
    }

    try {
      const savedPlaces = await AsyncStorage.getItem("focusPlaces");
      let places = savedPlaces ? JSON.parse(savedPlaces) : [];

      if (isEditMode && placeId) {
        // 수정
        places = places.map((place: any) =>
          place.id === placeId
            ? {
                ...place,
                name: name.trim(),
                address,
                latitude,
                longitude,
                radius,
              }
            : place
        );
        await AsyncStorage.setItem("focusPlaces", JSON.stringify(places));
        await clearDraft();
        Alert.alert("성공", "집중장소가 수정되었습니다.", [
          { text: "확인", onPress: () => router.back() },
        ]);
      } else {
        // 신규
        const newPlace = {
          id: Date.now().toString(),
          name: name.trim(),
          address,
          latitude,
          longitude,
          radius,
          count: 0,
          selected: false,
        };
        places.push(newPlace);
        await AsyncStorage.setItem("focusPlaces", JSON.stringify(places));
        await clearDraft();
        Alert.alert("성공", "집중장소가 등록되었습니다.", [
          { text: "확인", onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      Alert.alert("오류", "저장에 실패했습니다.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F7FB" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={[styles.headerAction, { color: "#EF4444" }]}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? "집중장소 수정" : "집중장소 등록"}
        </Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={[styles.headerAction, { color: "#2563EB" }]}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.label}>집중장소명</Text>
          <TextInput
            style={styles.input}
            placeholder="예) 도서관, 스터디카페"
            value={name}
            onChangeText={setName}
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
          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/(protected)/(tabs)/(focus_zone)/appselect")}
          >
            <Ionicons name="grid-outline" size={18} color="#2563EB" />
            <Text style={styles.rowBtnText}>
              앱 목록{" "}
              <Text style={{ color: "#2563EB", fontWeight: "bold" }}>
                {appsBlockedCount}
              </Text>
            </Text>
          </TouchableOpacity>
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
