import React, { useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList } from 'react-native';
import { WebView } from 'react-native-webview';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // 추가

const KAKAO_MAP_HTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Kakao Map</title>
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
      </style>
      <script type="text/javascript" src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=3ed72d28cc050e7d15cb21a8cbb95f7d"></script>
    </head>
    <body>
      <div id="map" style="width:100%;height:100%;"></div>
      <script>
        var mapContainer = document.getElementById('map');
        var mapOption = {
          center: new kakao.maps.LatLng(36.6283, 127.4584), // 충북대 좌표
          level: 3
        };
        var map = new kakao.maps.Map(mapContainer, mapOption);
      </script>
    </body>
  </html>
`;

const DATA = [
  {
    id: '1',
    name: '도서관',
    address: '120-10, 개신동, 청주시',
    count: 1,
    selected: true,
  },
  {
    id: '2',
    name: '스터디카페',
    address: '청주 상당구',
    count: 3,
    selected: false,
  },
];

export default function FocusZoneScreen() {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = ['5%', '35%', '60%'];
  const [places, setPlaces] = useState(DATA);
  const router = useRouter(); // 추가

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons
          name={item.selected ? 'checkmark-circle' : 'close-circle'}
          size={22}
          color={item.selected ? '#22C55E' : '#D1D5DB'}
          style={{ marginRight: 8 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222' }}>{item.name}</Text>
          <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>{item.address}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="bar-chart-outline" size={14} color="#9CA3AF" />
            <Text style={{ color: '#9CA3AF', fontSize: 13, marginLeft: 2 }}>{item.count}</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // + 버튼 클릭 시 add.tsx로 이동
  const goToAdd = () => {
    router.push('/(protected)/(tabs)/(focus_zone)/add');
  };

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: KAKAO_MAP_HTML }}
        style={{ flex: 1 }}
      />
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        enableOverDrag={false}
        enableContentPanningGesture={false}
        enableHandlePanningGesture={true}
        style={styles.bottomSheet}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.title}>집중장소</Text>
          <FlatList
            data={places}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        </BottomSheetView>
      </BottomSheet>
      <TouchableOpacity style={styles.fab} onPress={goToAdd}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bottomSheet: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sheetContent: { padding: 12 },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 14,
    color: '#222',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});