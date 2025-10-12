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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  Circle,
  MapPressEvent,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

// ──────────────────────────────────────────────────────────────────────────────
// 1) CONSTANTS / TYPES
// ──────────────────────────────────────────────────────────────────────────────
// ⚠️ 실제에선 .env 등으로 키 숨겨서 import 하세요
const KAKAO_REST_API_KEY = "f1debfd3567cd9e9d3cc99c5c41c2b7c";

type KakaoSearchPlace = {
  id: string;
  place_name: string;
  x: string; // lng
  y: string; // lat
  road_address_name?: string;
  address_name?: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// 2) PURE UTILS (좌표 변환 / Kakao API 호출 / 스냅)
//    - 컴포넌트 바깥에 두어 재생성 방지 & 가독성 ↑
// ──────────────────────────────────────────────────────────────────────────────
// <미터 → 위도/경도 변화량 변환>
const metersToLatDelta = (m: number) => m / 111320;
const metersToLngDelta = (m: number, lat: number) =>
  m / (111320 * Math.cos((lat * Math.PI) / 180));

/** 좌표 → 도로명 주소만 (없으면 null) */
// <카카오 REST API 사용을 하여 도로명 주소를 가져옴>
async function getRoadAddressFromCoords(latitude: number, longitude: number) {
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${longitude}&y=${latitude}&input_coord=WGS84`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }
    );
    const data = await res.json();
    const doc = data?.documents?.[0];
    return doc?.road_address?.address_name ?? null;
  } catch (e) {
    console.error("도로명 역지오코딩 실패:", e);
    return null;
  }
}

/** 주변 ±radiusM(기본 25m) 8방 탐색해서 가장 가까운 도로명 좌표를 스냅 */
// <도로 위에 가장 가까운 좌표를 찾기 위해 8방 탐색>
async function findNearestRoadAddress(
  lat: number,
  lng: number,
  radiusM = 25
): Promise<{ road: string; lat: number; lng: number } | null> {
  const candidates = [
    [0, 0],
    [radiusM, 0],
    [-radiusM, 0],
    [0, radiusM],
    [0, -radiusM],
    [radiusM, radiusM],
    [radiusM, -radiusM],
    [-radiusM, radiusM],
    [-radiusM, -radiusM],
  ];

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
// <구글지도를 사용하지만 카카오 API로 주소 검색 및 도로명 스냅핑 기능을 구현>
export default function KakaoMapScreen() {
  // 3-1) NAV / REFS / PARAMS
  const router = useRouter();
  const params = useLocalSearchParams(); // add.tsx에서 전달된 파라미터들
  const mapRef = useRef<MapView>(null); //지도 움직 이는 용도

  // 3-2) STATE: 지도/선택/표시/검색
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
    // 초기 지도 위치
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta: 0.004, // 확대 수준
    longitudeDelta: 0.004,
  });

  const [selectedLocation, setSelectedLocation] = useState({
    // 선택된 위치
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
    // 반경
    params.radius ? Number(params.radius) : 100 // 기본 100m
  );
  const [reverse, setReverse] = useState(false); // 반경 밖 여부
  const [address, setAddress] = useState<string>( // 도로명 주소
    (params.address as string) || ""
  );

  // 검색 상태
  const [query, setQuery] = useState(""); // 검색어
  const [searching, setSearching] = useState(false); // 검색 중인지 확인
  const [results, setResults] = useState<KakaoSearchPlace[]>([]); // 검색 결과
  const [showResults, setShowResults] = useState(false); // 결과 표시 여부

  // 3-3) OPTIONS
  const enableSnapToRoad = true; // 도로 스냅 보정 사용(검색을 위한)

  // ──────────────────────────────────────────────────────────────────────────
  // 3-4) EFFECTS: 초기 로드 시 도로명 주소 보정
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const road = await getRoadAddressFromCoords(
        // road: 도로명 주소 getRoadAddressFromCoords 함수(카카오지도에서 묻는 함수) 사용
        selectedLocation.latitude,
        selectedLocation.longitude
      );
      if (road) {
        setAddress(road);
      } else if (enableSnapToRoad) {
        const snapped = await findNearestRoadAddress(
          // 가장 가까운 도로명 좌표를 스냅
          selectedLocation.latitude,
          selectedLocation.longitude,
          25 // 반경 25m 내에서 탐색
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
    // 얘야 이번 한줄은 그냥 넘어가 주세요 eslint님
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 3-5) HANDLERS — 지도/현재위치/검색/저장 등
  // ──────────────────────────────────────────────────────────────────────────
  /** 지도 위치로 부드럽게 이동 */
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

  /** 반지름 슬라이더 */
  const handleSliderChange = (value: number) => setRadius(value);

  /** 공통 적용: 좌표 → (도로명만) 주소 확정 + 지도/상태 업데이트 */
  const applyAddressByCoords = async (lat: number, lng: number) => {
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

  /** 지도 탭 */
  const onMapPress = async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const ok = await applyAddressByCoords(latitude, longitude);
    if (ok) {
      setShowResults(false);
      Keyboard.dismiss();
    }
  };

  /** 현재 위치로 이동 */
  const getCurrentLocation = async () => {
    try {
      // 수정 모드: 저장 좌표 우선
      if (params.editMode === "true" && params.latitude && params.longitude) {
        const savedLat = Number(params.latitude);
        const savedLng = Number(params.longitude);
        const ok = await applyAddressByCoords(savedLat, savedLng);
        if (ok) return;
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
      if (ok) setShowResults(false);
    } catch (error) {
      console.error("현재 위치 실패:", error);
      Alert.alert("오류", "현재 위치를 가져올 수 없습니다.");
    }
  };

  /** 카카오: 장소명/주소 검색 */
  const searchPlaces = async () => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setShowResults(false);
      return;
    }
    try {
      setSearching(true);

      // 1) 키워드(POI) 검색
      const poiRes = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
          q
        )}&size=10`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }
      );
      const poiJson = await poiRes.json();
      const poiDocs: KakaoSearchPlace[] = poiJson?.documents ?? [];

      // 2) 주소(도로명/지번) 검색
      const addrRes = await fetch(
        `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(
          q
        )}&size=10`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }
      );
      const addrJson = await addrRes.json();
      const addrDocsRaw = addrJson?.documents ?? [];
      const addrDocs: KakaoSearchPlace[] = addrDocsRaw.map(
        (d: any, idx: number) => ({
          id:
            `addr-${idx}-` +
            (d.road_address?.address_name ??
              d.address?.address_name ??
              String(idx)),
          place_name:
            d.road_address?.address_name ?? d.address?.address_name ?? "주소",
          x: d.x ?? d.address?.x ?? d.road_address?.x, // lng
          y: d.y ?? d.address?.y ?? d.road_address?.y, // lat
          address_name: d.address?.address_name,
          road_address_name: d.road_address?.address_name,
        })
      );

      setResults([...poiDocs, ...addrDocs]);
      setShowResults(true);
      Keyboard.dismiss();
    } catch (err) {
      console.error("검색 실패:", err);
      Alert.alert("오류", "검색에 실패했습니다.");
    } finally {
      setSearching(false);
    }
  };

  /** 검색 결과 선택 → 좌표로 확정(도로명만) */
  const selectResult = async (item: KakaoSearchPlace) => {
    const lat = Number(item.y);
    const lng = Number(item.x);
    const ok = await applyAddressByCoords(lat, lng);
    if (ok) setShowResults(false);
  };

  /** 다음 화면으로 전달 */
  const handleContinue = async () => {
    const draft = {
      address,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      radius,
    };
    await AsyncStorage.setItem("focusPlaceDraft", JSON.stringify(draft));
    router.back(); // ← 그대로 돌아가기 (add.tsx state 유지)
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3-6) RENDER
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
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={onMapPress}
        mapType="standard"
      >
        {/* 선택 영역(원) */}
        {isValidCoord(selectedLocation.latitude, selectedLocation.longitude) && (
            <Circle
              center={selectedLocation}
              radius={radius}
              strokeWidth={2}
              strokeColor="#75B8FA"
              fillColor="rgba(117,184,250,0.25)"
            />
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
        <Ionicons name="locate" size={25} color="#2E82FF" />
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

        <View style={styles.row}>
          <Text style={styles.label}>역 반지름</Text>
          <Switch value={reverse} onValueChange={setReverse} />
        </View>

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
