// ─────────────────────────────────────────────────────────────────────────────
// 1) IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Modal, // [추가]
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, PROVIDER_GOOGLE, Region } from "react-native-maps";
// [제거] import Popover from "react-native-popover-view";

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

  // 추가
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
      // [수정] 'focusPlaces' -> 'personalFocusPlaces'로 키 이름 변경
      const saved = await AsyncStorage.getItem("personalFocusPlaces");
      setPlaces(saved ? JSON.parse(saved) : []);
    } catch (e) {
      console.log("데이터 로드 실패:", e);
      setPlaces([]);
    }
  };

  const savePlaces = async (updated: Place[]) => {
    try {
      // [수정] 'focusPlaces' -> 'personalFocusPlaces'로 키 이름 변경
      await AsyncStorage.setItem("personalFocusPlaces", JSON.stringify(updated));
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
          setSelectedPlace(null); // [추가] 선택 초기화
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

          <TouchableOpacity
            onPress={() => moveCameraToPlace(item)}
            style={{ paddingHorizontal: 8, paddingVertical: 4, marginRight: 4 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="navigate-outline" size={20} color="#3B82F6" />
          </TouchableOpacity>

          {/* [수정] Popover 대신 TouchableOpacity + Modal 사용 */}
          <TouchableOpacity
            onPress={() => {
              setSelectedPlace(item);
              setMenuVisible(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
          </TouchableOpacity>
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
        followsUserLocation={true}
      >
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
      </MapView>

      {/* [수정] 현재 위치 버튼만 지도에 남김 */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={getCurrentLocation}
        activeOpacity={0.8}
      >
        <View style={styles.locationButtonInner}>
          <Ionicons name="navigate" size={22} color="#fff" />
        </View>
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
            <View style={styles.headerButtons}>
              <Text style={styles.countText}>
                {places.filter((p) => p.isActive).length}/{places.length}
              </Text>
              
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleAllActive}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isAnyPlaceActive ? "flash-off" : "flash"}
                  size={16}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addButton}
                onPress={goToAdd}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
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

      {/* [추가] 메뉴 Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuModal}>
            <TouchableOpacity
              style={styles.menuModalItem}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color="#222" />
              <Text style={styles.menuModalText}>수정</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuModalItem}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.menuModalText, { color: "#EF4444" }]}>
                삭제
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // [수정] 내 위치 버튼 - 우측 상단으로 복구
  locationButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1000,
  },
  locationButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  bottomSheet: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sheetContent: { padding: 16 },

  // [수정] 헤더 스타일
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "bold", color: "#222" },
  
  // [추가] 헤더 버튼 그룹
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countText: { 
    fontSize: 14, 
    color: "#6B7280", 
    fontWeight: "600",
    marginRight: 4,
  },

  // [추가] 전체 활성화/비활성화 버튼
  toggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  // [추가] + 버튼
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
  },

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

  // [제거] popoverStyle, popoverContent 제거
  // [추가] Modal 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuModal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    minWidth: 180,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuModalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  menuModalText: {
    fontSize: 15,
    color: "#222",
    fontWeight: "500",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 12,
  },
});