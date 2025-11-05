// app/(protected)/(tabs)/(focus_zone)/index.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 1) IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, PROVIDER_GOOGLE, Region } from "react-native-maps";
import Popover from "react-native-popover-view";
// --- ADDED: locationService 임포트 ---

// ─────────────────────────────────────────────────────────────────────────────
// 2) TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Place = {
  id: string;// 집중장소 고유 아이디
  name: string; // 집중장소 이름
  address: string; // string 주소
  latitude: number; // 위도
  longitude: number; // 경도
  radius: number; // 반경
  isActive: boolean; // 
  // 🔽 이 줄을 추가하면 에러가 사라집니다.
  blockedApps?: string[]; // '?'를 붙여서 선택적 필드로 만들면 더 안전합니다.
};

// ─────────────────────────────────────────────────────────────────────────────
// 3) COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function FocusZoneScreen() {
  // 3-1) REFS
  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);

  // 3-2) NAV
  const router = useRouter();

  // 3-3) UI CONSTANTS
  const snapPoints = useMemo(() => ["5%", "60%", "90%"], []);

  // 3-4) STATE
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null); // 추가

  // 지도 카메라 상태(초기값: 서울 시청)
  const [region, setRegion] = useState<Region>({
    latitude: 37.5665,
    longitude: 126.978,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4) EFFECTS
  // ───────────────────────────────────────────────────────────────────────────
  // 탭이 포커스될 때마다 저장된 장소 로드
  useFocusEffect(
    useCallback(() => {
      loadPlaces();
    }, [])
  );
  
  // 앱 시작 시 현재 위치 가져오기
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          // 초기 카메라 위치를 현재 위치로 설정
          setRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          });
        }
      } catch (e) {
        console.error("현재 위치 가져오기 실패:", e);
      }
    })();
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // 5) HELPERS
  // ───────────────────────────────────────────────────────────────────────────
  const animateTo = (
    lat: number,
    lng: number,
    latDelta = 0.01,
    lngDelta = 0.01
  ) => {
    const next: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 350);
  };

  const loadPlaces = async () => {
    try {
      const saved = await AsyncStorage.getItem("focusPlaces");
      setPlaces(saved ? JSON.parse(saved) : []);
    } catch (e) {
      console.log("데이터 로드 실패:", e);
      setPlaces([]);
    }
  };

  const savePlaces = async (updated: Place[]) => {
    try {
      await AsyncStorage.setItem("focusPlaces", JSON.stringify(updated));
      setPlaces(updated);
    } catch {
      Alert.alert("오류", "저장에 실패했습니다.");
    }
  };



  // ───────────────────────────────────────────────────────────────────────────
  // 6) HANDLERS (버튼/목록/메뉴/네비 등)
  // ───────────────────────────────────────────────────────────────────────────
  // --- MODIFIED: 전체 활성화/비활성화 토글 함수로 변경 ---
  const toggleAllActive = () => {
    // 현재 활성화된 장소가 하나라도 있는지 확인
    const isAnyActive = places.some(p => p.isActive);
    // 하나라도 켜져 있으면 모두 끄고, 모두 꺼져 있으면 모두 켬
    const updated = places.map((p) => ({ ...p, isActive: !isAnyActive }));
    savePlaces(updated);
  };

  const toggleSelection = (item: Place) => {
    const updated = places.map((p) =>
      p.id === item.id ? { ...p, isActive: !p.isActive } : p
    );
    savePlaces(updated);
  };

  const moveCameraToPlace = (p: Place) => {
    animateTo(p.latitude, p.longitude, 0.01, 0.01);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("권한 필요", "위치 권한을 허용해주세요.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      // 상태 업데이트
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      animateTo(loc.coords.latitude, loc.coords.longitude);
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "현재 위치를 가져올 수 없습니다.");
    }
  };

  const handleEdit = () => {
    if (!selectedPlace) return;
    setMenuVisible(false);
    router.push({
      pathname: "/(protected)/(tabs)/(focus_zone)/add",
      params: {
        editMode: "true",
        placeId: selectedPlace.id,
        name: selectedPlace.name,
        address: selectedPlace.address,
        latitude: String(selectedPlace.latitude),
        longitude: String(selectedPlace.longitude),
        radius: String(selectedPlace.radius),
        blockedApps: JSON.stringify(selectedPlace.blockedApps || []),
      },
    });
  };

  const handleDelete = () => {
    if (!selectedPlace) return;
    setMenuVisible(false);
    Alert.alert("삭제 확인", `"${selectedPlace.name}"를 삭제하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          const updated = places.filter((p) => p.id !== selectedPlace.id);
          savePlaces(updated);
        },
      },
    ]);
  };

  const goToAdd = () => {
    router.push("/(protected)/(tabs)/(focus_zone)/add");
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 7) RENDER: 리스트 아이템/빈 리스트/메인 UI
  // ───────────────────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Place }) => (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        style={[styles.card, item.isActive && styles.selectedCard]}
        onPress={() => toggleSelection(item)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons
            name={item.isActive ? "checkmark-circle" : "close-circle"}
            size={22}
            color={item.isActive ? "#22C55E" : "#D1D5DB"}
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "bold", fontSize: 16, color: "#222" }}>
              {item.name}
            </Text>
            <Text
              style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}
              numberOfLines={1}
            >
              {item.address}
            </Text>
          </View>

          {/* 🔎 작은 지도 아이콘: 누르면 해당 장소로 카메라 이동 */}
          <TouchableOpacity
            onPress={() => moveCameraToPlace(item)}
            style={{ paddingHorizontal: 8, paddingVertical: 4, marginRight: 4 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="navigate-outline" size={20} color="#3B82F6" />
          </TouchableOpacity>

          {/* ··· 메뉴 */}
          <Popover
            isVisible={menuVisible && selectedPlace?.id === item.id}
            onRequestClose={() => setMenuVisible(false)}
            from={
              <TouchableOpacity
                onPress={() => {
                  setSelectedPlace(item);
                  setMenuVisible(true);
                }}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            }
            placement="bottom"
            popoverStyle={styles.popoverStyle}
            backgroundStyle={{ backgroundColor: "transparent" }}
          >
            <View style={styles.popoverContent}>
              <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                <Text style={styles.menuText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Text style={[styles.menuText, { color: "#EF4444" }]}>
                  삭제
                </Text>
              </TouchableOpacity>
            </View>
          </Popover>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={48} color="#D1D5DB" />
      <Text style={styles.emptyText}>등록된 집중장소가 없습니다</Text>
      <Text style={styles.emptySubText}>
        + 버튼을 눌러 새로운 집중장소를 추가해보세요
      </Text>
    </View>
  );
  // --- ADDED: 버튼 텍스트와 아이콘을 동적으로 결정하기 위한 변수 ---
  const isAnyPlaceActive = places.some(p => p.isActive);
  // ───────────────────────────────────────────────────────────────────────────
  // 8) RETURN
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* 지도 (Google) */}
      <MapView
        ref={mapRef}
        mapType="standard"
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation={true}
        showsMyLocationButton={false}
        userLocationAnnotationTitle="내 위치"
        userLocationPriority="high"
        followsUserLocation={true} // true로 하면 자동으로 따라감
        

      >
        {/* --- MODIFIED: 항상 모든 장소를 지도에 표시 --- */}
        {places.map((p) => (
          <Circle
            key={p.id}
            center={{ latitude: p.latitude, longitude: p.longitude }}
            radius={p.radius || 400}
            strokeWidth={2}
            strokeColor={p.isActive ? "#22C55E" : "#9CA3AF"}
            fillColor={
              p.isActive ? "rgba(34,197,94,0.2)" : "rgba(156,163,175,0.2)"
            }
          />
        ))}
        
        {/* 현재 위치 Circle 제거 */}
      </MapView>

      {/* --- MODIFIED: 전체 활성화/비활성화 버튼으로 변경 --- */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={toggleAllActive}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isAnyPlaceActive ? "flash-off-outline" : "flash-outline"}
          size={20}
          color="#fff"
        />
        <Text style={styles.toggleButtonText}>
          {isAnyPlaceActive ? "전체 비활성화" : "전체 활성화"}
        </Text>
      </TouchableOpacity>

      {/* 현재 위치 버튼 */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={getCurrentLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="locate" size={25} color="#2E82FF" />
      </TouchableOpacity>

      {/* 하단 시트 */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        enableOverDrag={false}
        enableContentPanningGesture={false}
        enableHandlePanningGesture
        style={styles.bottomSheet}
      >
        <BottomSheetView style={styles.sheetContent}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>집중장소</Text>
            <Text style={styles.countText}>
              {places.filter((p) => p.isActive).length}/{places.length}
            </Text>
          </View>
          <FlatList
            data={places}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={renderEmptyList}
            contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          />
        </BottomSheetView>
      </BottomSheet>

      {/* 플로팅 추가 버튼 */}
      <TouchableOpacity style={styles.fab} onPress={goToAdd}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  toggleButton: {
    position: "absolute",
    top: 60,
    left: 16,
    backgroundColor: "rgba(37, 99, 235, 0.9)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  toggleButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },

  locationButton: {
    position: "absolute",
    top: 60,
    right: 16,
    height: 50,
    width: 50,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },

  bottomSheet: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sheetContent: { padding: 12 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: "bold", color: "#222" },
  countText: { fontSize: 14, color: "#2563EB", fontWeight: "600" },

  cardContainer: { marginBottom: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
  },
  selectedCard: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },

  fab: {
    position: "absolute",
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },

  popoverStyle: { backgroundColor: "transparent" },
  popoverContent: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 100,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 30 },
  menuText: { fontSize: 14, color: "#222" },
});
