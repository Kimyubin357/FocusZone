import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Popover from 'react-native-popover-view';
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
      <script type="text/javascript" src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=08a2de71046acd72f7f1c67a474c9e17"></script>
    </head>
    <body>
      <div id="map" style="width:100%;height:100%;"></div>
      <script>
        var mapContainer = document.getElementById('map'); 
        var mapOption = {
          center: new kakao.maps.LatLng(36.6283, 127.4584),
          level: 1
        };
        var map = new kakao.maps.Map(mapContainer, mapOption); //카카오맵 생성 ->mapcontiner에 표시
        
        var markers = [];
        var circles = [];

        // 지도에 장소들 표시 
        function displayPlaces(places, showAll = false, shouldFitBounds = true) { 
          // 기존 마커와 원 제거
          clearMap();
          
          if (!places || places.length === 0) return;
          
          places.forEach(function(place, index) {
            var shouldShow = showAll || place.selected; // showAll이 true or false true면 모든장소표시
            
            if (place.latitude && place.longitude && shouldShow) { //위도 경도, shouldshow
              var position = new kakao.maps.LatLng(place.latitude, place.longitude);
              
              var marker = new kakao.maps.Marker({ // 마커 생성
                position: position,
                title: place.name  //이거는 굳이 필요없지 않나?
              });
              marker.setMap(map); // 마커를 실제 지도에표시
              markers.push(marker); //마커들 배열에 추가
              
              // 원 생성 (선택된 것과 선택되지 않은 것 구분)
              var circle = new kakao.maps.Circle({
                center: position,
                radius: place.radius || 400,
                strokeWeight: 2,
                strokeColor: place.selected ? "#22C55E" : "#9CA3AF",
                strokeOpacity: 1,
                strokeStyle: place.selected ? "solid" : "dashed",
                fillColor: place.selected ? "#22C55E20" : "#9CA3AF20",
                fillOpacity: 0.3
              });
              circle.setMap(map);
              circles.push(circle);
            }
          });
          
          // 모든 마커가 보이도록 지도 범위 조정
          if (places.length > 0) {
             var first = places[0]; // 배열의 첫 장소
             if (first.latitude && first.longitude) {
              var pos = new kakao.maps.LatLng(first.latitude, first.longitude);
              map.setCenter(pos);
              map.setLevel(2);
           }
          }
   }
        // 특정 장소로 이동
        function moveToPlace(place) {
          if (place.latitude && place.longitude) {
            var position = new kakao.maps.LatLng(place.latitude, place.longitude);
            map.setCenter(position); // 지도 중심이동
            map.setLevel(2);
          }
        }
        
        // 지도 초기화
        function clearMap() {
          markers.forEach(function(marker) {
            marker.setMap(null);
          });
          circles.forEach(function(circle) {
            circle.setMap(null);
          });
          markers = [];
          circles = [];
        }

        // 메시지 리스너 (수정됨) ???
        window.addEventListener("message", function(event) { // 앱에서 -> html로 메시지 전달 메시지란게?
          try {
            var data = JSON.parse(event.data); // 문자열을 객체로 변환
            
            if (data.type === 'displayPlaces') { // 메시지를 구분
              displayPlaces(data.places, data.showAll, data.shouldFitBounds);
            } else if (data.type === 'moveToPlace') {
              moveToPlace(data.place);
            } else if (data.type === 'clearMap') {
              clearMap();
            }
          } catch (e) {
            console.error('메시지 파싱 오류:', e);
          }
        }, false);
      </script>
    </body>
  </html>
`;

export default function FocusZoneScreen() {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const webViewRef = useRef<WebView>(null);
  const snapPoints = ['5%', '60%', '90%'];
  const [places, setPlaces] = useState([]); // 저장된 장소 배열
  const [selectedPlace, setSelectedPlace] = useState(null); // 현재 선택된 장소 메뉴에서
  const [menuVisible, setMenuVisible] = useState(false); //수정,삭제
  const [showAllPlaces, setShowAllPlaces] = useState(false);// 전체보기, 선택된 장소
  const router = useRouter();

  useFocusEffect(
    React.useCallback(() => { //말그대로 call back 다른탭 갔다 저장된 장소 불러윰
      loadPlaces();
    }, [])
  );

  // places가 변경될 때마다 지도 업데이트
  useEffect(() => {
    updateMapDisplay();
  }, [places, showAllPlaces]);

  const loadPlaces = async () => {  // AsyncStorage에서 장소 불러오기 
    try {
      const savedPlaces = await AsyncStorage.getItem('focusPlaces'); //focuszPlaces라는 키로 저장된거
      if (savedPlaces) {
        setPlaces(JSON.parse(savedPlaces)); //setPlaces에 불러온거 저장
      } else {
        setPlaces([]); 
      }
    } catch (error) {
      console.log('데이터 로드 실패:', error);
      setPlaces([]);
    }
  };

  const savePlaces = async (updatedPlaces) => { //updatedPlaces를 AsyncStorage에 저장
    try {
      await AsyncStorage.setItem('focusPlaces', JSON.stringify(updatedPlaces));
      setPlaces(updatedPlaces);
    } catch (error) {
      Alert.alert('오류', '저장에 실패했습니다.');
    }
  };

  // 지도 표시 업데이트
  const updateMapDisplay = () => {
    if (webViewRef.current) {
      if (showAllPlaces) { //showallPlaces가 true면
        // 모든 장소 표시
        webViewRef.current.postMessage(JSON.stringify({
          type: 'displayPlaces',
          places: showAllPlaces ? places : places.filter(p => p.selected),
          showAll: showAllPlaces,
          shouldFitBounds: !showAllPlaces  // 전체선택되면 지도화면이동x
          
        }));
      } else {
        // 선택된 장소만 표시
        const selectedPlaces = places.filter(place => place.selected);
        webViewRef.current.postMessage(JSON.stringify({
          type: 'displayPlaces',
          places: selectedPlaces
        }));
      }
    }
  };

  // 특정 장소로 이동
  const moveToPlace = (place) => {
    if (webViewRef.current && place.latitude && place.longitude) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'moveToPlace',  // webView에 메시지 전달
        place: place
      }));
    }
  };

  // 전체 보기 토글
  const toggleShowAll = () => {
  const newValue = !showAllPlaces;
  setShowAllPlaces(newValue);

  if (newValue) {
    // 전체 보기 켰을 때: 모든 장소를 selected = true
    const updatedPlaces = places.map(place => ({ ...place, selected: true }));
    savePlaces(updatedPlaces);
  } else {
    // 전체 보기 끌 때: 모든 장소를 selected = false
    const updatedPlaces = places.map(place => ({ ...place, selected: false }));
    savePlaces(updatedPlaces);
  }
};

  const handleEdit = () => {
    setMenuVisible(false);
    router.push({ // 수정모드일 때 
      pathname: '/(protected)/(tabs)/(focus_zone)/add',
      params: {
        editMode: 'true',
        placeId: selectedPlace.id,
        name: selectedPlace.name,
        address: selectedPlace.address,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        radius: selectedPlace.radius,
      } //add 페이지에 정보 넘겨줌 , 목록 데이터 를 전송할지, asyncstorage에 저장 할지 고민
    });
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      '삭제 확인',
      `"${selectedPlace.name}"를 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            const updatedPlaces = places.filter(place => place.id !== selectedPlace.id);
            savePlaces(updatedPlaces);
          }
        }
      ]
    );
  };

  const toggleSelection = (item) => {
    const updatedPlaces = places.map(place =>
      place.id === item.id
        ? { ...place, selected: !place.selected } // 선택 상태를 토글 선택시 selected 가 false -> true
        : place
    );
    savePlaces(updatedPlaces);
  };

  const renderItem = ({ item }) => (
    <View style={styles.cardContainer}>
      <TouchableOpacity 
        style={[styles.card, item.selected && styles.selectedCard]}
        onPress={() => toggleSelection(item)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name={item.selected ? 'checkmark-circle' : 'close-circle'}
            size={22}
            color={item.selected ? '#22C55E' : '#D1D5DB'}
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222' }}>{item.name}</Text>
            <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {item.address}
            </Text>

          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>

            <Popover
              isVisible={menuVisible && selectedPlace?.id === item.id}
              onRequestClose={() => setMenuVisible(false)}
              from={(
                <TouchableOpacity onPress={() => {
                  setSelectedPlace(item);
                  setMenuVisible(true);
                }}>
                  <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
              placement="bottom"
              popoverStyle={styles.popoverStyle}
              backgroundStyle={{ backgroundColor: 'transparent' }} 
            >
              <View style={styles.popoverContent}>
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                  
                  <Text style={styles.menuText}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                  
                  <Text style={[styles.menuText, { color: '#EF4444' }]}>삭제</Text>
                </TouchableOpacity>
              </View>
            </Popover>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={48} color="#D1D5DB" />
      <Text style={styles.emptyText}>등록된 집중장소가 없습니다</Text>
      <Text style={styles.emptySubText}>+ 버튼을 눌러 새로운 집중장소를 추가해보세요</Text>
    </View>
  );

  const goToAdd = () => {
    router.push('/(protected)/(tabs)/(focus_zone)/add');
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: KAKAO_MAP_HTML }}
        style={{ flex: 1 }}
      />
      
      {/* 전체 보기 토글 버튼 */}
      <TouchableOpacity 
        style={styles.toggleButton}
        onPress={toggleShowAll}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={showAllPlaces ? "eye-off" : "eye"} 
          size={20} 
          color="#fff" 
        />
        <Text style={styles.toggleButtonText}>
          {showAllPlaces ? "선택된 장소만" : "전체 보기"}
        </Text>
      </TouchableOpacity>

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
          <View style={styles.headerRow}>
            <Text style={styles.title}>집중장소</Text>
            <Text style={styles.countText}>
              {places.filter(place => place.selected).length}/{places.length}
            </Text>
          </View>
          <FlatList
            data={places}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListEmptyComponent={renderEmptyList}
            contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
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
  toggleButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  bottomSheet: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sheetContent: { padding: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
  },
  countText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  cardContainer: {
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedCard: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  mapButton: {
    padding: 8,
    marginRight: 4,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
    popoverStyle: {
    backgroundColor: 'transparent',
  },
  popoverContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 100, // 최소 크기 지정
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
  },
  menuItem: {

    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  menuText: {
    
    fontSize: 14,
    color: '#222',
  },
});