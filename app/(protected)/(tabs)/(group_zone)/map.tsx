// app/(protected)/(tabs)/(group_zone)/map.tsx
import { Ionicons } from '@expo/vector-icons';
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const KAKAO_REST_API_KEY = "f1debfd3567cd9e9d3cc99c5c41c2b7c";

const KAKAO_MAP_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Kakao Map</title>
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; }
    </style>
    <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=08a2de71046acd72f7f1c67a474c9e17"></script>
  </head>
  <body>
    <div id="map" style="width:100%;height:100%;"></div>
    <script>
      var mapContainer = document.getElementById("map");
      var mapOption = {
        center: new kakao.maps.LatLng(37.5665, 126.9780), // 기본 서울시청
        level: 3
      };
      var map = new kakao.maps.Map(mapContainer, mapOption);

      var marker = new kakao.maps.Marker({
        position: map.getCenter()
      });

      var circle = new kakao.maps.Circle({
        center: map.getCenter(),
        radius: 500,
        strokeWeight: 2,
        strokeColor: "#75B8FA",
        strokeOpacity: 1,
        strokeStyle: "dashed",
        fillColor: "#CFE7FF",
        fillOpacity: 0.5
      });

      circle.setMap(map);

      kakao.maps.event.addListener(map, "click", function(mouseEvent) {
        var latlng = mouseEvent.latLng;
        marker.setPosition(latlng);
        marker.setMap(map);
        circle.setPosition(latlng);

        window.ReactNativeWebView.postMessage(JSON.stringify({
          latitude: latlng.getLat(),
          longitude: latlng.getLng()
        }));
      });

      window.addEventListener("message", function(event) {
        try {
          var data = JSON.parse(event.data);
          if (data.type === 'updateRadius') {
            circle.setRadius(data.radius);
          } else if (data.type === 'moveToLocation') {
            var newCenter = new kakao.maps.LatLng(data.latitude, data.longitude);
            map.setCenter(newCenter);
            marker.setMap(map); // 
            marker.setPosition(newCenter);
            circle.setPosition(newCenter);
            if(data.radius) {
              circle.setRadius(data.radius);
            }
          }
        } catch (e) {
          var newRadius = parseInt(event.data);
          if (!isNaN(newRadius)) {
            circle.setRadius(newRadius);
          }
        }
      }, false);
    </script>
  </body>
</html>
`;

export default function GroupKakaoMapScreen() {
  const webviewRef = useRef<WebView>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  const [radius, setRadius] = useState(params.radius ? Number(params.radius) : 400);
  const [address, setAddress] = useState(params.address || "북대동 2201-12, 청주시");
  const [reverse, setReverse] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: params.latitude ? Number(params.latitude) : 37.5665,
    longitude: params.longitude ? Number(params.longitude) : 126.9780
  });

  // 반지름 조정
  const handleSliderChange = (value: number) => {
    setRadius(value);
    if (webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({
        type: 'updateRadius',
        radius: value
      }));
    }
  };

  // 현재 위치 버튼
  const getCurrentLocation = async () => {
    try {
      if (params.editMode === 'true' && params.latitude && params.longitude) {
        const savedLat = Number(params.latitude);
        const savedLng = Number(params.longitude);

        if (webviewRef.current) {
          webviewRef.current.postMessage(JSON.stringify({
            type: 'moveToLocation',
            latitude: savedLat,
            longitude: savedLng,
            radius
          }));
        }

        setSelectedLocation({ latitude: savedLat, longitude: savedLng });
        setAddress(params.address as string);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '위치 권한을 허용해주세요.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      if (webviewRef.current) {
        webviewRef.current.postMessage(JSON.stringify({
          type: 'moveToLocation',
          latitude,
          longitude,
          radius
        }));
      }

      setSelectedLocation({ latitude, longitude });
      const addressText = await getAddressFromCoords(latitude, longitude);
      setAddress(addressText);

    } catch (error) {
      console.error('현재 위치 가져오기 실패:', error);
      Alert.alert('오류', '현재 위치를 가져올 수 없습니다.');
    }
  };

  // 좌표 → 주소 변환
  const getAddressFromCoords = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${longitude}&y=${latitude}&input_coord=WGS84`,
        {
          headers: {
            Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
          },
        }
      );

      const data = await response.json();

      if (data.documents && data.documents.length > 0) {
        const addressInfo = data.documents[0];
        return addressInfo.road_address?.address_name || addressInfo.address?.address_name || "주소를 찾을 수 없습니다";
      }

      return `위도: ${latitude.toFixed(4)}, 경도: ${longitude.toFixed(4)}`;
    } catch (error) {
      console.error("주소 변환 실패:", error);
      return `위도: ${latitude.toFixed(4)}, 경도: ${longitude.toFixed(4)}`;
    }
  };

  // 웹뷰에서 좌표 전달받을 때
  const handleMessage = async (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    setSelectedLocation({ latitude: data.latitude, longitude: data.longitude });

    const addressText = await getAddressFromCoords(data.latitude, data.longitude);
    setAddress(addressText);
  };

  // 계속하기 버튼
  const handleContinue = () => {
    const addParams = {
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      radius,
      address
    };

    if (params.editMode === 'true') {
      Object.assign(addParams, {
        editMode: 'true',
        placeId: params.placeId,
        name: params.name,
      });
    }

    router.replace({
      pathname: '/(protected)/(tabs)/(group_zone)/add',
      params: addParams
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html: KAKAO_MAP_HTML }}
        style={{ flex: 1 }}
        onMessage={handleMessage}
        onLoadEnd={() => {
          if (params.latitude && params.longitude && webviewRef.current) {
            webviewRef.current.postMessage(JSON.stringify({
              type: 'moveToLocation',
              latitude: Number(params.latitude),
              longitude: Number(params.longitude),
              radius: Number(params.radius) || radius
            }));
          }
        }}
      />

      <TouchableOpacity
        style={styles.locationButton}
        onPress={getCurrentLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="locate" size={25} color="#2E82FF" />
      </TouchableOpacity>

      <View style={styles.panel}>
        <View style={styles.row}>
          <Text style={styles.label}>주소</Text>
          <Text style={styles.value} numberOfLines={2}>{address}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>반지름</Text>
          <Text style={styles.value}>{radius}m</Text>
        </View>
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={100}
          maximumValue={2000}
          step={50}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  value: { fontSize: 16, color: "#4DA3FF", flex: 1, textAlign: "right", marginLeft: 8 },
  button: {
    backgroundColor: "#2E82FF",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
