// app/(protected)/(tabs)/(group_zone)/add.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../../../firebaseConfig";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export default function AddGroupPlace() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    editMode?: string;
    placeId?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
    radius?: string;
    name?: string;
  }>();

  const isEditMode = params.editMode === "true";
  const placeId = params.placeId;

  // form states
  const [locationName, setLocationName] = useState(
    params.name ?? "새로운 집중장소"
  );
  const [address, setAddress] = useState(
    params.address ?? "51-1, 충대로13번길, 청주시"
  );
  const [latitude, setLatitude] = useState<number | undefined>(
    params.latitude ? Number(params.latitude) : undefined
  );
  const [longitude, setLongitude] = useState<number | undefined>(
    params.longitude ? Number(params.longitude) : undefined
  );
  const [radius, setRadius] = useState<number>(
    params.radius ? Number(params.radius) : 400
  );
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 요일

  // ui states
  const [loadingDoc, setLoadingDoc] = useState<boolean>(isEditMode); // 수정모드면 처음에 로딩
  const [saving, setSaving] = useState<boolean>(false);

  // (임시) 차단 앱 수
  const appsBlockedCount = 0;

  const toggleDay = (idx: number) => {
    setSelectedDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
    );
  };

  // 수정 모드일 때 기존 문서 불러오기
  useEffect(() => {
    let ignore = false;
    const loadDoc = async () => {
      if (!isEditMode || !placeId) return;
      try {
        setLoadingDoc(true);
        const ref = doc(db, "groupLocations", placeId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          Alert.alert("알림", "해당 장소를 찾을 수 없습니다.");
          router.replace("/(protected)/(tabs)/(group_zone)/group_zone");
          return;
        }
        if (ignore) return;
        const data = snap.data() as any;
        setLocationName(data.locationName ?? "그룹장소");
        setAddress(data.address ?? "");
        setLatitude(
          typeof data.latitude === "number" ? data.latitude : undefined
        );
        setLongitude(
          typeof data.longitude === "number" ? data.longitude : undefined
        );
        setRadius(typeof data.radius === "number" ? data.radius : 400);
        setSelectedDays(Array.isArray(data.activeDays) ? data.activeDays : []);
      } catch (e: any) {
        Alert.alert("에러", String(e?.message ?? e));
      } finally {
        setLoadingDoc(false);
      }
    };
    loadDoc();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, placeId]);

  // 저장(생성/수정 공용)
  const onSave = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("안내", "로그인이 필요합니다.");
    if (!locationName?.trim())
      return Alert.alert("안내", "그룹장소명을 입력해 주세요.");
    if (!address || address === "주소를 선택하세요")
      return Alert.alert("안내", "주소를 선택해 주세요.");

    const payload = {
      locationName: locationName.trim(),
      address: String(address),
      latitude: typeof latitude === "number" ? latitude : null,
      longitude: typeof longitude === "number" ? longitude : null,
      radius: Number(radius) || 400,
      userId: user.uid,
      activeDays: [...selectedDays]
        .map((d) => Number(d))
        .filter((d) => d >= 0 && d <= 6)
        .sort((a, b) => a - b),
      updatedAt: serverTimestamp(),
    };

    try {
      setSaving(true);
      if (isEditMode && placeId) {
        // 업데이트
        await updateDoc(doc(db, "groupLocations", placeId), payload);
      } else {
        // 생성
        await addDoc(collection(db, "groupLocations"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      Alert.alert("완료", isEditMode ? "수정되었습니다." : "등록되었습니다.", [
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
    } finally {
      setSaving(false);
    }
  };

  const goToMap = () => {
    const mapParams: Record<string, any> = {
      latitude,
      longitude,
      radius,
      address,
    };
    if (isEditMode && placeId) {
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
        <TouchableOpacity onPress={onCancel} disabled={saving}>
          <Text style={[styles.headerAction, { color: "#EF4444" }]}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? "그룹장소 수정" : "그룹장소 등록"}
        </Text>
        <TouchableOpacity onPress={onSave} disabled={saving || loadingDoc}>
          <Text
            style={[
              styles.headerAction,
              { color: saving || loadingDoc ? "#9CA3AF" : "#2563EB" },
            ]}
          >
            {saving ? "저장중..." : "저장"}
          </Text>
        </TouchableOpacity>
      </View>

      {loadingDoc ? (
        <View
          style={{
            height: 240,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.label}>그룹장소명</Text>
            <TextInput
              style={styles.input}
              placeholder="예) 도서관, 스터디카페"
              value={locationName}
              onChangeText={setLocationName}
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

          {/* 요일 선택 */}
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
          <View style={styles.daysRow}>
            {DAYS.map((label, idx) => {
              const active = selectedDays.includes(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleDay(idx)}
                  style={[
                    styles.dayChip,
                    {
                      borderColor: active ? "#2563EB" : "#D1D5DB",
                      backgroundColor: active ? "#DBEAFE" : "#F3F4F6",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: active ? "#1E40AF" : "#6B7280" },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
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

  // 요일 칩
  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    marginRight: -8,
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  dayText: { fontWeight: "700" },
});
