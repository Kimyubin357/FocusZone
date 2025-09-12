import { KAKAO_APP_KEY } from '@env';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
const KAKAO_MAP_HTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Kakao Map</title>
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
      </style>
      <script type="text/javascript" src="//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}"></script>
    </head>
    <body>
      <div id="map" style="width:100%;height:100%;"></div>
      <script>
        var mapContainer = document.getElementById('map');
        var mapOption = {
          center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 좌표
          level: 3
        };
        var map = new kakao.maps.Map(mapContainer, mapOption);
      </script>
    </body>
  </html>
`;

export default function KakaoMapScreen() {
  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: KAKAO_MAP_HTML }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});