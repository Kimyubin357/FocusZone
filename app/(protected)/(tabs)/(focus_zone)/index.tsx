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
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, PROVIDER_GOOGLE, Region } from "react-native-maps";


// ─────────────────────────────────────────────────────────────────────────────
// 2) TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Place = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
  blockedApps?: string[];
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
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
  const MENU_W = 180;
  const MENU_H = 100;

  // 3-4) STATE
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [region, setRegion] = useState<Region>({
    latitude: 37.5665,
    longitude: 126.978,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  });
  
// 👇 리스트에서 장소로 지도 이동 (부드럽게)
const moveCameraToPlace = (place: Place) => {
  if (!place.latitude || !place.longitude) return;
  setRegion({
    latitude: place.latitude,
    longitude: place.longitude,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  });
  mapRef.current?.animateCamera(
    {
      center: { latitude: place.latitude, longitude: place.longitude },
      zoom: 17,
    },
    { duration: 1200 }
  );
};
  const [isLoading, setIsLoading] = useState(false);
  // ───────────────────────────────────────────────────────────────────────────
  // 4) EFFECTS
  // ───────────────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      loadPlaces();
    }, [])
  );

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

  // 👇 [추가] locationService.tsx에서 getDistance 함수 복사
  const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

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
      const saved = await AsyncStorage.getItem("personalFocusPlaces");
      setPlaces(saved ? JSON.parse(saved) : []);
    } catch (e) {
      console.log("데이터 로드 실패:", e);
      setPlaces([]);
    }
  };

  const savePlaces = async (updated: Place[]) => {
    try {
      await AsyncStorage.setItem("personalFocusPlaces", JSON.stringify(updated));
      setPlaces(updated);
    } catch {
      Alert.alert("오류", "저장에 실패했습니다.");
    }
  };

  // ⭐️ [추가] 메뉴 위치 계산 (group_zone과 동일)
  const menuTop = (() => {
    if (!menuAnchor) return 90;
    const below = menuAnchor.y + menuAnchor.h + 8;
    const above = menuAnchor.y - MENU_H - 8;
    return below + MENU_H <= SCREEN_H ? below : Math.max(8, above);
  })();
  const menuLeft = (() => {
    if (!menuAnchor) return SCREEN_W - MENU_W - 20;
    const preferred = menuAnchor.x + menuAnchor.w - MENU_W;
    return Math.min(Math.max(8, preferred), SCREEN_W - MENU_W - 8);
  })();

  // ───────────────────────────────────────────────────────────────────────────
  // 6) HANDLERS
  // ───────────────────────────────────────────────────────────────────────────
  const toggleAllActive = async () => {
    if (isLoading) return; // 👈 [추가 1]
    setIsLoading(true); // 👈 [추가 2]

    try {
      try {
        // 3. [기존 로직] 버튼 누른 시점의 현재 위치 가져오기
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;

        if (latitude && longitude) {
          const isInsideAnyPlace = places.some((p) => {
            if (p.latitude && p.longitude && p.radius) {
              const distance = getDistance(
                latitude,
                longitude,
                p.latitude,
                p.longitude
              );
              return distance <= p.radius;
            }
            return false;
          });

          if (isInsideAnyPlace) {
            Alert.alert(
              "변경 불가",
              "하나 이상의 장소 내부에 있을 때는 전체 변경을 할 수 없습니다."
            );
            return; // 👈 함수 종료 (finally가 실행됨)
          }
        }
      } catch (e) {
        console.warn("Location check failed, allowing toggle all.", e);
      }

      // 4. [기존 로직] 외부일 경우 토글 실행
      const isAnyActive = places.some((p) => p.isActive);
      const updated = places.map((p) => ({ ...p, isActive: !isAnyActive }));
      await savePlaces(updated); // await 추가
    } finally {
      setIsLoading(false); // 👈 [추가 3]
    }
  };

  const toggleSelection = async (item: Place) => {
    if (isLoading) return; // 👈 [추가 1]
    setIsLoading(true); // 👈 [추가 2]

    try {
      try {
        // 3. [기존 로직] 버튼 누른 시점의 현재 위치 가져오기
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;

        if (
          latitude &&
          longitude &&
          item.latitude &&
          item.longitude &&
          item.radius
        ) {
          const distance = getDistance(
            latitude,
            longitude,
            item.latitude,
            item.longitude
          );

          if (distance <= item.radius) {
            Alert.alert(
              "변경 불가",
              "장소 내부에 있을 때는 활성화 상태를 변경할 수 없습니다."
            );
            return; // 👈 함수 종료 (finally가 실행됨)
          }
        }
      } catch (e) {
        console.warn("Location check failed, allowing toggle.", e);
      }

      // 4. [기존 로직] 외부일 경우 토글 실행
      const updated = places.map((p) =>
        p.id === item.id ? { ...p, isActive: !p.isActive } : p
      );
      await savePlaces(updated); // await 추가
    } finally {
      setIsLoading(false); // 👈 [추가 3]
    }
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

  const handleEdit = async () => {
    if (isLoading) return; // 👈 [추가 1]
    if (!selectedPlace) return;

    setIsLoading(true); // 👈 [추가 2]

    try {
      try {
        // 3. [기존 로직] 버튼 누른 시점의 현재 위치 가져오기
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;

        if (
          latitude &&
          longitude &&
          selectedPlace.latitude &&
          selectedPlace.longitude &&
          selectedPlace.radius
        ) {
          const distance = getDistance(
            latitude,
            longitude,
            selectedPlace.latitude,
            selectedPlace.longitude
          );

          if (distance <= selectedPlace.radius) {
            Alert.alert(
              "변경 불가",
              "장소 내부에 있을 때는 수정할 수 없습니다."
            );
            closeMenu();
            return; // 👈 함수 종료 (finally가 실행됨)
          }
        }
      } catch (e) {
        console.warn("Location check failed, allowing edit.", e);
      }

      // 4. [기존 로직] 외부일 경우 수정 실행
      closeMenu();
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
    } finally {
      setIsLoading(false); // 👈 [추가 3]
    }
  };

  const handleDelete = async () => {
    if (isLoading) return; // 👈 [추가 1]
    if (!selectedPlace) return;

    setIsLoading(true); // 👈 [추가 2]

    try {
      // 3. [기존 로직] 버튼 누른 시점의 현재 위치 가져오기
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;

      if (
        latitude &&
        longitude &&
        selectedPlace.latitude &&
        selectedPlace.longitude &&
        selectedPlace.radius
      ) {
        const distance = getDistance(
          latitude,
          longitude,
          selectedPlace.latitude,
          selectedPlace.longitude
        );

        if (distance <= selectedPlace.radius) {
          Alert.alert(
            "삭제 불가",
            "장소 내부에 있을 때는 삭제할 수 없습니다."
          );
          closeMenu();
          setIsLoading(false); // 👈 [추가 3a] - 경고 시 로딩 해제
          return;
        }
      }
    } catch (e) {
      console.warn("Location check failed, allowing delete.", e);
    }

    // 4. [기존 로직] 외부일 경우 삭제 Alert 표시
    closeMenu();
    Alert.alert(
      "삭제 확인",
      `"${selectedPlace.name}"를 삭제하시겠습니까?`,
      [
        {
          text: "취소",
          style: "cancel",
          onPress: () => setIsLoading(false), // 👈 [추가 3b] - 취소 시 로딩 해제
        },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              const updated = places.filter(
                (p) => p.id !== selectedPlace!.id // selectedPlace는 위에서 !null 체크됨
              );
              await savePlaces(updated);
              setSelectedPlace(null);
            } catch (e) {
              console.error("Delete failed", e);
            } finally {
              setIsLoading(false); // 👈 [추가 3c] - 삭제 완료 시 로딩 해제
            }
          },
        },
      ]
    );

    // 4. [기존 로직] 외부일 경우 삭제 실행
    closeMenu();
    Alert.alert("삭제 확인", `"${selectedPlace.name}"를 삭제하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          const updated = places.filter((p) => p.id !== selectedPlace.id);
          savePlaces(updated);
          setSelectedPlace(null);
        },
      },
    ]);
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setMenuAnchor(null);
    setSelectedPlace(null);
  };

  const goToAdd = () => {
    router.push("/(protected)/(tabs)/(focus_zone)/add");
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 7) RENDER: 리스트 아이템
  // ───────────────────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Place }) => {
    // ⭐️ [수정] useRef 제거하고 이벤트에서 직접 측정
    const handleMenuPress = (event: any) => {
      event.target.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setSelectedPlace(item);
        setMenuAnchor({ x: pageX, y: pageY, w: width, h: height });
        setMenuVisible(true);
      });
    };

    return (
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
              color={item.isActive ? "#0D4093" : "#D1D5DB"}
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

            <TouchableOpacity
              onPress={handleMenuPress}
              style={{ padding: 6 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={48} color="#D1D5DB" />
      <Text style={styles.emptyText}>등록된 집중장소가 없습니다</Text>
      <Text style={styles.emptySubText}>
        + 버튼을 눌러 새로운 집중장소를 추가해보세요
      </Text>
    </View>
  );

  const isAnyPlaceActive = places.some(p => p.isActive);

  // ───────────────────────────────────────────────────────────────────────────
  // 8) RETURN
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
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
            strokeColor={p.isActive ? "#0D4093" : "#9CA3AF"}
            fillColor={
              p.isActive ? "rgba(13,64,147,0.2)" : "rgba(156,163,175,0.2)"
            }
          />
        ))}

      </MapView>

      {/* ⭐️ [수정] map.tsx와 동일한 현재 위치 버튼 */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={getCurrentLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate-outline" size={22} color="#000" />
      </TouchableOpacity>

      <BottomSheet
  ref={bottomSheetRef}
  index={0}
  snapPoints={snapPoints}
  enablePanDownToClose={false}
  enableOverDrag={false}
  style={{
    backgroundColor: "#F9FAFB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 0.8,
    borderColor: "#E5E7EB",
  }}
>
  <BottomSheetView
    style={{
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 28,
      minHeight: 220,
    }}
  >
    {/* 상단 바 (handle) */}
    <View style={{ alignItems: "center", marginBottom: 10 }}>
      <View
        style={{
          width: 50,
          height: 5,
          backgroundColor: "#0",
          borderRadius: 3,
        }}
      />
    </View>

    {/* 헤더 영역 */}
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: "#0D4093",
          letterSpacing: -0.5,
        }}
      >
        집중장소
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text
          style={{
            fontSize: 15,
            color: "#6B7280",
            fontWeight: "600",
            marginRight: 6,
          }}
        >
          {places.filter((p) => p.isActive).length}/{places.length}
        </Text>

        {/* 전체 on/off 버튼 */}
        <TouchableOpacity
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#0D4093",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
          onPress={toggleAllActive}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isAnyPlaceActive ? "power-outline" : "power"}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>

        {/* 장소 추가 버튼 */}
        <TouchableOpacity
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#0D4093",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
          onPress={goToAdd}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>

    {/* 리스트 */}
    <FlatList
      data={places}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListEmptyComponent={renderEmptyList}
      contentContainerStyle={{
        paddingBottom: 16,
        flexGrow: 1,
      }}
      showsVerticalScrollIndicator={false}
    />
  </BottomSheetView>
</BottomSheet>


      {/* ⭐️ [수정] group_zone과 동일한 메뉴 */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <View />
        </Pressable>
        <View
          style={[
            styles.menuBox,
            {
              position: 'absolute',
              top: menuTop,
              left: menuLeft,
            }
          ]}
        >
          <Pressable style={styles.menuItem} onPress={handleEdit}>
            <Text style={styles.menuText}>수정하기</Text>
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable style={styles.menuItem} onPress={handleDelete}>
            <Text style={[styles.menuText, styles.menuDanger]}>
              삭제하기
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ⭐️ [수정] map.tsx와 동일한 스타일
  locationButton: {
    position: "absolute",
    top: 40, // 검색바 아래 위치
    right: 16,
    width: 46,
    height: 46,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 23,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
  },

  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 32,
    minHeight: 200,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0D4093",
    letterSpacing: -0.5,
  },

  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  countText: {
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "600",
    marginRight: 6,
  },

  toggleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0D4093",
    justifyContent: "center",
    alignItems: "center",
  },

  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0D4093",
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
    borderColor: "#0D4093",
    backgroundColor: "rgba(13,64,147,0.06)",
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

  // ⭐️ [수정] group_zone과 동일한 메뉴 스타일
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)"
  },
  menuBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 4,
    width: 180,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  menuText: {
    fontSize: 14,
    color: "#222",
  },
  menuDanger: {
    color: "#DC2626",
    fontWeight: "700"
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },
});
