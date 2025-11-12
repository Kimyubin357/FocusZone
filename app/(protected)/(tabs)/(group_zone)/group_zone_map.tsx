// ─────────────────────────────────────────────────────────────────────────────
// 1) IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useNetInfo } from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  collectionGroup,
  documentId,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import MapView, { Circle, Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { auth, db } from "../../../../firebaseConfig";

// ─────────────────────────────────────────────────────────────────────────────
// 2) TYPES
// ─────────────────────────────────────────────────────────────────────────────
type GroupItem = {
  id: string;
  groupName: string;
  address: string;
  ownerName: string;
  memberCount: number;
  activeDays?: number[];
  inviteCode?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  isActive?: boolean;
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 3) COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GroupZoneMap() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected === true;
  const snapPoints = useMemo(() => ["3%", "50%", "90%"], []);

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState<Region>({
    latitude: 37.5665,
    longitude: 126.978,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline && !loading) {
      Alert.alert("네트워크 연결 끊김", "지도 기능은 온라인 상태에서만 사용할 수 있습니다.", [
        { text: "확인", onPress: () => router.back() },
      ]);
    }
  }, [isOnline, loading]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setGroups([]);
        setLoading(false);
        return;
      }
      const unsubscribeGroups = loadGroups(user.uid);
      return () => {
        if (unsubscribeGroups) unsubscribeGroups.then((unsub) => unsub?.());
      };
    });
    return unsub;
  }, []);

  const loadGroups = async (uid: string) => {
    try {
      setLoading(true);

      const membersColGroupRef = collectionGroup(db, "members");
      const memberQuery = query(membersColGroupRef, where("uid", "==", uid));
      const memberDocsSnap = await getDocs(memberQuery);

      if (memberDocsSnap.empty) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const myGroupIds = memberDocsSnap.docs.map(
        (doc) => doc.ref.parent.parent!.id
      );

      const groupsColRef = collection(db, "groupLocations");
      const groupsQuery = query(groupsColRef, where(documentId(), "in", myGroupIds));

      const unsubscribe = onSnapshot(groupsQuery, async (groupsSnap) => {
        const ownerIds = [
          ...new Set(
            groupsSnap.docs.map((d) => d.data().ownerId as string).filter(Boolean)
          ),
        ];

        let ownersMap = new Map<string, string>();
        if (ownerIds.length > 0) {
          const usersQuery = query(collection(db, "users"), where(documentId(), "in", ownerIds));
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
            memberCount: data.memberCount ?? 0,
            activeDays: data.activeDays ?? [],
            inviteCode: data.inviteCode,
            latitude: data.latitude,
            longitude: data.longitude,
            radius: data.radius ?? 400,
            isActive: data.isActive ?? true,
          };
        });

        setGroups(rows);
        setLoading(false);
      });

      return unsubscribe;
    } catch (e) {
      console.error("그룹 로드 오류:", e);
      Alert.alert("오류", "그룹 정보를 불러올 수 없습니다.");
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          });
        }
      } catch (e) {
        console.error("현재 위치 가져오기 실패:", e);
      }
    })();
  }, []);

  // 지도 이동
  const animateTo = (lat: number, lng: number, latDelta = 0.01, lngDelta = 0.01) => {
    setRegion({ latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: lngDelta });
    mapRef.current?.animateCamera(
      { center: { latitude: lat, longitude: lng }, zoom: 17 },
      { duration: 1200 }
    );
  };

  // 그룹 클릭 시 이동
  const onGroupPress = (group: GroupItem) => {
    if (group.latitude && group.longitude) {
      animateTo(group.latitude, group.longitude);
    }
  };

  // 현재 위치로 이동
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("권한 필요", "위치 권한을 허용해주세요.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      animateTo(loc.coords.latitude, loc.coords.longitude);
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "현재 위치를 가져올 수 없습니다.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // GROUP CARD (리디자인)
  // ─────────────────────────────────────────────────────────────────────────────
  const renderGroupCard = ({ item }: { item: GroupItem }) => {
    const isActive = item.isActive !== false;

    return (
      <TouchableOpacity
        style={[
          styles.groupCard,
          {
            borderColor: isActive ? "#0D4093" : "#CBD5E1",
            backgroundColor: isActive ? "#F8FAFC" : "#F1F5F9",
            opacity: isActive ? 1 : 0.7,
          },
        ]}
        activeOpacity={0.85}
        onPress={() => onGroupPress(item)}
      >
        {/* 상단: 이름 + 상태 */}
        <View style={styles.cardTopRow}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.groupName}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: isActive ? "#E0E7FF" : "#FEE2E2" }]}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: isActive ? "#0D4093" : "#DC2626",
              }}
            >
              {isActive ? "활성" : "비활성"}
            </Text>
          </View>
        </View>

        {/* 주소 */}
        <Text style={styles.address} numberOfLines={1}>
          {item.address || "주소 정보 없음"}
        </Text>

        {/* 하단: 그룹장, 인원, 요일, 이동 */}
        <View style={styles.cardBottomRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="person-outline" size={14} color="#0D4093" />
            <Text style={styles.ownerText}> {item.ownerName}</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 10 }}>
            <Ionicons name="people-outline" size={14} color="#0D4093" />
            <Text style={styles.memberText}> {item.memberCount}명</Text>
          </View>

          <View style={{ flex: 1 }} />

          {item.activeDays && item.activeDays.length > 0 && (
            <Text style={styles.daysText}>{item.activeDays.map((d) => DAYS[d]).join("·")}</Text>
          )}

          <TouchableOpacity style={styles.navigateButton} onPress={() => onGroupPress(item)}>
            <Ionicons name="navigate-outline" size={18} color="#0D4093" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#0D4093" />
        <Text style={{ marginTop: 12, color: "#666" }}>그룹 정보를 불러오는 중...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          mapType="standard"
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={region}
          showsUserLocation={true}
          showsMyLocationButton={false}
          userLocationAnnotationTitle="내 위치"
          userLocationPriority="high"
          followsUserLocation={true}
        >
          {groups
            .filter((g) => g.latitude && g.longitude)
            .map((group) => {
              const isActive = group.isActive !== false;
              return (
                <React.Fragment key={group.id}>
                  <Circle
                    center={{ latitude: group.latitude!, longitude: group.longitude! }}
                    radius={group.radius || 400}
                    strokeWidth={2}
                    strokeColor={isActive ? "#0D4093" : "#9CA3AF"}
                    fillColor={
                      isActive ? "rgba(13,64,147,0.2)" : "rgba(156,163,175,0.2)"
                    }
                  />
                  <Marker
                    coordinate={{ latitude: group.latitude!, longitude: group.longitude! }}
                    title={group.groupName}
                    description={group.address}
                    opacity={isActive ? 1 : 0.6}
                  />
                </React.Fragment>
              );
            })}
        </MapView>

        {/* 현재 위치 버튼 */}
        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
          <Ionicons name="navigate-outline" size={22} color="#000" />
        </TouchableOpacity>

        {/* 하단 시트 */}
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose={false}
          enableOverDrag={false}
          enableHandlePanningGesture
          style={styles.bottomSheet}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.title}>그룹장소</Text>
            <Text style={styles.countText}>{groups.length}개</Text>
          </View>

          <BottomSheetFlatList
            data={groups}
            renderItem={renderGroupCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="map-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>등록된 그룹장소가 없습니다</Text>
              </View>
            }
          />
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  locationButton: {
    position: "absolute",
    top: 60,
    right: 16,
    width: 46,
    height: 46,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 23,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
  },

  bottomSheet: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0D4093",
  },
  countText: {
    fontSize: 15,
    color: "#0D4093",
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  // ─ 그룹 카드 ─
  groupCard: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.2,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  address: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ownerText: { fontSize: 13, color: "#334155" },
  memberText: { fontSize: 13, color: "#334155" },
  daysText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  navigateButton: { marginLeft: 8, padding: 4 },

  // ─ Empty ─
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
});
