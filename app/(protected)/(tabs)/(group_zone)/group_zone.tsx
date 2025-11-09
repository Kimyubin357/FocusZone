// app/(protected)/(tabs)/(group_zone)/group_zone.tsx — Minimal theming (preserve all UI/logic)
import { Ionicons } from "@expo/vector-icons";
import NetInfo, { useNetInfo } from "@react-native-community/netinfo";
import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  Unsubscribe,
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
  ownerName: string;
  userId: string;
  memberIds?: string[];
  memberAvatars?: string[];
  memberCount: number;
  activeDays?: number[];
  inviteCode?: string;
  ownerId?: string;
  myRole?: string;
  isActive?: boolean; // [추가]
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

function OfflineWarning({ onRetry }: { onRetry: () => void }) {
  const colors = { text: "#111111", muted: "#777777", card: "#F8F8F8" }; // (간소화)
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.muted} />
      <Text style={[styles.emptyText, { color: colors.text }]}>
        네트워크 연결 필요
      </Text>
      <Text style={[styles.emptySubText, { color: colors.muted }]}>
        그룹장소 기능은 온라인 상태에서만 사용할 수 있습니다.
      </Text>
      <TouchableOpacity onPress={() => onRetry()} style={styles.retryButton}>
        <Text style={styles.retryButtonText}>새로고침</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GroupZone() {
  const router = useRouter();
  const [list, setList] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUid, setMyUid] = useState<string | null>(null);

  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected === true;

  // onSnapshot 구독 해제 함수를 저장할 ref
  const firestoreUnsub = useRef<Unsubscribe | undefined>();

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

  // 1. 인증 상태 리스너
  useEffect(() => {
    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setList([]);
        setLoading(false);
        setMyUid(null);
        // 로그아웃 시 Firestore 구독 해제
        if (firestoreUnsub.current) {
          firestoreUnsub.current();
          firestoreUnsub.current = undefined;
        }
      } else {
        setMyUid(user.uid);
      }
    });
    return authUnsub;
  }, []); // 의존성 배열 비움

  // 2. 네트워크 + 인증 상태 기반 리스너
  useEffect(() => {
    // 구독 해제 함수 (중복 호출 방지용)
    const cleanupListener = () => {
      if (firestoreUnsub.current) {
        firestoreUnsub.current();
        firestoreUnsub.current = undefined;
      }
    };

    if (myUid && isOnline) {
      // 온라인 + 로그인 상태: 구독 시작
      setLoading(true);
      load(myUid); // load 함수가 내부적으로 ref를 설정
    } else {
      // 오프라인 또는 로그아웃: 구독 해제
      setLoading(false); // 오프라인이면 로딩 중지
      cleanupListener();
    }

    // 이 useEffect가 unmount될 때 (화면 나가기 등)
    return cleanupListener;
  }, [myUid, isOnline]); // myUid 또는 isOnline이 변경될 때마다 실행

  // [수정] onSnapshot으로 실시간 업데이트
  const load = async (uid: string) => {
    try {
      // load가 호출될 때 기존 리스너가 있다면 먼저 해제
      if (firestoreUnsub.current) {
        firestoreUnsub.current();
        firestoreUnsub.current = undefined;
      }

      const membersColGroupRef = collectionGroup(db, "members");
      const memberQuery = query(membersColGroupRef, where("uid", "==", uid));
      const memberDocsSnap = await getDocs(memberQuery);

      if (memberDocsSnap.empty) {
        setList([]);
        setLoading(false);
        return; // 구독할 것이 없으므로 종료
      }

      const myRolesMap = new Map<string, string>();
      memberDocsSnap.docs.forEach((doc) => {
        const groupId = doc.ref.parent.parent!.id;
        const role = doc.data().role;
        myRolesMap.set(groupId, role);
      });

      const myGroupIds = memberDocsSnap.docs.map(
        (doc) => doc.ref.parent.parent!.id
      );

      if (myGroupIds.length === 0) {
        setList([]);
        setLoading(false);
        return;
      }

      const groupsColRef = collection(db, "groupLocations");
      const groupsQuery = query(
        groupsColRef,
        where(documentId(), "in", myGroupIds)
      );

      // [수정] onSnapshot으로 실시간 구독
      const unsubscribe = onSnapshot(groupsQuery, async (groupsSnap) => {
        const ownerIds = [
          ...new Set(
            groupsSnap.docs
              .map((d) => d.data().ownerId as string)
              .filter(Boolean)
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
            ownerName: ownersMap.get(data.ownerId) ?? "알 수 없음",
            userId: data.ownerId,
            memberCount: data.memberCount ?? 0,
            activeDays: data.activeDays ?? [],
            inviteCode: data.inviteCode,
            ownerId: data.ownerId,
            myRole: myRolesMap.get(doc.id),
            isActive: data.isActive,
          };
        });
        setList(rows);
        setLoading(false);
      });

      // 구독 해제 함수를 ref에 저장
      firestoreUnsub.current = unsubscribe;
    } catch (error) {
      console.error("그룹 로드 오류:", error);
      setLoading(false);
    }
  };

  const goToAdd = () => router.push("/(protected)/(tabs)/(group_zone)/add");

  // [추가] 지도 페이지로 이동
  const goToMap = () =>
    router.push("/(protected)/(tabs)/(group_zone)/group_zone_map");

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
    const group = list.find((item) => item.id === menuForId);

    // 권한 체크
    if (group?.myRole !== "owner") {
      Alert.alert("권한 없음", "그룹장만 수정할 수 있습니다.");
      closeMenu();
      return;
    }
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

    const deepLink = `https://focuszone-568cc.web.app/join?code=${group.inviteCode}`;
    await Clipboard.setStringAsync(deepLink);
    Alert.alert("초대 링크 복사 완료", "친구에게 링크를 공유해보세요!");
    closeMenu();
  };

  const onDelete = async () => {
    if (!menuForId) return;
    const group = list.find((item) => item.id === menuForId);

    // 권한 체크
    if (group?.myRole !== "owner") {
      Alert.alert("권한 없음", "그룹장만 삭제할 수 있습니다.");
      closeMenu();
      return;
    }

    closeMenu(); // ⭐️ Alert 표시 전에 먼저 닫기

    Alert.alert("그룹 삭제", "정말로 이 그룹을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "groupLocations", menuForId));
            // setList((prev) => prev.filter((x) => x.id !== menuForId));
            Alert.alert("완료", "그룹이 삭제되었습니다.");
          } catch (e) {
            console.log("delete error", e);
            Alert.alert("오류", "삭제 중 문제가 발생했습니다.");
          } finally {
            closeMenu();
          }
        },
      },
    ]);
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

  // 👈 [추가] 카드 클릭 핸들러
  const onPressCard = (item: GroupItem) => {
    if (!myUid) return;

    const isOwner = item.userId === myUid;

    if (isOwner) {
      // 그룹장일 경우: 상세 페이지로 이동
      router.push({
        pathname: `/(protected)/(tabs)/(group_zone)/${item.id}`,
      });
    } else {
      // 그룹원일 경우: 내 통계 페이지로 이동
      router.push({
        pathname: `/(protected)/(tabs)/(group_zone)/stats/${item.id}`,
      });
    }
  };
  const colors = {
    background: "#FFFFFF",
    card: "#F8F8F8",
    text: "#111111",
    muted: "#777777",
    tint: "#0D4093",
    border: "#E0E0E0",
  };

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
    <Pressable onPress={() => onPressCard(item)}>
      <GroupCard
        item={item}
        onPressMenu={(anchor) => onPressCardMenu(item.id, anchor)}
      />
    </Pressable>
  );

  const theme = "light";

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          title: "그룹장소",
        }}
      />

      {/* [수정] 헤더에 + 버튼과 지도 버튼 모두 배치 */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          그룹장소
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={goToAdd}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.tint} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToMap}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Ionicons name="map-outline" size={24} color={colors.tint} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator />
        </View>
      ) : !isOnline ? ( // ⭐️ 로딩이 끝났는데 오프라인이면 경고
        <OfflineWarning onRetry={NetInfo.fetch} />
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
          {/* [추가] 그룹장만 수정/삭제 가능 */}
          {list.find((item) => item.id === menuForId)?.myRole === "owner" ? (
            <>
              <Pressable style={styles.menuItem} onPress={onEdit}>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  수정하기
                </Text>
              </Pressable>
              <View
                style={[styles.menuDivider, { backgroundColor: colors.border }]}
              />
            </>
          ) : null}
          <Pressable style={styles.menuItem} onPress={onShare}>
            <Text style={[styles.menuText, { color: colors.text }]}>
              공유하기
            </Text>
          </Pressable>
          {list.find((item) => item.id === menuForId)?.myRole === "owner" ? (
            <>
              <View
                style={[styles.menuDivider, { backgroundColor: colors.border }]}
              />
              <Pressable style={styles.menuItem} onPress={onDelete}>
                <Text
                  style={[
                    styles.menuText,
                    { color: "#DC2626", fontWeight: "700" },
                  ]}
                >
                  삭제하기
                </Text>
              </Pressable>
            </>
          ) : null}
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
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: item.isActive === false ? 0.6 : 1, // [추가] 비활성화 시 흐리게
        },
      ]}
    >
      <View style={styles.rowBetween}>
        <Text
          style={[styles.cardTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.groupName || "그룹장소명"}
          {/* [추가] 비활성화 표시 */}
          {item.isActive === false ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}> (비활성화)</Text>
          ) : null}
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

  // [추가] 헤더 스타일
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  // [추가] 헤더 버튼들 컨테이너
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },

  loader: { flex: 1, alignItems: "center", justifyContent: "center" },

  // 🚨 [정리] 중복 선언된 empty* 스타일 제거
  // emptyContainer: { ... }
  // emptyText: { ... }
  // emptySubText: { ... }

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

  // [유지] OfflineWarning과 renderEmpty가 모두 사용하는 스타일
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20, // 텍스트 줄바꿈용
  },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptySubText: { fontSize: 14, marginTop: 4, textAlign: "center" },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#0D4093",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});