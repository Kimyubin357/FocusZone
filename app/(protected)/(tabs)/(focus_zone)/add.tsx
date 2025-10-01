import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, NativeModules, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AddFocusPlace() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const isEditMode = params.editMode === 'true';
  const placeId = params.placeId;

  const [name, setName] = useState(isEditMode ? (params.name as string) : '새로운 집중장소');
  const [address, setAddress] = useState(params.address || '51-1, 충대로13번길, 청주시');
  const [latitude] = useState(params.latitude ? Number(params.latitude) : undefined);
  const [longitude] = useState(params.longitude ? Number(params.longitude) : undefined);
  const [radius] = useState(params.radius ? Number(params.radius) : 400);

  // 차단 앱: 포커스 시 AsyncStorage에서 항상 최신으로 로드
  const [blockedApps, setBlockedApps] = useState<string[]>(
    params.blockedApps
      ? (typeof params.blockedApps === 'string' ? JSON.parse(params.blockedApps as string) : (params.blockedApps as string[]))
      : []
  );
  const appsBlockedCount = blockedApps.length;
  const { BlockedApps } = NativeModules;

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      const load = async () => {
        try {
          const saved = await AsyncStorage.getItem('blockedApps');
          if (saved && !cancelled) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setBlockedApps(parsed as string[]);
          }
        } catch {
          // ignore
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  React.useEffect(() => {
    const setBlockedAppsAsync = async () => {
      try {
        await BlockedApps.setBlockedApps(blockedApps);
        console.log('Blocked apps set successfully:', blockedApps);
      } catch (error) {
        console.error('Failed to set blocked apps:', error);
      }
    };
    setBlockedAppsAsync();
  }, [blockedApps]);

  const goToMap = () => {
    const mapParams = {
      latitude: latitude,
      longitude: longitude,
      radius: radius,
      address: address,
    };

    if (isEditMode) {
      Object.assign(mapParams, {
        editMode: 'true',
        placeId: placeId,
        name: name,
      });
    }

    router.replace({
      pathname: '/(protected)/(tabs)/(focus_zone)/map',
      params: mapParams
    });
  };

  const onCancel = () => router.back();

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('오류', '집중장소명을 입력해주세요.');
      return;
    }

    if (!address || address === '주소를 선택하세요') {
      Alert.alert('오류', '위치를 선택해주세요.');
      return;
    }

    try {
      const savedPlaces = await AsyncStorage.getItem('focusPlaces');
      let places = savedPlaces ? JSON.parse(savedPlaces) : [];

      if (isEditMode) {
        places = places.map(place =>
          place.id === placeId
            ? {
              ...place,
              name: name.trim(),
              address: address as string,
              latitude,
              longitude,
              radius,
            }
            : place
        );

        await AsyncStorage.setItem('focusPlaces', JSON.stringify(places));
        Alert.alert('성공', '집중장소가 수정되었습니다.', [
          { text: '확인', onPress: () => router.back() }
        ]);
      } else {
        const newPlace = {
          id: Date.now().toString(),
          name: name.trim(),
          address: address as string,
          latitude,
          longitude,
          radius,
          count: 0,
          selected: false,
        };

        places.push(newPlace);
        await AsyncStorage.setItem('focusPlaces', JSON.stringify(places));
        Alert.alert('성공', '집중장소가 등록되었습니다.', [
          { text: '확인', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      Alert.alert('오류', '저장에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FB' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={[styles.headerAction, { color: '#EF4444' }]}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? '집중장소 수정' : '집중장소 등록'}
        </Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={[styles.headerAction, { color: '#2563EB' }]}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.label}>집중장소명</Text>
          <TextInput
            style={styles.input}
            placeholder="예) 도서관, 스터디카페"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>위치</Text>
          <TouchableOpacity style={styles.rowBtn} activeOpacity={0.8} onPress={goToMap}>
            <Ionicons name="navigate-outline" size={18} color="#2563EB" />
            <Text style={styles.rowBtnText}>{address || '주소를 선택하세요'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>반지름</Text>
          <Text style={styles.rowBtnText}>{radius}m</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>차단할 앱</Text>
          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: "/(protected)/(tabs)/(focus_zone)/appselect",
                // 최신 선택값을 전달
                params: { selectedApps: JSON.stringify(blockedApps) }
              })
            }
          >
            <Ionicons name="grid-outline" size={18} color="#2563EB" />
            <Text style={styles.rowBtnText}>
              앱 목록 <Text style={{ color: "#2563EB", fontWeight: "bold" }}>{appsBlockedCount}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff'
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerAction: { fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7'
  },
  label: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF'
  },
  rowBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12
  },
  rowBtnText: { marginLeft: 8, color: '#111827', fontSize: 15 }
});