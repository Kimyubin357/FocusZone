import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  LayoutAnimation,
  NativeModules,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { BlockedApps } = NativeModules;

// Android 전용 애니메이션 허용
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AppSelectScreen() {
  const router = useRouter();
  const [appsByCategory, setAppsByCategory] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const installedApps = await BlockedApps.getInstalledApps();
        // category 기준으로 그룹화
        const grouped = installedApps.reduce((acc: any, app: any) => {
          const category = app.category || "기타";
          if (!acc[category]) acc[category] = [];
          acc[category].push(app);
          return acc;
        }, {});

        const sections = Object.keys(grouped).map(key => ({
          title: key,
          data: grouped[key]
        }));

        setAppsByCategory(sections);
        setCollapsed(Object.fromEntries(sections.map(s => [s.title, false])));

        const saved = await AsyncStorage.getItem("blockedApps");
        if (saved) setSelectedApps(JSON.parse(saved));
      } catch (e) {
        console.warn("앱 목록 로드 실패:", e);
      }
    })();
  }, []);

  const toggleApp = (pkg: string) => {
    setSelectedApps(prev =>
      prev.includes(pkg) ? prev.filter(p => p !== pkg) : [...prev, pkg]
    );
  };

  const toggleCategory = (title: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const onSave = async () => {
    await AsyncStorage.setItem("blockedApps", JSON.stringify(selectedApps));
    await BlockedApps.setBlockedApps(selectedApps);
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>차단 목록</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={styles.save}>저장하기</Text>
        </TouchableOpacity>
      </View>

      {/* 카테고리별 앱 리스트 */}
      <SectionList
        sections={appsByCategory}
        keyExtractor={item => item.packageName}
        renderSectionHeader={({ section }) => (
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleCategory(section.title)}
          >
            <View style={styles.sectionLeft}>
              <Ionicons
                name={collapsed[section.title] ? "chevron-down" : "chevron-up"}
                size={18}
                color="#6B7280"
              />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        )}
        renderItem={({ item, section }) =>
          !collapsed[section.title] ? (
            <TouchableOpacity
              style={styles.appItem}
              onPress={() => toggleApp(item.packageName)}
            >
              <Text style={styles.appName}>{item.appName}</Text>
              {selectedApps.includes(item.packageName) && (
                <Ionicons name="checkmark" size={20} color="#2563EB" />
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff"
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  save: { fontSize: 16, fontWeight: "600", color: "#2563EB" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB"
  },
  sectionLeft: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { marginLeft: 8, fontSize: 15, fontWeight: "600", color: "#111827" },
  appItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB"
  },
  appName: { fontSize: 14, color: "#374151" }
});
