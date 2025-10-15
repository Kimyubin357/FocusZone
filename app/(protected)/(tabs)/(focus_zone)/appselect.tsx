// AppSelectScreen.tsx
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
  const params = useLocalSearchParams();

  const [appsByCategory, setAppsByCategory] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  useEffect(() => {
    // 1. add.tsx에서 온 params를 사용해 초기 선택 앱을 설정합니다. (가장 먼저 실행)
    // 수정 모드일 때: params.currentApps에 데이터가 있으므로 파싱해서 상태 설정
    // 새 등록 모드일 때: params.currentApps가 비어있으므로 selectedApps는 기본값(빈 배열) 유지
    if (params.currentApps && typeof params.currentApps === 'string') {
      setSelectedApps(JSON.parse(params.currentApps));
    }

    (async () => {
      try {
        const installedApps = await BlockedApps.getInstalledApps();
        const userApps = installedApps.filter((app: any) => !app.isSystem);

        // 💥 중요: 필터링된 userApps 변수를 사용해야 합니다.
        const grouped = userApps.reduce((acc: any, app: any) => {
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
        setCollapsed(Object.fromEntries(sections.map(s => [s.title, true])));

        // 2. AsyncStorage에서 불러오는 로직은 완전히 제거합니다.
        // const saved = await AsyncStorage.getItem("blockedApps");
        // if (saved) setSelectedApps(JSON.parse(saved));

      } catch (e) {
        console.warn("앱 목록 로드 실패:", e);
      }
    })();
  }, []); // useEffect는 화면이 처음 나타날 때 한 번만 실행됩니다.

  const toggleApp = (pkg: string) => {
    setSelectedApps(prev =>
      prev.includes(pkg) ? prev.filter(p => p !== pkg) : [...prev, pkg]
    );
  };

  const toggleCategory = (title: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // --- ADDED: 카테고리 전체 선택/해제 함수 ---
  const toggleSelectAllInCategory = (section: any) => {
    const categoryPackages = section.data.map((app: any) => app.packageName);
    const areAllSelected = categoryPackages.every((pkg: string) => selectedApps.includes(pkg));

    if (areAllSelected) {
      // 모두 선택된 경우, 해당 카테고리 앱 모두 선택 해제
      setSelectedApps(prev => prev.filter(pkg => !categoryPackages.includes(pkg)));
    } else {
      // 하나라도 선택되지 않은 경우, 해당 카테고리 앱 모두 선택
      setSelectedApps(prev => [...new Set([...prev, ...categoryPackages])]);
    }
  };
  const onSave = async () => {
    // 저장 로직 대신, router.replace를 사용해 파라미터와 함께 이전 화면으로 돌아갑니다.
    // replace를 사용하면 뒤로가기 스택에 현재 화면이 남지 않습니다.
    router.replace({
      pathname: "/(protected)/(tabs)/(focus_zone)/add", // FocusZoneScreen 경로
      params: {
        ...params, // 🔽 add.tsx에서 받은 모든 params를 그대로 다시 전달!
        updatedApps: JSON.stringify(selectedApps) // 수정된 앱 목록은 덮어쓰기
      }
    });
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
        renderSectionHeader={({ section }) => {
          // --- CHANGED 3: 카테고리 전체 선택 로직 추가 ---
          const categoryPackages = section.data.map((app: any) => app.packageName);
          const areAllSelected = categoryPackages.length > 0 && categoryPackages.every((pkg: string) => selectedApps.includes(pkg));

          return (
            <View style={styles.sectionHeader}>
              <TouchableOpacity
                style={styles.sectionLeft}
                onPress={() => toggleCategory(section.title)}
              >
                <Ionicons
                  name={collapsed[section.title] ? "chevron-forward" : "chevron-down"} // 아이콘 변경
                  size={18}
                  color="#6B7280"
                />
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleSelectAllInCategory(section)}>
                <Ionicons
                  name={areAllSelected ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={24}
                  color={areAllSelected ? "#2563EB" : "#9CA3AF"}
                />
              </TouchableOpacity>
            </View>
          )
        }}
        renderItem={({ item, section }) =>
          !collapsed[section.title] ? (
            <TouchableOpacity
              style={styles.appItem}
              onPress={() => toggleApp(item.packageName)}
            >
              <View style={styles.appItemLeft}>
                {item.icon ? (
                  <Image
                    source={{ uri: `data:image/png;base64,${item.icon}` }}
                    style={styles.appIcon}
                  />
                ) : (
                  <View style={styles.appIconPlaceholder}>
                    <Ionicons name="apps" size={20} color="#9CA3AF" />
                  </View>
                )}
                <Text style={styles.appName}>{item.appName}</Text>
              </View>
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB"
  },
  appItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  appIcon: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 8
  },
  appIconPlaceholder: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center"
  },
  appName: { fontSize: 14, color: "#374151", flex: 1 }
});