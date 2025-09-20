import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AddFocusPlace() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [name, setName] = useState('새로운 집중장소');
  const [address, setAddress] = useState('51-1, 충대로13번길, 청주시');
  const appsBlockedCount = 0;

  // 위치 선택 화면으로 이동
  const goToMap = () => {
    router.push({
      pathname: '/(protected)/(tabs)/(focus_zone)/map',
      params: {
        // 필요시 파라미터 전달r
      }
    });
  };

  const onCancel = () => router.back();
  const onSave = () => {
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FB' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={[styles.headerAction, { color: '#EF4444' }]}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>집중장소 등록</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={[styles.headerAction, { color: '#2563EB' }]}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* 집중장소명 */}
        <View style={styles.card}>
          <Text style={styles.label}>집중장소명</Text>
          <TextInput
            style={styles.input}
            placeholder="예) 도서관, 스터디카페"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* 위치 */}
        <View style={styles.card}>
          <Text style={styles.label}>위치</Text>
          <TouchableOpacity style={styles.rowBtn} activeOpacity={0.8} onPress={goToMap}>
            <Ionicons name="navigate-outline" size={18} color="#2563EB" />
            <Text style={styles.rowBtnText}>{address || '주소를 선택하세요'}</Text>
          </TouchableOpacity>
        </View>

        {/* 차단할 앱 */}
        <View style={styles.card}>
          <Text style={styles.label}>차단할 앱</Text>
          <TouchableOpacity style={styles.rowBtn} activeOpacity={0.8}>
            <Ionicons name="grid-outline" size={18} color="#2563EB" />
            <Text style={styles.rowBtnText}>앱 목록  <Text style={{ color: '#2563EB', fontWeight: 'bold' }}>{appsBlockedCount}</Text></Text>
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