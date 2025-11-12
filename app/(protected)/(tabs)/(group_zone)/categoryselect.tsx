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

const PREDEFINED_CATEGORIES = [
  { name: "접근성", icon: "accessibility-outline" },
  { name: "오디오", icon: "musical-notes-outline" },
  { name: "게임", icon: "game-controller-outline" },
  { name: "이미지", icon: "image-outline" },
  { name: "지도", icon: "map-outline" },
  { name: "뉴스", icon: "newspaper-outline" },
  { name: "생산성", icon: "briefcase-outline" },
  { name: "소셜", icon: "chatbubbles-outline" },
  { name: "비디오", icon: "play-circle-outline" },
  { name: "기타", icon: "apps-outline" },
];

export default function GroupCategorySelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

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

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const onSave = () => {
    router.replace({
      pathname: "/(protected)/(tabs)/(group_zone)/add",
      params: {
        ...params,
        updatedCategories: JSON.stringify(selectedCategories),
      },
    });
  };

  const renderItem = ({ item }: { item: { name: string; icon: string } }) => {
    const isSelected = selectedCategories.includes(item.name);
    return (
      <TouchableOpacity
        style={[
          styles.categoryCard,
          isSelected && styles.categoryCardSelected,
        ]}
        onPress={() => toggleCategory(item.name)}
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
            {item.name}
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
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
