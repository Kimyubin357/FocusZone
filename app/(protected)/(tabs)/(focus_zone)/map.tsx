// app/(protected)/(tabs)/(focus_zone)/map.tsx
// ──────────────────────────────────────────────────────────────────────────────
// 0) IMPORTS
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import MapView, {
  Circle,
  MapPressEvent, Marker, PROVIDER_GOOGLE,
  Region
} from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

// ──────────────────────────────────────────────────────────────────────────────
// 1) CONSTANTS / TYPES
// ──────────────────────────────────────────────────────────────────────────────
const KAKAO_REST_API_KEY = "f1debfd3567cd9e9d3cc99c5c41c2b7c";

type SearchPlace = {
  id: string;
  place_name: string;
  x: string; // lng
  y: string; // lat
  road_address_name?: string;
  address_name?: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// 2) PURE UTILS (컴포넌트 외부)
// ──────────────────────────────────────────────────────────────────────────────
const metersToLatDelta = (m: number) => m / 111320;
const metersToLngDelta = (m: number, lat: number) =>
  m / (111320 * Math.cos((lat * Math.PI) / 180));

/** 좌표 → 도로명 주소 (Kakao Local API 사용) */
async function getRoadAddressFromCoords(latitude: number, longitude: number) {
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${longitude}&y=${latitude}&input_coord=WGS84`,
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      }
    );
    
    const data = await res.json();
    
    if (!data.documents || data.documents.length === 0) {
      return null;
    }

    const doc = data.documents[0];
    
    // 도로명 주소 우선
    if (doc.road_address) {
      const ra = doc.road_address;
      const parts: string[] = [];
      
      if (ra.region_1depth_name) parts.push(ra.region_1depth_name);
      if (ra.region_2depth_name) parts.push(ra.region_2depth_name);
      if (ra.region_3depth_name) parts.push(ra.region_3depth_name);
      if (ra.road_name) parts.push(ra.road_name);
      if (ra.main_building_no) {
        if (ra.sub_building_no && ra.sub_building_no !== '0') {
          parts.push(`${ra.main_building_no}-${ra.sub_building_no}`);
        } else {
          parts.push(ra.main_building_no);
        }
      }
      
      const roadAddress = parts.join(' ');
      return roadAddress;
    }
    
    // 도로명 주소 없으면 지번 주소 (동까지만)
    if (doc.address) {
      const addr = doc.address;
      const parts: string[] = [];
      
      if (addr.region_1depth_name) parts.push(addr.region_1depth_name);
      if (addr.region_2depth_name) parts.push(addr.region_2depth_name);
      if (addr.region_3depth_name) parts.push(addr.region_3depth_name);
      if (addr.region_3depth_h_name) parts.push(addr.region_3depth_h_name);
      
      const jibunAddress = parts.join(' ');
      return jibunAddress;
    }
    
    return null;
  } catch (e) {
    console.error('[getRoadAddress] Error:', e);
    return null;
  }
}

/** 근처 좌표 탐색하여 도로명 주소 찾기 */
async function findNearestRoadAddress(
  latitude: number,
  longitude: number,
  radiusM: number = 30
): Promise<string | null> {
  const offsets = [
    [0, 0],
    [radiusM, 0],
    [-radiusM, 0],
    [0, radiusM],
    [0, -radiusM],
    [radiusM, radiusM],
    [radiusM, -radiusM],
    [-radiusM, radiusM],
    [-radiusM, -radiusM],
    [radiusM / 2, 0],
    [-radiusM / 2, 0],
    [0, radiusM / 2],
    [0, -radiusM / 2],
  ];

  for (let i = 0; i < offsets.length; i++) {
    const [offsetX, offsetY] = offsets[i];
    
    const tryLat = latitude + metersToLatDelta(offsetY);
    const tryLng = longitude + metersToLngDelta(offsetX, latitude);
    
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${tryLng}&y=${tryLat}&input_coord=WGS84`,
        {
          headers: {
            Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
          },
        }
      );
      
      const data = await res.json();
      
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        
        if (doc.road_address) {
          const ra = doc.road_address;
          const parts: string[] = [];
          
          if (ra.region_1depth_name) parts.push(ra.region_1depth_name);
          if (ra.region_2depth_name) parts.push(ra.region_2depth_name);
          if (ra.region_3depth_name) parts.push(ra.region_3depth_name);
          if (ra.road_name) parts.push(ra.road_name);
          if (ra.main_building_no) {
            if (ra.sub_building_no && ra.sub_building_no !== '0') {
              parts.push(`${ra.main_building_no}-${ra.sub_building_no}`);
            } else {
              parts.push(ra.main_building_no);
            }
          }
          
          const roadAddress = parts.join(' ');
          return roadAddress;
        }
      }
    } catch (err) {
      console.error(`[findNearestRoad] Error (${i + 1}):`, err);
    }
  }
  
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// 3) COMPONENT
// ──────────────────────────────────────────────────────────────────────────────
export default function KakaoMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView>(null);

  const parseNumber = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "" || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const initialLat = parseNumber(params.latitude) ?? 37.5665;
  const initialLng = parseNumber(params.longitude) ?? 126.978;

  const [region, setRegion] = useState<Region>({
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta: 0.004,
    longitudeDelta: 0.004,
  });

  const [selectedLocation, setSelectedLocation] = useState({
    latitude: initialLat,
    longitude: initialLng,
  });

  const isValidCoord = (lat: any, lng: any) =>
    Number.isFinite(lat) && Number.isFinite(lng);

  const handleRegionChangeComplete = (next: Region) => {
    if (
      isValidCoord(next.latitude, next.longitude) &&
      Number.isFinite(next.latitudeDelta) &&
      Number.isFinite(next.longitudeDelta)
    ) {
      setRegion(next);
    }
  };

  const [radius, setRadius] = useState(
    params.radius ? Number(params.radius) : 100
  );
  const [address, setAddress] = useState<string>(
    (params.address as string) || ""
  );
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchPlace[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    (async () => {
      const road = await getRoadAddressFromCoords(
        selectedLocation.latitude,
        selectedLocation.longitude
      );
      if (road) {
        setAddress(road);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateTo = (lat: number, lng: number) => {
    const next: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 250);
  };

  const handleSliderChange = (value: number) => setRadius(value);

  const applyAddressByCoords = async (lat: number, lng: number) => {
    let road = await getRoadAddressFromCoords(lat, lng);
    
    // 도로명 주소가 없으면 근처 탐색
    if (!road || !road.includes('로') && !road.includes('길')) {
      const nearestRoad = await findNearestRoadAddress(lat, lng, 30);
      
      if (nearestRoad) {
        road = nearestRoad;
      }
    }
    
    // 도로명이 없으면 Alert
    if (!road || (!road.includes('로') && !road.includes('길'))) {
      Alert.alert(
        "도로명 주소 필요", 
        "도로명 주소가 있는 위치를 선택해주세요.\n\n현재: " + (road || "주소 없음") + "\n\n도로나 건물 근처를 클릭해주세요."
      );
      return false;
    }
    
    setSelectedLocation({ latitude: lat, longitude: lng });
    animateTo(lat, lng);
    setAddress(road);
    
    return true;
  };

  const onMapPress = async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const ok = await applyAddressByCoords(latitude, longitude);
    if (ok) {
      setShowResults(false);
      Keyboard.dismiss();
    }
  };

  const getCurrentLocation = async () => {
    try {
      if (params.editMode === "true" && params.latitude && params.longitude) {
        const savedLat = Number(params.latitude);
        const savedLng = Number(params.longitude);
        
        const ok = await applyAddressByCoords(savedLat, savedLng);
        if (ok) {
          return;
        }
      }
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("권한 필요", "위치 권한을 허용해주세요.");
        return;
      }
      
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const { latitude, longitude } = loc.coords;
      
      const ok = await applyAddressByCoords(latitude, longitude);
      
      if (ok) {
        setShowResults(false);
      }
    } catch (error) {
      console.error('[getCurrentLocation] Error:', error);
      Alert.alert("오류", "현재 위치를 가져올 수 없습니다.");
    }
  };

  const searchPlaces = async () => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setShowResults(false);
      return;
    }
    try {
      setSearching(true);

      const lat = region.latitude;
      const lng = region.longitude;

      // ⭐️ [수정] 1차 검색: 근처 1.5km 검색 (거리순)
      let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
        q
      )}&x=${lng}&y=${lat}&radius=1500&size=15&sort=distance`;

      let res = await fetch(url, {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      });
      
      let json = await res.json();
      
      // ⭐️ [추가] 근처에 결과 없으면 전국 검색 (정확도순)
      if (!json.documents || json.documents.length === 0) {
        url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
          q
        )}&size=15&sort=accuracy`;
        // x, y, radius 제거 → 전국 검색
      
        res = await fetch(url, {
          headers: {
            Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
          },
        });
        
        json = await res.json();
      }
      
      if (!json.documents || json.documents.length === 0) {
        setResults([]);
        setShowResults(false);
        return;
      }

      const mapped: SearchPlace[] = json.documents.map((p: any) => ({
        id: p.id,
        place_name: p.place_name,
        x: p.x,
        y: p.y,
        road_address_name: p.road_address_name || p.address_name,
        address_name: p.address_name,
      }));
      
      setResults(mapped);
      setShowResults(true);
      Keyboard.dismiss();
    } catch (err) {
      console.error("검색 실패:", err);
      Alert.alert("오류", "검색에 실패했습니다.");
    } finally {
      setSearching(false);
    }
  };

  const selectResult = async (item: SearchPlace) => {
    const lat = Number(item.y);
    const lng = Number(item.x);
    const ok = await applyAddressByCoords(lat, lng);
    if (ok) setShowResults(false);
  };

  const handleContinue = async () => {
    const draft = {
      address,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      radius,
    };
    await AsyncStorage.setItem("focusPlaceDraft", JSON.stringify(draft));
    router.back();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* 검색 바 */}
      <View className="searchbar" style={styles.searchBarWrap}>
        <Ionicons
          name="search"
          size={18}
          color="#999"
          style={{ marginRight: 6 }}
        />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (!t) {
              setResults([]);
              setShowResults(false);
            }
          }}
          placeholder="도로명 주소 또는 장소 검색"
          returnKeyType="search"
          onSubmitEditing={searchPlaces}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery("");
              setResults([]);
              setShowResults(false);
            }}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color="#bbb" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={searchPlaces}
          disabled={searching}
        >
          <Text style={styles.searchBtnText}>
            {searching ? "검색중..." : "검색"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 지도 */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={onMapPress}
        mapType="standard"
        showsUserLocation={true}
        showsMyLocationButton={false}
        userLocationAnnotationTitle="내 위치"
        userLocationPriority="high"
        followsUserLocation={true}
      >
        {/* 선택 영역(원) */}
        {isValidCoord(selectedLocation.latitude, selectedLocation.longitude) && (
          <>
            <Circle
              center={selectedLocation}
              radius={radius}
              strokeWidth={2}
              strokeColor="#75B8FA"
              fillColor="rgba(117,184,250,0.25)"
            />
            <Marker
              coordinate={selectedLocation}
              title="선택 위치"
              description={address || "도로명 주소 없음"}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.simpleMarker}>
                <Ionicons name="pin" size={27} color="#2E82FF" />
              </View>
            </Marker>
          </>
        )}
      </MapView>

      {/* 검색 결과 리스트 */}
      {showResults && results.length > 0 && (
        <View style={styles.resultSheet}>
          <FlatList
            data={results}
            keyExtractor={(item) =>
              item.id ?? item.place_name + item.x + item.y
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => selectResult(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {item.place_name}
                </Text>
                <Text style={styles.resultSub} numberOfLines={1}>
                  {item.road_address_name ||
                    item.address_name ||
                    "주소 정보 없음"}
                </Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        </View>
      )}

      {/* 현재 위치 버튼 */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={getCurrentLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate-outline" size={22} color="#000" />
      </TouchableOpacity>

      {/* 하단 패널 */}
      <View style={styles.panel}>
        <View style={styles.row}>
          <Text style={styles.label}>도로명 주소</Text>
          <Text style={styles.value} numberOfLines={2}>
            {address || "도로명 주소를 선택하세요"}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>반지름</Text>
          <Text style={styles.value}>{radius}m</Text>
        </View>

        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={10}
          maximumValue={100}
          step={5}
          value={radius}
          onValueChange={handleSliderChange}
        />

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>계속하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 4) STYLES
// ──────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  simpleMarker: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },

  // 검색 바
  searchBarWrap: {
    position: "absolute",
    top: 30,
    left: 16,
    right: 16,
    height: 44,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 1100,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#222",
    paddingVertical: 0,
  },
  clearBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  searchBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#2E82FF",
    borderRadius: 6,
  },
  searchBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // 결과 시트
  resultSheet: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    maxHeight: 260,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    zIndex: 1050,
  },
  resultItem: { paddingVertical: 8 },
  resultTitle: { fontSize: 14, color: "#111", fontWeight: "600" },
  resultSub: { fontSize: 12, color: "#666", marginTop: 2 },

  // 현재 위치 버튼
  locationButton: {
    position: "absolute",
    top: 90,
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

  // 하단 패널
  panel: {
    position: "absolute",
    bottom: 60,
    left: 16,
    right: 16,
    backgroundColor: "#1C1C1E",
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: { fontSize: 16, color: "#aaa" },
  value: {
    fontSize: 16,
    color: "#4DA3FF",
    flex: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  button: {
    backgroundColor: "#2E82FF",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
