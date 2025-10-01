import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MOCK_APPS = [
  { id: "com.instagram.android", name: "Instagram" },
  { id: "com.facebook.katana", name: "Facebook" },
  { id: "com.google.android.youtube", name: "YouTube" },
  { id: "com.kakao.talk", name: "카카오톡" }
];

export default function AppSelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const selectedAppsParam = params.selectedApps ? JSON.parse(params.selectedApps as string) : [];

  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  // 초기 로드: 파라미터가 있으면 우선 사용, 없으면 AsyncStorage에서 로드
  useEffect(() => {
    const load = async () => {
      if (Array.isArray(selectedAppsParam) && selectedAppsParam.length > 0) {
        setSelectedApps(selectedAppsParam);
        return;
      }
      const saved = await AsyncStorage.getItem("blockedApps");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setSelectedApps(parsed as string[]);
        } catch {
          // ignore JSON parse error
        }
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleApp = (id: string) => {
    if (selectedApps.includes(id)) {
      setSelectedApps(selectedApps.filter(app => app !== id));
    } else {
      setSelectedApps([...selectedApps, id]);
    }
  };

  const onSave = async () => {
    await AsyncStorage.setItem("blockedApps", JSON.stringify(selectedApps));
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <Text style={styles.title}>차단할 앱 선택</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={styles.save}>저장</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={MOCK_APPS}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => toggleApp(item.id)}>
            <Text style={styles.itemText}>{item.name}</Text>
            {selectedApps.includes(item.id) && <Ionicons name="checkmark" size={20} color="#2563EB" />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB"
  },
  title: { fontSize: 16, fontWeight: "700" },
  save: { fontSize: 15, fontWeight: "600", color: "#2563EB" },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB"
  },
  itemText: { fontSize: 15 }
});