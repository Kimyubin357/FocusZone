// app/(protected)/(tabs)/(group_zone)/group_zone.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

// ---- 타입(필요한 필드만 정의; 백엔드 구조에 맞춰 확장하세요)
type GroupItem = {
  id: string;
  locationName: string;
  address: string;
  ownerName?: string; // 없으면 "알 수 없음"
  statusLabel?: string; // 예: "그룹형", "부재 중"
  memberIds?: string[];
  memberAvatars?: string[]; // URL 이나 이니셜 (여기서는 이니셜 가정)
};

export default function GroupZone() {
  const router = useRouter();
  const [list, setList] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuForId, setMenuForId] = useState<string | null>(null);

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

  const load = async (uid: string) => {
    try {
      setLoading(true);
      // ⚠️ 현재는 "내가 만든 장소"만: userId == uid
      const colRef = collection(db, "groupLocations");
      const qy = query(colRef, where("userId", "==", uid));
      const snap = await getDocs(qy);
      const rows: GroupItem[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          locationName: data.locationName ?? "그룹장소명",
          address: data.address ?? "",
          ownerName: data.ownerName ?? data.owner ?? "알 수 없음",
          statusLabel: data.statusLabel ?? (data.isAway ? "부재 중" : "그룹형"),
          memberIds: data.memberIds ?? [],
          memberAvatars: data.memberAvatars ?? [], // 없으면 아래에서 이니셜로 대체
        };
      });
      setList(rows);
    } finally {
      setLoading(false);
    }
  };

  const goToAdd = () => router.push("/(protected)/(tabs)/(group_zone)/add");

  const onPressCardMenu = (id: string) => setMenuForId(id);
  const closeMenu = () => setMenuForId(null);

  const onEdit = () => {
    if (!menuForId) return;
    // 라우팅 예시(필요에 맞게 수정): /add?editMode=true&placeId=...
    router.push({
      pathname: "/(protected)/(tabs)/(group_zone)/add",
      params: { editMode: "true", placeId: menuForId },
    });
    closeMenu();
  };

  const onShare = () => {
    // 공유 로직 연결 지점(딥링크/초대코드 등)
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
    <GroupCard item={item} onPressMenu={() => onPressCardMenu(item.id)} />
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

      {/* 카드별 3점 메뉴 */}
      <Modal
        visible={!!menuForId}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <View />
        </Pressable>
        <View style={styles.menuBox}>
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
  onPressMenu: () => void;
}) {
  const memberCount = item.memberIds?.length ?? 0;
  const avatars = useMemo(() => {
    // 이니셜 자리수 6개만 노출(예시)
    const arr =
      item.memberAvatars && item.memberAvatars.length > 0
        ? item.memberAvatars.slice(0, 6)
        : Array.from(
            { length: Math.min(memberCount, 6) },
            (_, i) => `M${i + 1}`
          );
    return arr;
  }, [item.memberAvatars, memberCount]);

  const statusChipBg = item.statusLabel === "부재 중" ? "#FFE4E6" : "#E0E7FF";
  const statusChipText = item.statusLabel === "부재 중" ? "#B91C1C" : "#3730A3";

  return (
    <View style={styles.card}>
      {/* 상단: 제목 + 메뉴 */}
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.locationName || "그룹장소명"}
        </Text>
        <TouchableOpacity style={styles.menuBtn} onPress={onPressMenu}>
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

      {/* 오너 + 상태칩 */}
      <View style={[styles.rowBetween, { marginTop: 8 }]}>
        <View style={styles.row}>
          <Ionicons
            name="person-circle-outline" //수정
            size={16}
            color="#6B7280"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.ownerText}>{item.ownerName ?? "알 수 없음"}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: statusChipBg }]}>
          <Text style={[styles.chipText, { color: statusChipText }]}>
            {item.statusLabel ?? "그룹형"}
          </Text>
        </View>
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

  // 메뉴(모달)
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)" },
  menuBox: {
    position: "absolute",
    right: 20,
    top: 90, // 필요시 위치 조정
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
