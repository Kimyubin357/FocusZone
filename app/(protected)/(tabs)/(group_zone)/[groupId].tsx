import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../../firebaseConfig";

// ---- 타입
// (GroupItem과 유사하지만, 상세 정보 포함)
type GroupLocationDetails = {
  id: string;
  locationName: string;
  address: string;
  blockedApps?: string[];
  blockedAppsCount?: number;
  memberIds?: string[];
};

// TODO: 체류/부재 상태는 별도 로직(예: 실시간 리스너)으로 가져와야 함
// 임시 더미 데이터
const DUMMY_STAYING = ["물고기", "돼찌", "소고기", "닭고기", "닉네임22"];
const DUMMY_AWAY = [
  "닉네임3",
  "닉네임4",
  "닉네임5",
  "닉네임6",
  "닉네임7",
  "닉네임8",
  "닉네임9",
  "닉네임10",
  "닉네임11",
  "닉네임12",
  "닉네임13",
  "닉네임14",
  "닉네임15",
  "닉네임16",
  "닉네임17",
  "닉네임18",
  "닉네임19",
  "닉네임20",
  "닉네임21",
  "닉네임23",
];

// 차단 앱 아이콘 매핑
const APP_ICONS: { [key: string]: React.ComponentProps<typeof Ionicons>["name"] } = {
  게임: "game-controller-outline",
  SNS: "share-social-outline",
  엔터테인먼트: "film-outline",
};
const DEFAULT_ICON = "apps-outline";

export default function GroupZoneDetails() {
  const { groupId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<GroupLocationDetails | null>(null);

  // TODO: 체류/부재 인원 상태 (실시간 데이터로 교체 필요)
  const stayingCount = DUMMY_STAYING.length;
  const totalCount = stayingCount + DUMMY_AWAY.length;
  const stayPercent =
    totalCount > 0 ? Math.round((stayingCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (!groupId) return;

    const loadDetails = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, "groupLocations", groupId as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data: any = docSnap.data();
          setDetails({
            id: docSnap.id,
            locationName: data.locationName ?? "그룹장소명",
            address: data.address ?? "주소 없음",
            // 이미지에 있는 '차단 앱' 정보 (필드명은 가정)
            blockedApps: data.blockedApps ?? ["게임", "SNS", "엔터테인먼트"],
            blockedAppsCount: data.blockedAppsCount ?? 55,
            memberIds: data.memberIds ?? [],
          });
        } else {
          // TODO: 존재하지 않는 장소 처리
        }
      } catch (e) {
        console.error("Failed to load details:", e);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [groupId]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!details) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: "오류" }} />
        <View style={styles.loader}>
          <Text style={styles.emptyText}>장소 정보를 불러올 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: "그룹장소 상세보기" }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* 상단 정보 카드 */}
        <View style={styles.infoCard}>
          <Text style={styles.title}>{details.locationName}</Text>
          <View style={styles.row}>
            <Ionicons
              name="location-outline"
              size={16}
              color="#6B7280"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.addressText}>{details.address}</Text>
          </View>

          {/* 체류 현황 */}
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>
              현재 체류 중{" "}
              <Text style={{ fontWeight: "700" }}>
                {stayingCount} / {totalCount}명
              </Text>
            </Text>
            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>{stayPercent}%</Text>
            </View>
          </View>

          {/* 차단 앱 */}
          <View style={styles.blockedAppsRow}>
            <Text style={styles.blockedAppsTitle}>차단 앱</Text>
            {(details.blockedApps ?? []).map((app) => (
              <View key={app} style={styles.appTag}>
                <Ionicons
                  name={APP_ICONS[app] ?? DEFAULT_ICON}
                  size={14}
                  color="#374151"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.appTagText}>{app}</Text>
              </View>
            ))}
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{details.blockedAppsCount}개</Text>
            </View>
          </View>
        </View>

        {/* 체류 중 리스트 */}
        <Text style={styles.listTitle}>체류 중 - {stayingCount}</Text>
        <View style={styles.memberList}>
          {DUMMY_STAYING.map((name, index) => (
            <View
              key={index}
              style={[
                styles.memberRow,
                index === 0 && { borderTopWidth: 0 },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: "#2563EB" }]} />
              <Text style={styles.memberName}>{name}</Text>
            </View>
          ))}
        </View>

        {/* 부재 중 리스트 */}
        <Text style={styles.listTitle}>부재 중 - {DUMMY_AWAY.length}</Text>
        <View style={styles.memberList}>
          {DUMMY_AWAY.map((name, index) => (
            <View
              key={index}
              style={[
                styles.memberRow,
                index === 0 && { borderTopWidth: 0 },
            	]}
            >
              <View style={[styles.avatar, { backgroundColor: "#9CA3AF" }]} />
              <Text style={styles.memberName}>{name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  // 상단 정보 카드
  infoCard: {
    backgroundColor: "#F3F4F6", // 이미지의 카드 배경색
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  addressText: {
    fontSize: 14,
    color: "#6B7280",
    flexShrink: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  statusText: {
    fontSize: 16,
    color: "#111827",
  },
  percentBadge: {
    backgroundColor: "#10B981", // 이미지의 '67%' 배지
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  percentText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // 차단 앱
  blockedAppsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
  },
  blockedAppsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginRight: 8,
  },
  appTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  appTagText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  countBadge: {
    backgroundColor: "#DBEAFE", // 이미지의 '55개' 배지
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    marginLeft: "auto", // 오른쪽으로 밀기
  },
  countText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
  },

  // 멤버 리스트
  listTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  memberList: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    overflow: "hidden", // 내부 border-radius 적용을 위해
    marginBottom: 24,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  memberName: {
    fontSize: 14,
    color: "#111827",
  },
});