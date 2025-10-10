// app/(protected)/(tabs)/(group_zone)/group_zone.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard"; // [추가] 클립보드 기능
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  collectionGroup, // 이거 뭐하는 거야?
  deleteDoc,
  doc,
  documentId,
  getDocs,
  query,
  where
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList, // [추가]
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../../../firebaseConfig";

// ---- 타입
type GroupItem = {
  id: string;
  groupName: string;
  address: string;
  ownerName?: string;
  memberIds?: string[]; 
  memberAvatars?: string[]; // 얼굴 이미지
  activeDays?: number[]; // [0~6] = 일~토
  inviteCode?: string; // [추가] 초대 코드
};

// 요일 라벨
const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export default function GroupZone() {
  const router = useRouter();
  const [list, setList] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 메뉴 상태(어느 카드인지 + 버튼 좌표 앵커)
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
  const MENU_W = 180;
  const MENU_H = 160; // 대략치(항목 3~4개 기준)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setList([]);
        setLoading(false);
        return;
      }
      load(user.uid);
    });
    return unsub;
  }, []);

  // [수정] 내가 멤버인 모든 그룹을 불러오는 최적화된 로직
  const load = async (uid: string) => {
    try {
      setLoading(true);
      const membersColGroupRef = collectionGroup(db, "members");
      const memberQuery = query(membersColGroupRef, where("uid", "==", uid));
      const memberDocsSnap = await getDocs(memberQuery);

      if (memberDocsSnap.empty) {
        setList([]);
        return;
      }
      const myGroupIds = memberDocsSnap.docs.map(
        (doc) => doc.ref.parent.parent!.id
      );

      const groupsColRef = collection(db, "groupLocations");
      const groupsQuery = query(
        groupsColRef,
        where(documentId(), "in", myGroupIds)
      );
      const groupsSnap = await getDocs(groupsQuery);

      const creatorIds = [
        ...new Set(groupsSnap.docs.map((d) => d.data().creatorId as string)),
      ];
      let creatorsMap = new Map<string, string>();
      if (creatorIds.length > 0) {
        const usersQuery = query(
          collection(db, "users"),
          where(documentId(), "in", creatorIds)
        );
        const usersSnap = await getDocs(usersQuery);
        usersSnap.forEach((doc) => {
          creatorsMap.set(doc.id, doc.data().displayName ?? "그룹장");
        });
      }

      const rows: GroupItem[] = groupsSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          groupName: data.groupName ?? "그룹장소명",
          address: data.address ?? "",
          ownerName: creatorsMap.get(data.creatorId) ?? "알 수 없음",
          memberCount: data.memberCount ?? 0,
          activeDays: data.activeDays ?? [],
          inviteCode: data.inviteCode, // [추가] 초대 코드 불러오기
        };
      });
      setList(rows);
    } finally {
      setLoading(false);
    }
  };

  const goToAdd = () => router.push("/(protected)/(tabs)/(group_zone)/add");

  const onPressCardMenu = (
    id: string,
    anchor: { x: number; y: number; w: number; h: number }
  ) => {
    setMenuForId(id);
    setMenuAnchor(anchor);
  };
  const closeMenu = () => {
    setMenuForId(null);
    setMenuAnchor(null);
  };

  const onEdit = () => {
    if (!menuForId) return;
    router.push({
      pathname: "/(protected)/(tabs)/(group_zone)/add",
      params: { editMode: "true", placeId: menuForId },
    });
    closeMenu();
  };

  // [수정] 공유하기 기능 구현
  const onShare = async () => {
    if (!menuForId) return;
    const group = list.find((item) => item.id === menuForId);
    if (!group || !group.inviteCode) {
      Alert.alert("오류", "초대 코드를 찾을 수 없습니다.");
      closeMenu();
      return;
    }

    // myapp://join?code=초대코드 형식의 딥링크 생성
    const deepLink = `focuszone://join?code=${group.inviteCode}`;
    await Clipboard.setStringAsync(deepLink);
    Alert.alert("초대 링크 복사 완료", "친구에게 링크를 공유해보세요!");
    closeMenu();
  };

  const onDelete = async () => {
    if (!menuForId) return;
    try {
      await deleteDoc(doc(db, "groupLocations", menuForId));
      setList((prev) => prev.filter((x) => x.id !== menuForId));
    } catch (e) {
      console.log("delete error", e);
    } finally {
      closeMenu();
    }
  };

  // 앵커 기준 좌표 계산(화면 밖 보정)
  const menuTop = (() => {
    if (!menuAnchor) return 90;
    const below = menuAnchor.y + menuAnchor.h + 8;
    const above = menuAnchor.y - MENU_H - 8;
    return below + MENU_H <= SCREEN_H ? below : Math.max(8, above);
  })();
  const menuLeft = (() => {
    if (!menuAnchor) return SCREEN_W - MENU_W - 20;
    const preferred = menuAnchor.x + menuAnchor.w - MENU_W;
    return Math.min(Math.max(8, preferred), SCREEN_W - MENU_W - 8);
  })();

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={48} color="#D1D5DB" />
      <Text style={styles.emptyText}>등록된 그룹장소가 없습니다</Text>
      <Text style={styles.emptySubText}>
        + 버튼을 눌러 새로운 그룹장소를 추가해보세요
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: GroupItem }) => (
    <GroupCard
      item={item}
      onPressMenu={(anchor) => onPressCardMenu(item.id, anchor)}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={list}
          renderItem={renderItem}
          keyExtractor={(it) => it.id}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={goToAdd}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* 카드별 3점 메뉴 (앵커 위치에 표시) */}
      <Modal
        visible={!!menuForId}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <View />
        </Pressable>
        <View
          style={[
            styles.menuBox,
            { position: "absolute", top: menuTop, left: menuLeft },
          ]}
        >
          <Pressable style={styles.menuItem} onPress={onEdit}>
            <Text style={styles.menuText}>수정하기</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={onShare}>
            <Text style={styles.menuText}>공유하기</Text>
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable style={styles.menuItem} onPress={onDelete}>
            <Text style={[styles.menuText, styles.menuDanger]}>삭제하기</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* --------- 카드 컴포넌트 --------- */
function GroupCard({
  item,
  onPressMenu,
}: {
  item: GroupItem;
  onPressMenu: (anchor: { x: number; y: number; w: number; h: number }) => void;
}) {
  const memberCount = item.memberIds?.length ?? 0;

  const avatars = useMemo(() => {
    const arr =
      item.memberAvatars && item.memberAvatars.length > 0
        ? item.memberAvatars.slice(0, 6)
        : Array.from(
            { length: Math.min(memberCount, 6) },
            (_, i) => `M${i + 1}`
          );
    return arr;
  }, [item.memberAvatars, memberCount]);

  // 오늘 활성 여부
  const today = new Date().getDay(); // 0=일 ~ 6=토
  const isActiveToday = (item.activeDays ?? []).includes(today);
  const chipBg = isActiveToday ? "#DCFCE7" : "#F3F4F6";
  const chipText = isActiveToday ? "#166534" : "#6B7280";
  const chipLabel = isActiveToday ? "오늘 활성" : "오늘 비활성";

  // 메뉴 버튼 위치 측정용 ref
  const menuBtnRef = useRef<View>(null);
  const handleMenuPress = () => {
    menuBtnRef.current?.measureInWindow((x, y, w, h) => {
      onPressMenu({ x, y, w, h });
    });
  };

  return (
    <View style={styles.card}>
      {/* 상단: 제목 + 메뉴 */}
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.groupName || "그룹장소명"}
        </Text>
        <TouchableOpacity
          ref={menuBtnRef as any}
          style={styles.menuBtn}
          onPress={handleMenuPress}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* 주소 */}
      <View style={[styles.row, { marginTop: 4 }]}>
        <Ionicons
          name="location-outline"
          size={16}
          color="#6B7280"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.addrText} numberOfLines={1}>
          {item.address || ""}
        </Text>
      </View>

      {/* 오너 + (오늘 활성/비활성) 칩 */}
      <View style={[styles.rowBetween, { marginTop: 8 }]}>
        <View style={styles.row}>
          <Ionicons
            name="person-circle-outline"
            size={16}
            color="#6B7280"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.ownerText}>{item.ownerName ?? "알 수 없음"}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: chipBg }]}>
          <Text style={[styles.chipText, { color: chipText }]}>
            {chipLabel}
          </Text>
        </View>
      </View>

      {/* 요일 칩들 */}
      <View style={styles.daysRow}>
        {DAYS.map((label, idx) => {
          const active = (item.activeDays ?? []).includes(idx);
          return (
            <View
              key={idx}
              style={[
                styles.dayChip,
                {
                  borderColor: active ? "#2563EB" : "#D1D5DB",
                  backgroundColor: active ? "#DBEAFE" : "#F3F4F6",
                },
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  { color: active ? "#1E40AF" : "#6B7280" },
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 하단: 멤버 아이콘들 + 총 인원 */}
      <View style={[styles.rowBetween, { marginTop: 12 }]}>
        <View style={styles.row}>
          {avatars.map((v, idx) => (
            <View
              key={idx}
              style={[styles.avatar, { marginLeft: idx === 0 ? 0 : -8 }]}
            >
              <Text style={styles.avatarText}>
                {typeof v === "string" ? v.slice(0, 2) : "M"}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <Ionicons
            name="people-outline"
            size={16}
            color="#6B7280"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.memberCount}>총 {memberCount}명</Text>
        </View>
      </View>
    </View>
  );
}

/* --------- 스타일 --------- */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },

  fab: {
    position: "absolute",
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    paddingRight: 8,
  },
  addrText: { fontSize: 14, color: "#6B7280", flexShrink: 1 },
  ownerText: { fontSize: 14, color: "#111827" },

  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  chipText: { fontSize: 12, fontWeight: "700" },

  // 요일 칩 영역( gap 대신 margin 사용 )
  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    marginRight: -8,
  },
  dayChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  dayText: { fontSize: 12, fontWeight: "700" },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  avatarText: { fontSize: 10, color: "#374151", fontWeight: "700" },

  memberCount: { fontSize: 14, color: "#6B7280" },

  menuBtn: { padding: 6, marginLeft: 8 },

  // 모달
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)" },
  menuBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 4,
    width: 180,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 16 },
  menuText: { fontSize: 14, color: "#111827" },
  menuDanger: { color: "#DC2626", fontWeight: "700" },
  menuDivider: { height: 1, backgroundColor: "#E5E7EB" },
});
