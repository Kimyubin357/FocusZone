// app/(protected)/(tabs)/(focus_zone)/add.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { forceLocationTaskUpdate } from "../../../../src/services/location/locationService";

export default function AddFocusPlace() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const isFocused = useIsFocused();
  const isEditMode = params.editMode === "true";

  const placeId = params.placeId as string | undefined;

  // ✅ 이름은 사용자가 타이핑한 값 유지가 중요하니 최초 한 번만 초기화
  const [name, setName] = useState(
    (params.name as string) || "새로운 집중장소"
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

  // --- MODIFIED: 차단 앱 '목록'을 직접 상태로 관리 ---
  const [blockedApps, setBlockedApps] = useState<string[]>(() => {
    // 수정 모드일 때 params에서 초기값 설정
    if (isEditMode && params.blockedApps && typeof params.blockedApps === 'string') {
      return JSON.parse(params.blockedApps);
    }
    return []; // 새 장소 등록 시에는 빈 배열로 시작
  });
  const [isSaving, setIsSaving] = useState(false);


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
        } catch (e) {
          // 무시
        }
      })();
      return () => {
        isActive = false;
      };
    }, [])
  );
  useEffect(() => {
    // AppSelectScreen에서 updatedApps 파라미터를 가지고 돌아왔을 때
    if (isFocused && params.updatedApps && typeof params.updatedApps === 'string') {
      const newBlockedApps = JSON.parse(params.updatedApps);
      setBlockedApps(newBlockedApps);

      // 파라미터를 사용한 후에는 정리(초기화)하여 다른 동작에 영향을 주지 않도록 합니다.
      router.setParams({ updatedApps: undefined });
    }
  }, [params.updatedApps, isFocused]); // params.updatedApps가 변경될 때마다 실행

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem("focusPlaceDraft");
    } catch { }
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
  // --- ADDED: AppSelectScreen으로 이동하는 함수 ---
  const goToAppSelect = () => {
    router.push({
      pathname: "/(protected)/(tabs)/(focus_zone)/appselect", // AppSelectScreen 경로
      params: {
        // 현재 이 장소에 설정된 앱 목록을 넘겨줌
        currentApps: JSON.stringify(blockedApps),
        name: name,
        address: address,
        latitude: latitude ?? "",
        longitude: longitude ?? "",
        radius: radius.toString(),
        ...(isEditMode && {
          editMode: "true",
          placeId: placeId,
        }),
      }
    });
  };
  const onCancel = async () => {
    await clearDraft();
    router.back();
  };

  const onSave = async () => {
    if (isSaving) return;

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

    setIsSaving(true);

    try {
      const savedPlaces = await AsyncStorage.getItem("personalFocusPlaces");
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
              blockedApps: blockedApps,
            }
            : place
        );
      } else {
        // 신규
        const newPlace = {
          id: Date.now().toString(),
          name: name.trim(),
          address,
          latitude,
          longitude,
          radius,
          isActive: true,
          blockedApps: blockedApps,
        };
        places.push(newPlace);
      }

      // 저장
      await AsyncStorage.setItem("personalFocusPlaces", JSON.stringify(places));
      await clearDraft();

      // 위치 태스크 강제 업데이트
      console.log('[Add] 🔄 Triggering force update...');
      await forceLocationTaskUpdate();
      console.log('[Add] ✅ Force update completed');

      // ⭐️ [수정] Alert 제거하고 바로 이동
      router.replace("/(protected)/(tabs)/(focus_zone)"); // ← 또는 router.back()

    } catch (error) {
      console.error('[Add] ❌ Save error:', error);
      Alert.alert("오류", "저장에 실패했습니다.");
    } finally {
      // 👇 [추가 3] 성공/실패 여부와 관계없이 저장 상태 해제
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} disabled={isSaving}>
          <Text style={[styles.headerAction, styles.cancelText]}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? "집중장소 수정" : "집중장소 등록"}
        </Text>
        <TouchableOpacity
          onPress={onSave}
          disabled={isSaving}
        >
          <Text
            style={[
              styles.headerAction,
              styles.saveText,
              isSaving && styles.saveTextDisabled,
            ]}
          >
            {isSaving ? "저장중..." : "저장"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.label}>집중장소명</Text>
          <TextInput
            style={styles.input}
            placeholder="예) 도서관, 스터디카페"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>위치</Text>
          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.7}
            onPress={goToMap}
          >
            <Ionicons name="navigate-outline" size={20} color="#0D4093" />
            <Text style={styles.rowBtnText}>
              {address || "주소를 선택하세요"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>반지름</Text>
          <View style={styles.rowBtn}>
            <Text style={[
              styles.rowBtnText,
              !radius && styles.rowBtnTextDisabled
            ]}>
              {radius ? `${radius}m` : "지도에서 설정하세요"}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>차단할 앱</Text>
          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.7}
            onPress={goToAppSelect}
          >
            <Ionicons name="grid-outline" size={20} color="#0D4093" />
            <Text style={styles.rowBtnText}>
              앱 목록{" "}
              <Text style={styles.countText}>
                ({blockedApps.length})
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  headerAction: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 50,
    textAlign: "center",
  },
  cancelText: {
    color: "#EF4444",
  },
  saveText: {
    color: "#0D4093",
  },
  saveTextDisabled: {
    color: "#9CA3AF",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 10,
    fontWeight: "500",
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    color: "#111827",
    fontSize: 16,
  },
  rowBtn: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rowBtnText: {
    marginLeft: 12,
    color: "#111827",
    fontSize: 16,
    flex: 1,
  },
  rowBtnTextDisabled: {
    color: "#9CA3AF",
  },
  countText: {
    color: "#0D4093",
    fontWeight: "700",
  },
});
