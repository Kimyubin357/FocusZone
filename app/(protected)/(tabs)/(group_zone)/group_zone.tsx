// GroupZone.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from "../../../../firebaseConfig"; // 경로 맞춰서

export default function GroupZone() {
  const router = useRouter();
  const [groupList, setGroupList] = useState<any[]>([]);
  const auth = getAuth();
  const user = auth.currentUser;
  const groupLocationCollection = collection(db, 'groupLocations');

  useEffect(() => {
    fetchGroupLocations();
  }, [user]);

  const fetchGroupLocations = async () => {
    if (user) {
      const q = query(groupLocationCollection, where("userId", "==", user.uid));
      const data = await getDocs(q);
      setGroupList(data.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
    } else {
      console.log("No user logged in");
    }
  };

  const goToAdd = () => {
    router.push('/(protected)/(tabs)/(group_zone)/add');
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={48} color="#D1D5DB" />
      <Text style={styles.emptyText}>등록된 그룹장소가 없습니다</Text>
      <Text style={styles.emptySubText}>+ 버튼을 눌러 새로운 그룹장소를 추가해보세요</Text>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.locationName}</Text>
      <Text style={styles.address}>{item.address}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={groupList}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyList}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
      <TouchableOpacity style={styles.fab} onPress={goToAdd}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  address: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
});
