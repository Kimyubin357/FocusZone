import { Ionicons } from "@expo/vector-icons";
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

// ... (파일 상단부 임포트 및 유틸 함수들은 모두 동일) ...
// ──────────────────────────────────────────────────────────────────────────────
// 1) CONSTANTS / TYPES
// ──────────────────────────────────────────────────────────────────────────────
const GOOGLE_WEB_API_KEY = "AIzaSyAvid2EBP0GgrNfzKcF7goUZlQWNbrbF94"; // ⭐️ 키는 .env 등으로 숨기세요
type SearchPlace = { id: string; place_name: string; x: string; y: string; road_address_name?: string; address_name?: string; };
type GooglePlace = { /* ... */ };
// ──────────────────────────────────────────────────────────────────────────────
// 2) PURE UTILS (좌표 변환 / API 호출 / 스냅)
// ──────────────────────────────────────────────────────────────────────────────
const metersToLatDelta = (m: number) => m / 111320;
const metersToLngDelta = (m: number, lat: number) =>
  m / (111320 * Math.cos((lat * Math.PI) / 180));
// ... (getRoadAddressFromCoords, findNearestRoadAddress 함수 동일) ...
async function getRoadAddressFromCoords(latitude: number, longitude: number) {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=ko&key=${GOOGLE_WEB_API_KEY}`
    );
    // ... (함수 내용 동일)
    const data = await res.json();
    const first = data?.results?.[0];
    if (!first) return null;
    const comps = first.address_components || [];
    const sido = comps.find(c => c.types.includes("administrative_area_level_1"))?.long_name || "";
    const sigungu = comps.find(c => c.types.includes("locality"))?.long_name || "";
    const gu = comps.find(c => c.types.includes("sublocality_level_1"))?.long_name || "";
    const road = comps.find(c => c.types.includes("route"))?.long_name || "";
    const building = comps.find(c => c.types.includes("premise"))?.long_name || "";
    const simpleAddress = [sido, sigungu, gu, road, building].filter(Boolean).join(" ");
    return simpleAddress || first.formatted_address || null;
  } catch (e) {
    console.error("도로명 역지오코딩 실패:", e);
    return null;
  }
}
async function findNearestRoadAddress(
  lat: number,
  lng: number,
  radiusM = 25
): Promise<{ road: string; lat: number; lng: number } | null> {
  // ... (함수 내용 동일)
  const candidates = [ [0, 0], [radiusM, 0], [-radiusM, 0], [0, radiusM], [0, -radiusM], [radiusM, radiusM], [radiusM, -radiusM], [-radiusM, radiusM], [-radiusM, -radiusM], ];
  for (const [dm, dn] of candidates) {
    const tryLat = lat + metersToLatDelta(dn);
    const tryLng = lng + metersToLngDelta(dm, lat);
    const road = await getRoadAddressFromCoords(tryLat, tryLng);
    if (road) return { road, lat: tryLat, lng: tryLng };
  }
  return null;
}
// ──────────────────────────────────────────────────────────────────────────────
/** 3) COMPONENT */
// ──────────────────────────────────────────────────────────────────────────────
export default function KakaoMapScreen() {
  // 3-1) NAV / REFS / PARAMS
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const mapRef = useRef<MapView>(null); 

  // 3-2) STATE: 지도/선택/표시/검색
  // ... (parseNumber, initialLat, initialLng, region, selectedLocation 등 상태 동일) ...
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
    if ( isValidCoord(next.latitude, next.longitude) && Number.isFinite(next.latitudeDelta) && Number.isFinite(next.longitudeDelta) ) {
      setRegion(next);
    }
  };
  const [radius, setRadius] = useState(
    params.radius ? Number(params.radius) : 100
  );
  const [reverse, setReverse] = useState(false);
  const [address, setAddress] = useState<string>(
    (params.address as string) || ""
  );
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchPlace[]>([]);
  const [showResults, setShowResults] = useState(false);

  // 3-3) OPTIONS
  const enableSnapToRoad = true;

  // ──────────────────────────────────────────────────────────────────────────
  // 3-4) EFFECTS: 초기 로드 시 도로명 주소 보정
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // ... (useEffect 로직 동일) ...
    (async () => {
      // ⭐️ address가 이미 params로 전달된 경우 (즉, add.tsx에서 설정된 값)
      // 맵 로드 시 역지오코딩을 다시 실행하지 않고 해당 주소를 사용
      if (address) {
        return;
      }

      // ⭐️ params에 address가 없는 경우 (최초 진입 또는 좌표만 있는 경우)
      const road = await getRoadAddressFromCoords(
        selectedLocation.latitude,
        selectedLocation.longitude
      );
      if (road) {
        setAddress(road);
      } else if (enableSnapToRoad) {
        const snapped = await findNearestRoadAddress(
          selectedLocation.latitude,
          selectedLocation.longitude,
          25
        );
        if (snapped) {
          setSelectedLocation({
            latitude: snapped.lat,
            longitude: snapped.lng,
          });
          animateTo(snapped.lat, snapped.lng);
          setAddress(snapped.road);
        }
      }
    })();
  }, []); // ⭐️ deps [] 유지

  // ──────────────────────────────────────────────────────────────────────────
  // 3-5) HANDLERS — 지도/현재위치/검색/저장 등
  // ──────────────────────────────────────────────────────────────────────────
  const animateTo = (lat: number, lng: number) => {
    // ... (함수 내용 동일) ...
    const next: Region = { latitude: lat, longitude: lng, latitudeDelta: 0.008, longitudeDelta: 0.008, };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 250);
  };
  const handleSliderChange = (value: number) => setRadius(value);
  const applyAddressByCoords = async (lat: number, lng: number) => {
    // ... (함수 내용 동일) ...
    let road = await getRoadAddressFromCoords(lat, lng);
    let fLat = lat;
    let fLng = lng;
    if (!road && enableSnapToRoad) {
      const snapped = await findNearestRoadAddress(lat, lng, 25);
      if (snapped) {
        road = snapped.road;
        fLat = snapped.lat;
        fLng = snapped.lng;
      }
    }
    if (!road) {
      Alert.alert("도로명 주소 필요", "도로 위 근처로 이동해 다시 눌러주세요.");
      return false;
    }
    setSelectedLocation({ latitude: fLat, longitude: fLng });
    animateTo(fLat, fLng);
    setAddress(road);
    return true;
  };
  const onMapPress = async (e: MapPressEvent) => {
    // ... (함수 내용 동일) ...
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const ok = await applyAddressByCoords(latitude, longitude);
    if (ok) {
      setShowResults(false);
      Keyboard.dismiss();
    }
  };
  const getCurrentLocation = async () => {
    // ... (함수 내용 동일) ...
    try {
      if (params.editMode === "true" && params.latitude && params.longitude) {
        const savedLat = Number(params.latitude);
        const savedLng = Number(params.longitude);
        const ok = await applyAddressByCoords(savedLat, savedLng);
        if (ok) return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      const ok = await applyAddressByCoords(latitude, longitude);
      if (ok) setShowResults(false);
    } catch (error) {
      console.error("현재 위치 실패:", error);
      Alert.alert("오류", "현재 위치를 가져올 수 없습니다.");
    }
  };
  const searchPlaces = async () => {
    // ... (함수 내용 동일) ...
    const q = query.trim();
    if (!q) { setResults([]); setShowResults(false); return; }
    try {
      setSearching(true);
      const lat = region.latitude;
      const lng = region.longitude;
      const radius = 1500;
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(q)}&language=ko&region=KR&key=${GOOGLE_WEB_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status !== "OK") {
        console.error("검색 실패:", json.status, json.error_message);
        Alert.alert("오류", "검색에 실패했습니다.");
        return;
      }
      const mapped: SearchPlace[] = json.results.map((p: any) => ({
        id: p.place_id,
        place_name: p.name,
        x: String(p.geometry?.location?.lng ?? 0),
        y: String(p.geometry?.location?.lat ?? 0),
        road_address_name: p.vicinity,
        address_name: p.vicinity,
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
    // ... (함수 내용 동일) ...
    const lat = Number(item.y);
    const lng = Number(item.x);
    const ok = await applyAddressByCoords(lat, lng);
    if (ok) setShowResults(false);
  };

  const handleContinue = () => {
    // ... (함수 내용 동일) ...
    // 1. 유효성 검사
    if (!address || address === "도로명 주소를 선택하세요") {
      Alert.alert("안내", "유효한 주소를 선택해주세요.");
      return;
    }
    if (
      !isValidCoord(selectedLocation.latitude, selectedLocation.longitude)
    ) {
      Alert.alert("안내", "유효한 좌표가 선택되지 않았습니다.");
      return;
    }

    // 2. add.tsx로 돌려보낼 파라미터 준비
    const returnParams: Record<string, any> = { 
      ...params,

      // 2-2. ⭐️ 맵에서 수정한 값으로 덮어쓰기
      address: address,
      latitude: selectedLocation.latitude.toString(),
      longitude: selectedLocation.longitude.toString(),
      radius: radius.toString(),
    };
    
    // 3. router.replace를 사용해 'add.tsx'로 파라미터를 들고 복귀
    router.replace({
      pathname: "/(protected)/(tabs)/(group_zone)/add",
      params: returnParams,
    });
  };

  // ⭐️ [추가] 수동으로 'add.tsx'로 돌아가는 함수
  const handleGoBack = () => {
    // 맵에서 아무것도 저장하지 않고,
    // add.tsx에서 받았던 params를 그대로 들고 add.tsx로 복귀
    router.replace({
      pathname: "/(protected)/(tabs)/(group_zone)/add",
      params: params, // ⭐️ add.tsx에서 받은 params 그대로 반환
    });
  };
  
  // ──────────────────────────────────────────────────────────────────────────
  // 3-6) RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* ⭐️ [수정] 검색 바 */}
      <View className="searchbar" style={styles.searchBarWrap}>
        {/* ⭐️ [추가] 수동 뒤로가기 버튼 */}
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#555" />
        </TouchableOpacity>

        <Ionicons
          name="search"
          size={18}
          color="#999"
          style={{ marginRight: 6 }}
        />
        <TextInput
          style={styles.searchInput}
          value={query}
          // ... (onChangeText 등 나머지 props 동일)
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

      {/* ... (MapView, 검색 결과, 현재 위치 버튼, 하단 패널 JSX 모두 동일) ... */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={onMapPress}
        mapType="standard"
        showsUserLocation={true}
        showsMyLocationButton={false}
        userLocationAnnotationTitle="내 위치"
        userLocationPriority="high"
        followsUserLocation={true}
      >
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
      <TouchableOpacity
        style={styles.locationButton}
        onPress={getCurrentLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate-outline" size={22} color="#000" />
      </TouchableOpacity>
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
  // ... (스타일 동일)
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },

  // 검색 바
  searchBarWrap: {
  // ... (스타일 동일)
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
  // ⭐️ [추가] 뒤로가기 버튼 스타일
  backBtn: {
    paddingRight: 10, // 아이콘과 검색 아이콘 사이 간격
  },
  searchInput: {
  // ... (스타일 동일)
    flex: 1,
    fontSize: 14,
    color: "#222",
    paddingVertical: 0,
  },
  clearBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  searchBtn: {
  // ... (스타일 동일)
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#2E82FF",
    borderRadius: 6,
  },
  searchBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // ... (resultSheet, locationButton, panel 등 나머지 스타일 모두 동일) ...
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