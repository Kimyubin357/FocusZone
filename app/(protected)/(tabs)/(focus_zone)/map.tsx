import React, { useRef, useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Switch } from "react-native";
import Slider from "@react-native-community/slider";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";

const KAKAO_MAP_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Kakao Map</title>
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; }
    </style>
    <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=3ed72d28cc050e7d15cb21a8cbb95f7d"></script>
  </head>
  <body>
    <div id="map" style="width:100%;height:100%;"></div>
    <script>
      var mapContainer = document.getElementById("map");
      var mapOption = {
        center: new kakao.maps.LatLng(37.5665, 126.9780),
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
      });

      // WebView 메시지 수신
      window.addEventListener("message", function(event) {
        var newRadius = parseInt(event.data);
        console.log("Received radius from RN:", newRadius); // 디버깅용
        if (!isNaN(newRadius)) {
          circle.setRadius(newRadius);
          circle.setMap(null); // 원을 갱신하기 위해 제거 후 재추가
          circle.setMap(map);
          window.ReactNativeWebView.postMessage("Radius updated: " + newRadius); // RN으로 확인 메시지 전송
        }
      }, false);

      // 디버깅용: WebView가 준비되었음을 알림
      window.ReactNativeWebView.postMessage("WebView loaded");
    </script>
  </body>
</html>
`;
export default function KakaoMapScreen() {
  const webviewRef = useRef<WebView>(null);
  const [radius, setRadius] = useState(400);
  const [address, setAddress] = useState("북대동 2201-12, 청주시");
  const [reverse, setReverse] = useState(false);

  const handleSliderChange = (value: number) => {
    setRadius(value);
    if (webviewRef.current) {
      webviewRef.current.postMessage(String(value));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 지도 */}
      <WebView
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html: KAKAO_MAP_HTML }}
        style={{ flex: 1 }}
      />

      {/* 하단 패널 */}
      <View style={styles.panel}>
        {/* 주소 */}
        <View style={styles.row}>
          <Text style={styles.label}>주소</Text>
          <Text style={styles.value}>{address}</Text>
        </View>

        {/* 반지름 */}
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

        {/* 역 반지름 스위치 */}
        <View style={styles.row}>
          <Text style={styles.label}>역 반지름</Text>
          <Switch value={reverse} onValueChange={setReverse} />
        </View>

        {/* 계속하기 버튼 */}
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>계속하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  panel: {
    position: "absolute",
    bottom: 60,          // ✅ 지도 위에 띄움
    left: 16,            // ✅ 좌측 여백
    right: 16,           // ✅ 우측 여백
    backgroundColor: "#1C1C1E",
    padding: 16,
    borderRadius: 16,    // ✅ 네 모서리 둥글게
    shadowColor: "#000", // ✅ 그림자 (iOS)
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,        // ✅ 그림자 (Android)
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: { fontSize: 16, color: "#aaa" },
  value: { fontSize: 16, color: "#4DA3FF" },
  button: {
    backgroundColor: "#2E82FF",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});