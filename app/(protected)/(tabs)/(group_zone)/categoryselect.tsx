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

// ⭐️ 안드로이드 공식 카테고리 (영문)
// (표시를 위해 첫 글자를 대문자로 변경했습니다.)
const PREDEFINED_CATEGORIES = [
  "Accessibility",
  "Audio",
  "Game",
  "Image",
  "Maps",
  "News",
  "Productivity",
  "Social",
  "Video",
  "Other", // '기타' 또는 'Undefined'에 해당
];

export default function GroupCategorySelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // 1. (group_zone)/add.tsx 에서 온 'currentCategories'를 사용해 초기화
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (params.currentCategories && typeof params.currentCategories === 'string') {
      try {
        // ❗️ 이전 단계에서 "소셜" 등 한글로 저장된 값이 있을 수 있으므로
        // JSON.parse는 유지합니다.
        return JSON.parse(params.currentCategories);
      } catch (e) { /* 무시 */ }
    }
    return [];
  });

  // 카테고리 선택/해제 토글
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // 2. 저장: 'updatedCategories'라는 이름으로 파라미터를 돌려줍니다.
  const onSave = () => {
    router.replace({
      // ❗️ 'add.tsx'가 있는 경로로 수정하세요. (예: ../add)
      pathname: "/(protected)/(tabs)/(group_zone)/add", 
      params: {
        ...params, // add.tsx에서 받은 모든 params를 그대로 다시 전달
        updatedCategories: JSON.stringify(selectedCategories) // 덮어쓰기
      }
    });
  };

  // 3. FlatList 렌더링
  const renderItem = ({ item }: { item: string }) => {
    const isSelected = selectedCategories.includes(item);
    return (
      <TouchableOpacity
        style={styles.categoryItem}
        onPress={() => toggleCategory(item)}
      >
        <Text style={styles.categoryName}>{item}</Text>
        <Ionicons
          name={isSelected ? "checkmark-circle" : "checkmark-circle-outline"}
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
        <Text style={styles.title}>Select Categories</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={styles.save}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* 카테고리 리스트 */}
      <FlatList
        data={PREDEFINED_CATEGORIES} // ⭐️ 수정된 영문 목록 사용
        keyExtractor={item => item}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 8 }}
      />
    </SafeAreaView>
  );
}

// 스타일
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
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB"
  },
  categoryName: { fontSize: 15, color: "#374151" }
});