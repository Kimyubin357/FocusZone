// app/(protected)/(tabs)/(focus_zone)/appselect.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  LayoutAnimation,
  NativeModules,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { BlockedApps } = NativeModules;

// ✅ 영어 → 한글 카테고리 변환 매핑
const CATEGORY_LABELS: Record<string, string> = {
  Game: "게임",
  Audio: "오디오",
  Video: "비디오",
  Image: "이미지",
  Social: "소셜",
  Productivity: "생산성",
  Other: "기타",
};

// Android 전용 애니메이션 허용
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AppSelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [appsByCategory, setAppsByCategory] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  useEffect(() => {
    if (params.currentApps && typeof params.currentApps === "string") {
      setSelectedApps(JSON.parse(params.currentApps));
    }

    (async () => {
      try {
        const installedApps = await BlockedApps.getInstalledApps();
        const userApps = installedApps.filter((app: any) => !app.isSystem);

        const grouped = userApps.reduce((acc: any, app: any) => {
          const category = app.category || "Other";
          if (!acc[category]) acc[category] = [];
          acc[category].push(app);
          return acc;
        }, {});

        const sections = Object.keys(grouped).map((key) => ({
          title: key,
          data: grouped[key],
        }));

        setAppsByCategory(sections);
        setCollapsed(Object.fromEntries(sections.map((s) => [s.title, true])));
      } catch (e) {
        console.warn("앱 목록 로드 실패:", e);
      }
    })();
  }, []);

  const toggleApp = (pkg: string) => {
    setSelectedApps((prev) =>
      prev.includes(pkg)
        ? prev.filter((p) => p !== pkg)
        : [...prev, pkg]
    );
  };

  const toggleCategory = (title: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const toggleSelectAllInCategory = (section: any) => {
    const categoryPackages = section.data.map((app: any) => app.packageName);
    const areAllSelected = categoryPackages.every((pkg: string) =>
      selectedApps.includes(pkg)
    );

    if (areAllSelected) {
      setSelectedApps((prev) =>
        prev.filter((pkg) => !categoryPackages.includes(pkg))
      );
    } else {
      setSelectedApps((prev) => [
        ...new Set([...prev, ...categoryPackages]),
      ]);
    }
  };

  const onSave = () => {
    router.replace({
      pathname: "/(protected)/(tabs)/(focus_zone)/add",
      params: {
        ...params,
        updatedApps: JSON.stringify(selectedApps),
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>차단할 앱 선택</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={styles.save}>저장</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={appsByCategory}
        keyExtractor={(item) => item.packageName}
        contentContainerStyle={{ paddingBottom: 60 }}
        renderSectionHeader={({ section }) => {
          const categoryPackages = section.data.map(
            (app: any) => app.packageName
          );
          const areAllSelected =
            categoryPackages.length > 0 &&
            categoryPackages.every((pkg: string) =>
              selectedApps.includes(pkg)
            );

          const categoryLabel =
            CATEGORY_LABELS[section.title] || section.title;

          return (
            <View style={styles.sectionHeader}>
              <TouchableOpacity
                style={styles.sectionLeft}
                onPress={() => toggleCategory(section.title)}
              >
                <Ionicons
                  name={
                    collapsed[section.title]
                      ? "chevron-forward"
                      : "chevron-down"
                  }
                  size={18}
                  color="#2563EB"
                />
                <Text style={styles.sectionTitle}>{categoryLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => toggleSelectAllInCategory(section)}
              >
                <Ionicons
                  name={
                    areAllSelected ? "checkbox" : "square-outline"
                  }
                  size={22}
                  color={areAllSelected ? "#2563EB" : "#9CA3AF"}
                />
              </TouchableOpacity>
            </View>
          );
        }}
        renderItem={({ item, section }) =>
          !collapsed[section.title] ? (
            <TouchableOpacity
              style={[
                styles.appCard,
                selectedApps.includes(item.packageName) &&
                  styles.appCardSelected,
              ]}
              onPress={() => toggleApp(item.packageName)}
              activeOpacity={0.85}
            >
              <View style={styles.appItemLeft}>
                {/* ✅ 아이콘 표시 (없으면 첫 글자 원) */}
                {item.icon ? (
                  <Image
                    source={{
                      uri: `data:image/png;base64,${item.icon}`,
                    }}
                    style={styles.appIcon}
                  />
                ) : (
                  <View style={styles.appIconPlaceholder}>
                    <Text style={styles.appInitial}>
                      {item.appName?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}

                <Text
                  style={[
                    styles.appName,
                    selectedApps.includes(item.packageName) && {
                      color: "#2563EB",
                      fontWeight: "700",
                    },
                  ]}
                >
                  {item.appName}
                </Text>
              </View>

              {selectedApps.includes(item.packageName) && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color="#2563EB"
                />
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  save: { fontSize: 16, fontWeight: "600", color: "#2563EB" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 16,
  },
  sectionLeft: { flexDirection: "row", alignItems: "center" },
  sectionTitle: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },

  appCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  appCardSelected: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  appItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  appIcon: { width: 44, height: 44, borderRadius: 10, marginRight: 12 },

  // ✅ 아이콘이 없을 때 대체 원 스타일
  appIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  appInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6B7280",
  },

  appName: { fontSize: 15, color: "#111827", flexShrink: 1 },
});
