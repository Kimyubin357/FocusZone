// app/(protected)/(tabs)/(group_zone)/categoryselect.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ⭐️ [수정 1] 카테고리 데이터를 'key'(저장용/영어)와 'label'(표시용/한글)로 분리
const PREDEFINED_CATEGORIES = [
  { key: "accessibility", label: "접근성", icon: "accessibility-outline" },
  { key: "audio", label: "오디오", icon: "musical-notes-outline" },
  { key: "game", label: "게임", icon: "game-controller-outline" },
  { key: "image", label: "이미지", icon: "image-outline" },
  { key: "maps", label: "지도", icon: "map-outline" },
  { key: "news", label: "뉴스", icon: "newspaper-outline" },
  { key: "productivity", label: "생산성", icon: "briefcase-outline" },
  { key: "social", label: "소셜", icon: "chatbubbles-outline" },
  { key: "video", label: "비디오", icon: "play-circle-outline" },
  // '기타'는 네이티브 모듈에서 'other' 또는 'undefined' 등으로 올 수 있습니다.
  // 네이티브 모듈의 실제 카테고리 분류 기준에 맞춰 'key'를 설정해야 합니다. (우선 'other'로 가정)
  { key: "other", label: "기타", icon: "apps-outline" }, 
];

// ⭐️ [수정 2] 타입 정의 (가독성을 위해)
type CategoryItem = {
  key: string;
  label: string;
  icon: string;
};

export default function GroupCategorySelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // selectedCategories 에는 이제 "social", "game" 등 영어 key가 저장됩니다.
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (params.currentCategories && typeof params.currentCategories === "string") {
      try {
        return JSON.parse(params.currentCategories);
      } catch {
        return [];
      }
    }
    return [];
  });

  // ⭐️ [수정 3] 토글 로직이 'key'를 사용하도록 변경
  const toggleCategory = (categoryKey: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryKey)
        ? prev.filter((c) => c !== categoryKey)
        : [...prev, categoryKey]
    );
  };

  const onSave = () => {
    router.replace({
      pathname: "/(protected)/(tabs)/(group_zone)/add",
      params: {
        ...params,
        // 영어 key 목록이 JSON 문자열로 저장되어 add.tsx로 전달됩니다.
        updatedCategories: JSON.stringify(selectedCategories),
      },
    });
  };

  // ⭐️ [수정 4] renderItem이 'key'로 선택 여부를 확인하고, 'label'을 표시하도록 변경
  const renderItem = ({ item }: { item: CategoryItem }) => {
    const isSelected = selectedCategories.includes(item.key);
    return (
      <TouchableOpacity
        style={[
          styles.categoryCard,
          isSelected && styles.categoryCardSelected,
        ]}
        onPress={() => toggleCategory(item.key)} // key로 토글
        activeOpacity={0.85}
      >
        <View style={styles.categoryLeft}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: isSelected ? "#2563EB20" : "#F3F4F6" },
            ]}
          >
            <Ionicons
              name={item.icon as any}
              size={22}
              color={isSelected ? "#2563EB" : "#6B7280"}
            />
          </View>
          <Text
            style={[
              styles.categoryName,
              isSelected && { color: "#2563EB" },
            ]}
          >
            {item.label} {/* label(한글)을 표시 */}
          </Text>
        </View>
        <Ionicons
          name={isSelected ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={isSelected ? "#2563EB" : "#9CA3AF"}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>카테고리 선택</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={styles.save}>저장</Text>
        </TouchableOpacity>
      </View>

      {/* 카테고리 리스트 */}
      <FlatList
        data={PREDEFINED_CATEGORIES}
        keyExtractor={(item) => item.key} // ⭐️ [수정 5] keyExtractor가 'key'를 사용
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* (스타일 코드는 변경 사항 없음) */
  /* 헤더 */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  save: { fontSize: 16, fontWeight: "600", color: "#2563EB" },

  /* 리스트 */
  listContent: {
    padding: 18,
    paddingBottom: 80,
  },

  /* 카드 스타일 */
  categoryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  categoryCardSelected: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#2563EB",
  },

  categoryLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  categoryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
});