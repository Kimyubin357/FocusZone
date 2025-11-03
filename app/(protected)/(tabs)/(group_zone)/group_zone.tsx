// app/(protected)/(tabs)/(group_zone)/group_zone.tsx — Minimal theming (preserve all UI/logic)

import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  collectionGroup, // 모든 'members' 하위 컬렉션을 검색
  deleteDoc,
  doc,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
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
  ownerName: string; // [수정]
  memberCount: number; // [수정]
  activeDays?: number[]; // [0~6] = 일~토
  inviteCode?: string; // 초대 코드
};

// 요일 라벨
const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

// util
const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function GroupZone() {
  const router = useRouter();
  // 기본 색상 (라이트 테마 가정)
  

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

      // 1. [collectionGroup] 이름이 'members'인 모든 하위 컬렉션에서
      const membersColGroupRef = collectionGroup(db, "members");

      // 2. [필드 쿼리] 내 uid가 'uid' 필드에 저장된 문서를 모두 찾음
      //    (이 쿼리가 작동하려면 add.tsx에서 'uid' 필드를 추가해야 함)
      const memberQuery = query(membersColGroupRef, where("uid", "==", uid));
      const memberDocsSnap = await getDocs(memberQuery);

      if (memberDocsSnap.empty) {
        setList([]);
        return;
      }

      // 3. 내가 속한 그룹들의 ID 목록 추출
      const myGroupIds = memberDocsSnap.docs.map(
        (doc) => doc.ref.parent.parent!.id // .../members/{autoId} -> .../members -> groupLocations/{groupId}
      );

      // 4. groupLocations 컬렉션에서 해당 ID의 그룹 정보들만 가져옴
      const groupsColRef = collection(db, "groupLocations");
      const groupsQuery = query(
        groupsColRef,
        where(documentId(), "in", myGroupIds)
      );
      const groupsSnap = await getDocs(groupsQuery);

      // 5. [수정] 'creatorId' -> 'ownerId'
      const ownerIds = [
        ...new Set(
          groupsSnap.docs.map((d) => d.data().ownerId as string).filter(Boolean)
        ),
      ];

      let ownersMap = new Map<string, string>();
      if (ownerIds.length > 0) {
        const usersQuery = query(
          collection(db, "users"),
          where(documentId(), "in", ownerIds)
        );
        const usersSnap = await getDocs(usersQuery);
        usersSnap.forEach((doc) => {
          ownersMap.set(doc.id, doc.data().displayName ?? "그룹장");
        });
      }

      const rows: GroupItem[] = groupsSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          groupName: data.groupName ?? "그룹장소명",
          address: data.address ?? "",
          // [수정] 'creatorId' -> 'ownerId'
          ownerName: ownersMap.get(data.ownerId) ?? "알 수 없음",
          // [수정] 'memberCount' 필드 사용
          memberCount: data.memberCount ?? 0,
          activeDays: data.activeDays ?? [],
          inviteCode: data.inviteCode,
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

  const onShare = async () => {
    if (!menuForId) return;
    const group = list.find((item) => item.id === menuForId);
    if (!group || !group.inviteCode) {
      Alert.alert("오류", "초대 코드를 찾을 수 없습니다.");
      closeMenu();
      return;
    }

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
      <Ionicons name="location-outline" size={48} color={colors.muted} />
      <Text style={[styles.emptyText, { color: colors.muted }]}>
        등록된 그룹장소가 없습니다
      </Text>
      <Text style={[styles.emptySubText, { color: colors.muted }]}>
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
const colors = {
    background: "#FFFFFF",
    card: "#F8F8F8",
    text: "#111111",
    muted: "#777777",
    tint: "#0D4093",
    border: "#E0E0E0",
  };
  const theme = "light"; // 다크모드 미사용 시 고정
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
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

      <TouchableOpacity
        style={[
          styles.fab,
          { backgroundColor: colors.tint, shadowColor: colors.tint },
        ]}
        onPress={goToAdd}
      >
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
            {
              position: "absolute",
              top: menuTop,
              left: menuLeft,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Pressable style={styles.menuItem} onPress={onEdit}>
            <Text style={[styles.menuText, { color: colors.text }]}>
              수정하기
            </Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={onShare}>
            <Text style={[styles.menuText, { color: colors.text }]}>
              공유하기
            </Text>
          </Pressable>
          <View
            style={[styles.menuDivider, { backgroundColor: colors.border }]}
          />
          <Pressable style={styles.menuItem} onPress={onDelete}>
            <Text
              style={[styles.menuText, { color: "#DC2626", fontWeight: "700" }]}
            >
              삭제하기
            </Text>
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
  
  const memberCount = item.memberCount;
  const colors = {
    background: "#FFFFFF",
    card: "#F8F8F8",
    text: "#111111",
    muted: "#777777",
    tint: "#0D4093",
    border: "#E0E0E0",
  };
  const theme = "light"; // 다크모드 미사용 시 고정

  // [수정] 아바타 로직: memberCount 기반으로 6개까지 임시 텍스트 생성
  const avatars = useMemo(() => {
    return Array.from(
      { length: Math.min(memberCount, 6) },
      (_, i) => `M${i + 1}`
    );
  }, [memberCount]);

  // 오늘 활성 여부
  const today = new Date().getDay();
  const isActiveToday = (item.activeDays ?? []).includes(today);
  // 유지: 초록 칩 톤(다크에선 투명도 조금 더)
  const chipBg = isActiveToday
    ? theme === "dark"
      ? "rgba(34,197,94,0.22)"
      : "rgba(34,197,94,0.18)"
    : theme === "dark"
      ? hexToRgba(colors.border, 0.25)
      : hexToRgba(colors.border, 0.35);
  const chipText = isActiveToday ? "#16A34A" : colors.muted;
  const chipLabel = isActiveToday ? "오늘 활성" : "오늘 비활성";

  // 메뉴 버튼 위치 측정용 ref
  const menuBtnRef = useRef<View>(null);
  const handleMenuPress = () => {
    menuBtnRef.current?.measureInWindow((x, y, w, h) =>
      onPressMenu({ x, y, w, h })
    );
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* 상단: 제목 + 메뉴 */}
      <View style={styles.rowBetween}>
        <Text
          style={[styles.cardTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.groupName || "그룹장소명"}
        </Text>
        <TouchableOpacity
          ref={menuBtnRef as any}
          style={styles.menuBtn}
          onPress={handleMenuPress}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* 주소 */}
      <View style={[styles.row, { marginTop: 4 }]}>
        <Ionicons
          name="location-outline"
          size={16}
          color={colors.muted}
          style={{ marginRight: 6 }}
        />
        <Text
          style={[styles.addrText, { color: colors.muted }]}
          numberOfLines={1}
        >
          {item.address || ""}
        </Text>
      </View>

      {/* 오너 + (오늘 활성/비활성) 칩 */}
      <View style={[styles.rowBetween, { marginTop: 8 }]}>
        <View style={styles.row}>
          <Ionicons
            name="person-circle-outline"
            size={16}
            color={colors.muted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.ownerText, { color: colors.text }]}>
            {item.ownerName ?? "알 수 없음"}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: chipBg }]}>
          <Text style={[styles.chipText, { color: chipText }]}>
            {chipLabel}
          </Text>
        </View>
      </View>

      {/* 요일 칩들 (원래 파랑/회색 톤 유지하되 테마와 조화) */}
      <View style={styles.daysRow}>
        {DAYS.map((label, idx) => {
          const active = (item.activeDays ?? []).includes(idx);
          const dBorder = active ? colors.tint : colors.border;
          const dBg = active
            ? hexToRgba(colors.tint, theme === "dark" ? 0.25 : 0.2)
            : theme === "dark"
              ? hexToRgba(colors.border, 0.25)
              : hexToRgba(colors.border, 0.35);
          const dText = active ? colors.tint : colors.muted;
          return (
            <View
              key={idx}
              style={[
                styles.dayChip,
                { borderColor: dBorder, backgroundColor: dBg },
              ]}
            >
              <Text style={[styles.dayText, { color: dText }]}>{label}</Text>
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
              style={[
                styles.avatar,
                {
                  marginLeft: idx === 0 ? 0 : -8,
                  backgroundColor: hexToRgba(colors.border, 0.6),
                  borderColor: colors.background,
                },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.text }]}>
                {typeof v === "string" ? v.slice(0, 2) : "M"}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <Ionicons
            name="people-outline"
            size={16}
            color={colors.muted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.memberCount, { color: colors.muted }]}>
            총 {memberCount}명
          </Text>
        </View>
      </View>
    </View>
  );
}

/* --------- 스타일 (레이아웃/치수만 유지; 색은 런타임 주입) --------- */
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },

  fab: {
    position: "absolute",
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
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
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubText: { fontSize: 14, marginTop: 4, textAlign: "center" },

  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardTitle: { fontSize: 16, fontWeight: "700", flex: 1, paddingRight: 8 },
  addrText: { fontSize: 14 },
  ownerText: { fontSize: 14 },

  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  chipText: { fontSize: 12, fontWeight: "700" },

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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  avatarText: { fontSize: 10, fontWeight: "700" },

  memberCount: { fontSize: 14 },

  menuBtn: { padding: 6, marginLeft: 8 },

  // 모달
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)" },
  menuBox: {
    borderRadius: 12,
    paddingVertical: 4,
    width: 180,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 16 },
  menuText: { fontSize: 14 },
  menuDanger: { fontWeight: "700" },
  menuDivider: { height: 1 },
});
