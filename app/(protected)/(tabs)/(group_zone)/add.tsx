//app / (protected) / (tabs) / (group_zone) / add.tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from "firebase/auth";
import { addDoc, collection } from "firebase/firestore";
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from "../../../../firebaseConfig"; // 경로 맞춰서

export default function AddGroupPlace() {
    const router = useRouter();
    const params = useLocalSearchParams();// 위치 정보 받기

    const isEditMode = params.editMode === 'true'; // 수정모드로의 진입 확인
    const placeId = params.placeId;

    const [locationName, setlocationName] = useState(isEditMode ? (params.name as string) : '새로운 집중장소');
    const [address, setAddress] = useState(params.address || '51-1, 충대로13번길, 청주시');
    const [latitude] = useState(params.latitude ? Number(params.latitude) : undefined); // 위도
    const [longitude] = useState(params.longitude ? Number(params.longitude) : undefined);// 경도
    const [radius] = useState(params.radius ? Number(params.radius) : 400);// 반경

    const appsBlockedCount = 0; // 차단된 앱 수 (임시)

    const auth = getAuth();
    const user = auth.currentUser;
    const groupLocationCollection = collection(db, 'groupLocations');

    const addLocation = async () => {
        if (user && locationName.trim() !== "" && (address && address !== '주소를 선택하세요')) {
            await addDoc(groupLocationCollection, {
                locationName: locationName,
                address: address as string,
                latitude: latitude,
                longitude: longitude,
                radius: radius,
                userId: user.uid,
            });
            Alert.alert('성공', '그룹장소가 등록되었습니다.', [
                {
                    text: '확인', onPress: () => {
                        router.dismissAll(); // 모달/중첩 스택 다 닫기
                        router.push('/(protected)/(tabs)/(group_zone)/group_zone');
                    }
                }
            ]);
        } else {
            console.log("조건 불충족 또는 로그인 안됨");
        }
    };

    const goToMap = () => {
        const mapParams = {
            latitude: latitude,
            longitude: longitude,
            radius: radius,
            address: address,
        };

        // 수정 모드인 경우 수정 정보도 함께 전달
        if (isEditMode) { // isEditMode true
            Object.assign(mapParams, {
                editMode: 'true',
                placeId: placeId,
                locationName: locationName,
            });
        }

        router.replace({
            pathname: '/(protected)/(tabs)/(group_zone)/map',
            params: mapParams
        });
    };
    const onCancel = () => router.replace('/(protected)/(tabs)/(group_zone)/group_zone');

    return (
        <SafeAreaView>
            <View style={styles.header}>
                <TouchableOpacity onPress={onCancel}>
                    <Text style={[styles.headerAction, { color: '#EF4444' }]}>취소</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isEditMode ? '그룹장소 수정' : '그룹장소 등록'}
                </Text>
                <TouchableOpacity onPress={addLocation}>
                    <Text style={[styles.headerAction, { color: '#2563EB' }]}>저장</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View style={styles.card}>
                    <Text style={styles.label}>그룹장소명</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="예) 도서관, 스터디카페"
                        value={locationName}
                        onChangeText={setlocationName}
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
                    <TouchableOpacity style={styles.rowBtn} activeOpacity={0.8}>
                        <Ionicons name="grid-outline" size={18} color="#2563EB" />
                        <Text style={styles.rowBtnText}>앱 목록  <Text style={{ color: '#2563EB', fontWeight: 'bold' }}>{appsBlockedCount}</Text></Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
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
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },// 헤더 제목
    headerAction: { fontSize: 15, fontWeight: '600' },// 헤더 액션 버튼 (취소, 저장)
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
})