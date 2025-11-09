// app/(protected)/(tabs)/(group_zone)/[groupId].tsx
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../../firebaseConfig";

// ---- 타입 ----
type GroupLocationDetails = {
  id: string;
  groupName: string;
  address: string;
  blockedApps?: string[];
  blockedAppsCount?: number;
  memberIds?: string[];
  isActive?: boolean; // [추가]
};

// [추가] 멤버 데이터 타입
type GroupMember = {
  id: string; // 유저 UID
  nickname: string;
};

// 차단 앱 아이콘 매핑
const APP_ICONS: {
  [key: string]: React.ComponentProps<typeof Ionicons>["name"];
} = {
  게임: "game-controller-outline",
  SNS: "share-social-outline",
  엔터테인먼트: "film-outline",
};
const DEFAULT_ICON = "apps-outline";

export default function GroupZoneDetails() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<GroupLocationDetails | null>(null);

  const [isToggling, setIsToggling] = useState(false);

  // [추가] 실시간 멤버 리스트 State
  const [stayingList, setStayingList] = useState<GroupMember[]>([]);
  const [awayList, setAwayList] = useState<GroupMember[]>([]);

  // [수정] 실시간 데이터 기반으로 카운트 계산
  const stayingCount = stayingList.length;
  const totalCount = stayingList.length + awayList.length;
  const stayPercent =
    totalCount > 0 ? Math.round((stayingCount / totalCount) * 100) : 0;

  //노윤석 추가코드
  // 파라미터로 넘어온 groupId 값 확인 (디버깅용)
  useEffect(() => {
    console.log("[GroupDetails] param groupId =", groupId);
  }, [groupId]);
  //노윤석 끝

  // Effect 1: 그룹 기본 정보 실시간 로드
  useEffect(() => {
    if (!groupId) return;
    setLoading(true); // 리스너 설정 전에 로딩 시작

    const docRef = doc(db, "groupLocations", groupId as string);

    //노윤석 추가코드
    console.log("[GroupDetails] listen doc:", `groupLocations/${groupId}`);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        console.log("[GroupDetails] doc exists?", docSnap.exists());
        if (docSnap.exists()) {
          const data: any = docSnap.data();
          setDetails({
            id: docSnap.id,
            groupName: data.groupName ?? "그룹장소명",
            address: data.address ?? "주소 없음",
            blockedApps: data.blockedAppCategories ?? [],
            blockedAppsCount: data.blockedAppCategories?.length ?? 0,
            memberIds: data.memberIds ?? [],
            isActive: data.isActive ?? true, // 실시간으로 갱신됨
          });
        } else {
          // 문서가 삭제되었거나 없는 경우
          setDetails(null);
        }
        setLoading(false); // 첫 데이터를 받은 후 로딩 완료
      },
      (error) => {
        console.error("[GroupDetails] onSnapshot error:", error);
        Alert.alert("오류", "데이터를 불러오는 데 실패했습니다.");
        setLoading(false);
      }
    );
    //노윤석 끝

    // 클린업 함수
    return () => {
      unsubscribe();
    };
  }, [groupId]);

  // [추가] Effect 2: 멤버 리스트 실시간 리스너 설정
  useEffect(() => {
    if (!groupId) return;

    const membersColRef = collection(
      db,
      "groupLocations",
      groupId as string,
      "members"
    );

    const unsubscribe = onSnapshot(membersColRef, (snapshot) => {
      const staying: GroupMember[] = [];
      const away: GroupMember[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const member: GroupMember = {
          id: doc.id, // 문서 ID가 유저의 UID임
          nickname: data.groupNickname ?? "이름 없음", // DB 필드명: groupNickname
        };

        // 'active' 상태일 때만 체류 중, 그 외(inactive, undefined 등)는 모두 부재 중
        if (data.status === "active") {
          staying.push(member);
        } else {
          away.push(member);
        }
      });

      // State 업데이트
      setStayingList(staying);
      setAwayList(away);
    });

    // 클린업 함수: 화면을 벗어날 때 리스너 해제
    return () => {
      unsubscribe();
    };
  }, [groupId]); // groupId가 변경될 때만 이 Effect 실행

  //노윤석 추가코드
  // Expo Router: 문자열 href로 안전하게 이동 (타입 경고 방지)
  const onPressMember = (memberId: string) => {
    router.push(
      `/(protected)/(tabs)/(group_zone)/stats?groupId=${String(
        groupId
      )}&memberId=${memberId}`
    );
  };
  //노윤석 끝

  const onToggleActive = async () => {
    if (!details || !groupId || isToggling) return; // 중복 클릭 방지

    setIsToggling(true);
    const newStatus = !details.isActive; // 현재 상태의 반대값
    const docRef = doc(db, "groupLocations", groupId as string);

    try {
      await updateDoc(docRef, {
        isActive: newStatus,
        updatedAt: serverTimestamp(), // 수정 시간 갱신
      });
      // 성공 시: onSnapshot 리스너가 자동으로 UI를 갱신합니다.
    } catch (e: any) {
      console.error("Failed to update isActive:", e);
      Alert.alert("오류", "상태를 업데이트하는 데 실패했습니다.");
    } finally {
      setIsToggling(false);
    }
  };

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
          <View style={styles.rowBetween}>
            <Text style={styles.title}>{details.groupName}</Text>
            {/* [추가] 활성화 상태 배지 (실시간 반영) */}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: details.isActive ? "#DCFCE7" : "#FEE2E2",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: details.isActive ? "#16A34A" : "#DC2626",
                  },
                ]}
              >
                {details.isActive ? "활성화" : "비활성화"}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <Ionicons
              name="location-outline"
              size={16}
              color="#6B7280"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.addressText}>{details.address}</Text>
          </View>

          {/* 체류 현황 (이제 실시간) */}
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

          {/* 차단 앱 (수정됨) */}
          <View style={styles.blockedAppsRow}>
            <Text style={styles.blockedAppsTitle}>차단 앱</Text>
            {(details.blockedApps ?? []).map((appCategory) => (
              <View key={appCategory} style={styles.appTag}>
                <Ionicons
                  name={APP_ICONS[appCategory] ?? DEFAULT_ICON}
                  size={14}
                  color="#374151"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.appTagText}>{appCategory}</Text>
              </View>
            ))}
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{details.blockedAppsCount}개</Text>
            </View>
          </View>

          {/* ⭐️ 7. [추가] 활성화 토글 UI */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleLabel}>그룹장소 활성화</Text>
              <Text style={styles.toggleDescription}>
                비활성화 시 앱 차단이 작동하지 않습니다
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleSwitch,
                details.isActive
                  ? styles.toggleSwitchActive
                  : styles.toggleSwitchInactive,
              ]}
              onPress={onToggleActive}
              disabled={isToggling}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.toggleThumb,
                  details.isActive
                    ? styles.toggleThumbActive
                    : styles.toggleThumbInactive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* [수정] 체류 중 리스트 (실시간) */}
        <Text style={styles.listTitle}>체류 중 - {stayingCount}</Text>
        <View style={styles.memberList}>
          {stayingList.map((member, index) => (
            <TouchableOpacity
              key={member.id}
              onPress={() => onPressMember(member.id)}
              activeOpacity={0.7}
            >
              <View
                style={[styles.memberRow, index === 0 && { borderTopWidth: 0 }]}
              >
                <View style={[styles.avatar, { backgroundColor: "#2563EB" }]} />
                <Text style={styles.memberName}>{member.nickname}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {stayingList.length === 0 && (
            <View style={styles.emptyList}>
              <Text style={styles.emptyListText}>
                체류 중인 멤버가 없습니다.
              </Text>
            </View>
          )}
        </View>

        {/* [수정] 부재 중 리스트 (실시간) */}
        <Text style={styles.listTitle}>부재 중 - {awayList.length}</Text>
        <View style={styles.memberList}>
          {awayList.map((member, index) => (
            <TouchableOpacity
              key={member.id}
              onPress={() => onPressMember(member.id)}
              activeOpacity={0.7}
            >
              <View
                style={[styles.memberRow, index === 0 && { borderTopWidth: 0 }]}
              >
                <View style={[styles.avatar, { backgroundColor: "#9CA3AF" }]} />
                <Text style={styles.memberName}>{member.nickname}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {awayList.length === 0 && (
            <View style={styles.emptyList}>
              <Text style={styles.emptyListText}>
                부재 중인 멤버가 없습니다.
              </Text>
            </View>
          )}
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
    backgroundColor: "#F3F4F6",
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
    backgroundColor: "#10B981",
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
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    marginLeft: "auto",
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
    overflow: "hidden",
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
  // [추가] 리스트가 비어있을 때 스타일
  emptyList: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyListText: {
    fontSize: 14,
    color: "#6B7280",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // [추가] 상태 배지
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 12,
    color: "#6B7280",
  },
  toggleSwitch: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    padding: 2,
    justifyContent: "center",
  },
  toggleSwitchActive: {
    backgroundColor: "#2563EB",
  },
  toggleSwitchInactive: {
    backgroundColor: "#D1D5DB",
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: "#FFFFFF",
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  toggleThumbInactive: {
    alignSelf: "flex-start",
  },
});
