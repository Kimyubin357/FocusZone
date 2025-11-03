// app/(protected)/(tabs)/(group_zone)/add.tsx — Minimal theming (preserve all UI/logic)

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../../../firebaseConfig";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
type BlockingPolicy = "MEMBERS_ONLY" | "ALL_PARTICIPANTS"; // [추가]

// [추가] 7자리의 랜덤 초대 코드를 생성하는 헬퍼 함수
const generateInviteCode = (length = 7) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function AddGroupPlace() {
  const router = useRouter();
  
  const params = useLocalSearchParams<{
    editMode?: string;
    placeId?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
    radius?: string;
    name?: string;
  }>();
 // 기본 색상 (라이트 테마 가정)
  const colors = {
    background: "#FFFFFF",
    card: "#F8F8F8",
    text: "#111111",
    muted: "#777777",
    tint: "#0D4093",
    border: "#E0E0E0",
  };
  const theme = "light"; // 다크모드 미사용 시 고정
  
  const isEditMode = params.editMode === "true";
  const placeId = params.placeId;

  // form states
  // form states
  const [groupName, setGroupName] = useState(params.name ?? "새로운 그룹장소");
  const [address, setAddress] = useState(params.address ?? "주소를 선택하세요");

  const [latitude, setLatitude] = useState<number | undefined>(
    params.latitude ? Number(params.latitude) : undefined
  );
  const [longitude, setLongitude] = useState<number | undefined>(
    params.longitude ? Number(params.longitude) : undefined
  );
  const [radius, setRadius] = useState<number>(
    params.radius ? Number(params.radius) : 400
  );
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 요일

  // [추가] DB 스키마에 맞춘 새 상태
  const [blockingPolicy, setBlockingPolicy] =
    useState<BlockingPolicy>("MEMBERS_ONLY");
  const [blockedAppCategories, setBlockedAppCategories] = useState<string[]>([]);

  // ui states
  const [loadingDoc, setLoadingDoc] = useState<boolean>(isEditMode); // 수정모드면 처음에 로딩
  const [saving, setSaving] = useState<boolean>(false);

  // (임시) 차단 앱 수
  const appsBlockedCount = 0;

  const toggleDay = (idx: number) => {
    setSelectedDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
    );
  };

  // 수정 모드일 때 기존 문서 불러오기
  useEffect(() => {
    let ignore = false;
    const loadDoc = async () => {
      if (!isEditMode || !placeId) return;
      try {
        setLoadingDoc(true);
        const ref = doc(db, "groupLocations", placeId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          Alert.alert("알림", "해당 장소를 찾을 수 없습니다.");
          router.replace("/(protected)/(tabs)/(group_zone)/group_zone");
          return;
        }
        if (ignore) return;
        const data = snap.data() as any;
        setGroupName(data.groupName ?? "그룹장소");
        setAddress(data.address ?? "");
        setLatitude(
          typeof data.latitude === "number" ? data.latitude : undefined
        );
        setLongitude(
          typeof data.longitude === "number" ? data.longitude : undefined
        );
        setRadius(typeof data.radius === "number" ? data.radius : 400);
        setSelectedDays(Array.isArray(data.activeDays) ? data.activeDays : []);

        // [추가] 새 스키마 필드 불러오기
        setBlockingPolicy(data.blockingPolicy ?? "MEMBERS_ONLY");
        setBlockedAppCategories(
          Array.isArray(data.blockedAppCategories)
            ? data.blockedAppCategories
            : []
        );
      } catch (e: any) {
        Alert.alert("에러", String(e?.message ?? e));
      } finally {
        setLoadingDoc(false);
      }
    };
    loadDoc();
    return () => {
      ignore = true;
    };
  }, [isEditMode, placeId]);

  // 저장(생성/수정 공용)
  const onSave = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("안내", "로그인이 필요합니다.");
    if (!groupName?.trim())
      return Alert.alert("안내", "그룹장소명을 입력해 주세요.");
    if (!address || address === "주소를 선택하세요")
      return Alert.alert("안내", "주소를 선택해 주세요.");

    setSaving(true);

    try {
      if (isEditMode && placeId) {
        // --- 수정 모드 ---
        const payload = {
          groupName: groupName.trim(),
          address,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          radius: Number(radius) || 400,
          activeDays: selectedDays.sort((a, b) => a - b),
          updatedAt: serverTimestamp(),
          // [추가] 스키마 필드
          blockingPolicy: blockingPolicy,
          blockedAppCategories: blockedAppCategories,
        };
        // [수정] 컬렉션명 "groupLocations"
        await updateDoc(doc(db, "groupLocations", placeId), payload);
      } else {
        // --- 생성 모드 ---
        // 1. 유니크한 초대 코드 생성
        let inviteCode = "";
        let isCodeUnique = false;
        // [수정] 컬렉션명 "groupLocations"
        const groupLocationsRef = collection(db, "groupLocations");
        while (!isCodeUnique) {
          inviteCode = generateInviteCode();
          const q = query(
            groupLocationsRef,
            where("inviteCode", "==", inviteCode)
          );
          const snapshot = await getDocs(q);
          if (snapshot.empty) {
            isCodeUnique = true;
          }
        }

        // 2. 트랜잭션을 위한 Batch 생성
        const batch = writeBatch(db);

        // 3. 생성할 그룹 문서 참조 (ID를 미리 생성)
        const newGroupRef = doc(groupLocationsRef);

        // 4. 그룹 문서에 저장할 데이터 (Payload)
        const newGroupPayload = {
          groupName: groupName.trim(),
          address,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          radius: Number(radius) || 400,
          activeDays: selectedDays.sort((a, b) => a - b),
          // [수정] creatorId -> ownerId
          ownerId: user.uid,
          inviteCode: inviteCode,
          // memberCount: 1, // (참고: 이 필드는 Cloud Functions로 관리하는 것이 더 정확합니다)
          // presentMemberCount: 0, // (실시간 데이터이므로 members 컬렉션 집계가 나음)
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // [추가] 스키마 필드
          blockingPolicy: blockingPolicy,
          blockedAppCategories: blockedAppCategories,
        };
        batch.set(newGroupRef, newGroupPayload);

        // 5. 'members' 서브 컬렉션에 그룹장 정보 저장
        const memberRef = doc(
          collection(db, "groupLocations", newGroupRef.id, "members")
        );
        // (선택) user 프로필에서 displayName 가져오기
        const userProfileSnap = await getDoc(doc(db, "users", user.uid));
        const displayName =
          userProfileSnap.data()?.displayName ?? user.displayName ?? "그룹장";

        batch.set(memberRef, {
          role: "owner",
          uid: user.uid, // [필수] uid 필드를 문서 내부에 추가!
          groupNickname: displayName,
          joinedAt: serverTimestamp(),
          status: "inactive" // 초기 상태
        });

        // 6. Batch 작업 한번에 실행
        await batch.commit();
      }

      Alert.alert("완료", isEditMode ? "수정되었습니다." : "등록되었습니다.", [
        {
          text: "확인",
          onPress: () => {
            router.dismissAll();
            router.push("/(protected)/(tabs)/(group_zone)/group_zone");
          },
        },
      ]);
    } catch (e: any) {
      console.error("저장 중 에러 발생:", e);
      Alert.alert("에러", String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const goToMap = () => {
    const mapParams: Record<string, any> = {
      latitude,
      longitude,
      radius,
      address,
    };
    if (isEditMode && placeId) {
      Object.assign(mapParams, {
        editMode: "true",
        placeId,
        name: groupName, // [수정] groupName 상태를 'name'으로 전달
      });
    }
    router.replace({
      pathname: "/(protected)/(tabs)/(group_zone)/map",
      params: mapParams,
    });
  };

  const onCancel = () =>
    router.replace("/(protected)/(tabs)/(group_zone)/group_zone");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <TouchableOpacity onPress={onCancel} disabled={saving}>
          <Text style={[styles.headerAction, { color: "#EF4444" }]}>취소</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isEditMode ? "그룹장소 수정" : "그룹장소 등록"}
        </Text>
        <TouchableOpacity onPress={onSave} disabled={saving || loadingDoc}>
          <Text
            style={[
              styles.headerAction,
              { color: saving || loadingDoc ? colors.muted : colors.tint },
            ]}
          >
            {saving ? "저장중..." : "저장"}
          </Text>
        </TouchableOpacity>
      </View>

      {loadingDoc ? (
        <View
          style={{
            height: 240,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: colors.muted }]}>
              그룹장소명
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              placeholder="예) 도서관, 스터디카페"
              placeholderTextColor={colors.muted}
              value={groupName}
              onChangeText={setGroupName}
            />
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: colors.muted }]}>위치</Text>
            <TouchableOpacity
              style={[styles.rowBtn, { backgroundColor: colors.background }]}
              activeOpacity={0.8}
              onPress={goToMap}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.tint} />
              <Text style={[styles.rowBtnText, { color: colors.text }]}>
                {address || "주소를 선택하세요"}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: colors.muted }]}>반지름</Text>
            <Text style={[styles.rowBtnText, { color: colors.text }]}>
              {radius}m
            </Text>
          </View>
          {/* [추가] 차단 정책 선택 UI */}
          <View style={styles.card}>
            <Text style={styles.label}>앱 차단 정책</Text>
            <View style={styles.policyRow}>
              <TouchableOpacity
                style={[
                  styles.policyChip,
                  blockingPolicy === "MEMBERS_ONLY" && styles.policyChipActive,
                ]}
                onPress={() => setBlockingPolicy("MEMBERS_ONLY")}
              >
                <Text
                  style={[
                    styles.policyText,
                    blockingPolicy === "MEMBERS_ONLY" &&
                    styles.policyTextActive,
                  ]}
                >
                  지배형 (그룹원만 차단)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.policyChip,
                  blockingPolicy === "ALL_PARTICIPANTS" &&
                  styles.policyChipActive,
                ]}
                onPress={() => setBlockingPolicy("ALL_PARTICIPANTS")}
              >
                <Text
                  style={[
                    styles.policyText,
                    blockingPolicy === "ALL_PARTICIPANTS" &&
                    styles.policyTextActive,
                  ]}
                >
                  솔선수범형 (모두 차단)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: colors.muted }]}>
              차단할 앱
            </Text>
            <TouchableOpacity
              style={[styles.rowBtn, { backgroundColor: colors.background }]}
              activeOpacity={0.8}
            >
              <Ionicons name="grid-outline" size={18} color={colors.tint} />
              <Text style={[styles.rowBtnText, { color: colors.text }]}>
                앱 목록{" "}
                <Text style={{ color: colors.tint, fontWeight: "bold" }}>
                  {appsBlockedCount}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* 요일 선택 */}
          <Text
            style={{
              fontSize: 14,
              color: colors.text,
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            요일 선택
          </Text>
          <View style={styles.daysRow}>
            {DAYS.map((label, idx) => {
              const active = selectedDays.includes(idx);
              const chipBorder = active ? colors.tint : colors.border;
              const chipBg = active
                ? theme === "dark"
                  ? "rgba(37,99,235,0.25)"
                  : "rgba(37,99,235,0.20)"
                : theme === "dark"
                  ? "rgba(120,120,120,0.25)"
                  : "rgba(209,213,219,0.35)";
              const chipText = active ? colors.tint : colors.muted;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleDay(idx)}
                  style={[
                    styles.dayChip,
                    { borderColor: chipBorder, backgroundColor: chipBg },
                  ]}
                >
                  <Text style={[styles.dayText, { color: chipText }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerAction: { fontSize: 15, fontWeight: "600" },
  card: { borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  label: { fontSize: 13, marginBottom: 8 },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  rowBtn: {
    height: 44,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  rowBtnText: { marginLeft: 8, fontSize: 15 },
  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    marginRight: -8,
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  dayText: { fontWeight: "700" },
  // [추가] 정책 선택 UI
  policyRow: {
    flexDirection: "row",
  },
  policyChip: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
  },
  policyChipActive: {
    borderColor: "#2563EB",
    backgroundColor: "#DBEAFE",
  },
  policyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  policyTextActive: {
    color: "#1E40AF",
  },
  // [추가] 칩 간격
  "policyChip:first-child": {
    marginRight: 8,
  },
});
