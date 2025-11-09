import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
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
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import MapView, { Circle, Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { auth, db } from "../../../../firebaseConfig";

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

export default function GroupZoneMap() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => ["5%", "50%", "90%"], []);

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState<Region>({
    latitude: 37.5665,
    longitude: 126.978,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setGroups([]);
        setLoading(false);
        return;
      }
      const unsubscribeGroups = loadGroups(user.uid);
      return () => {
        if (unsubscribeGroups) unsubscribeGroups.then(unsub => unsub?.());
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
      const groupsQuery = query(
        groupsColRef,
        where(documentId(), "in", myGroupIds)
      );

      const unsubscribe = onSnapshot(groupsQuery, async (groupsSnap) => {
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

  const animateTo = (
    lat: number,
    lng: number,
    latDelta = 0.01,
    lngDelta = 0.01
  ) => {
    const next: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 350);
  };

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

  const onGroupPress = (group: GroupItem) => {
    if (group.latitude && group.longitude) {
      animateTo(group.latitude, group.longitude, region.latitudeDelta, region.longitudeDelta);
    }
  };

  const renderGroupCard = ({ item }: { item: GroupItem }) => (
    <TouchableOpacity
      style={[
        styles.groupCard,
        { opacity: item.isActive === false ? 0.6 : 1 }
      ]}
      onPress={() => onGroupPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.groupName}
            {item.isActive === false && (
              <Text style={{ fontSize: 12, color: "#999" }}> (비활성화)</Text>
            )}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </View>
        <Text style={styles.address} numberOfLines={1}>
          {item.address}
        </Text>
        {item.isActive === false && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>비활성화</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#0D4093" />
        <Text style={{ marginTop: 12, color: "#666" }}>그룹 정보를 불러오는 중...</Text>
      </View>
    );
  }

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
              const strokeColor = isActive ? "#0D4093" : "#9CA3AF";
              const fillColor = isActive 
                ? "rgba(13, 64, 147, 0.2)" 
                : "rgba(156, 163, 175, 0.2)";
              
              return (
                <React.Fragment key={group.id}>
                  <Circle
                    center={{
                      latitude: group.latitude!,
                      longitude: group.longitude!,
                    }}
                    radius={group.radius || 400}
                    strokeWidth={2}
                    strokeColor={strokeColor}
                    fillColor={fillColor}
                  />
                  <Marker
                    coordinate={{
                      latitude: group.latitude!,
                      longitude: group.longitude!,
                    }}
                    title={group.groupName}
                    description={group.address}
                    opacity={isActive ? 1 : 0.6}
                  />
                </React.Fragment>
              );
            })}
        </MapView>

        {/* ⭐️ [수정] map.tsx와 동일한 현재 위치 버튼 */}
        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate-outline" size={22} color="#000" />
        </TouchableOpacity>

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
            <Text style={styles.countText}>{groups.length}/{groups.length}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  
  // ⭐️ [수정] map.tsx와 동일한 스타일
  locationButton: {
    position: "absolute",
    top: 60, // 검색바가 있다면 그 아래 위치
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
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
    color: "#222",
  },
  countText: {
    fontSize: 16,
    color: "#0D4093",
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  groupCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    flex: 1,
    marginRight: 8,
  },
  address: {
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  statusBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626",
  },
});