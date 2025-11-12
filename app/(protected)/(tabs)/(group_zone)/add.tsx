// app/(protected)/(tabs)/(group_zone)/add.tsx — Minimal theming (preserve all UI/logic)
import { Ionicons } from "@expo/vector-icons";

// ⭐️ 1. [추가] useFocusEffect, useIsFocused, useCallback 임포트
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
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
// ⭐️ 2. [추가] React, useCallback 임포트
import { useCallback, useEffect, useState } from "react";

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
  const isFocused = useIsFocused(); // ⭐️ 3. [추가]


  const params = useLocalSearchParams<{

    editMode?: string;

    placeId?: string;

    address?: string;

    latitude?: string;

    longitude?: string;

    radius?: string;

    name?: string;

    updatedCategories?: string; // ⭐️ 카테고리 선택기에서 받을 파라미터

    blockingPolicy?: BlockingPolicy; // ⭐️ 다른 화면 이동 시 유지할 파라미터
    currentCategories?: string; // ⭐️ Map/Categoryselect에서 받은 '현재' 카테고리
  }>();

  const isEditMode = params.editMode === "true";

  const placeId = params.placeId;



  // form states

  const [groupName, setGroupName] = useState(params.name ?? "새로운 그룹장소");

  const [address, setAddress] = useState(params.address ?? "주소를 선택하세요");



  const [latitude, setLatitude] = useState<number | undefined>(

    params.latitude ? Number(params.latitude) : undefined

  );

  const [longitude, setLongitude] = useState<number | undefined>(

    params.longitude ? Number(params.longitude) : undefined

  );

  const [radius, setRadius] = useState<number | undefined>(

    params.radius ? Number(params.radius) : undefined

  );

  // ⭐️ 4. [수정] useState가 params를 읽도록 수정
  const [blockingPolicy, setBlockingPolicy] = useState<BlockingPolicy>(
    params.blockingPolicy ?? "MEMBERS_ONLY"
  );
  const [blockedAppCategories, setBlockedAppCategories] = useState<string[]>(
    () => {
      try {
        // 1. 카테고리 선택기에서 방금 돌아온 값 (최우선)
        if (params.updatedCategories) {
          return JSON.parse(params.updatedCategories);
        }
        // 2. Map 등을 거쳐서 돌아온 '현재' 값
        if (params.currentCategories) {
          return JSON.parse(params.currentCategories);
        }
      } catch (e) { }
      return []; // 기본값 (DB 로드 전)
    }
  );

  // ui states

  const [loadingDoc, setLoadingDoc] = useState<boolean>(isEditMode); // 수정모드면 처음에 로딩

  const [saving, setSaving] = useState<boolean>(false);

  // 수정 모드일 때 기존 문서 불러오기

  // ⭐️ 5. [수정] loadDoc이 params를 우선하도록 수정
  useEffect(() => {
    let ignore = false;
    const loadDoc = async () => {
      if (!isEditMode || !placeId) {
        setLoadingDoc(false); // ⭐️ 생성 모드일 때 로딩 중지
        return;
      }

      // ⭐️ !loadingDoc -> loadingDoc (오타 수정)
      if (loadingDoc) { // ⭐️ 첫 로딩 시에만 실행 (true일 때)
        try {
          // setLoadingDoc(true); // 이미 true
          const ref = doc(db, "groupLocations", placeId);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            Alert.alert("알림", "해당 장소를 찾을 수 없습니다.");
            router.replace("/(protected)/(tabs)/(group_zone)/group_zone");
            return;
          }
          if (ignore) return;
          const data = snap.data() as any;

          // ⭐️ params가 DB 데이터보다 우선 (더 최신 상태)
          setGroupName(params.name ?? data.groupName ?? "그룹장소");
          setAddress(params.address ?? data.address ?? "");
          setLatitude(
            params.latitude
              ? Number(params.latitude)
              : typeof data.latitude === "number"
                ? data.latitude
                : undefined
          );
          setLongitude(
            params.longitude
              ? Number(params.longitude)
              : typeof data.longitude === "number"
                ? data.longitude
                : undefined
          );
          setRadius(
            params.radius
              ? Number(params.radius)
              : typeof data.radius === "number"
                ? data.radius
                : undefined
          );
          setBlockingPolicy(
            params.blockingPolicy ?? data.blockingPolicy ?? "MEMBERS_ONLY"
          );

          // ⭐️ [수정] params를 우선으로 카테고리 설정
          const initialCategories =
            params.updatedCategories ? JSON.parse(params.updatedCategories) :
              params.currentCategories ? JSON.parse(params.currentCategories) :
                Array.isArray(data.blockedAppCategories) ? data.blockedAppCategories : [];
          setBlockedAppCategories(initialCategories);

        } catch (e: any) {
          Alert.alert("에러", String(e?.message ?? e));
        } finally {
          setLoadingDoc(false);
        }
      }
    };
    loadDoc();
    return () => {
      ignore = true;
    };
  }, [isEditMode, placeId, loadingDoc]); // ⭐️ loadingDoc 의존성 추가


  // ⭐️ 6. [추가] categoryselect에서 돌아왔을 때 파라미터 처리
  useFocusEffect(
    useCallback(() => {
      if (isFocused && params.updatedCategories) {
        // 1. useState가 이미 params.updatedCategories로 상태를 설정했음

        // 2. 파라미터를 "사용완료" 처리 (중복 실행 방지)
        //    -> updatedCategories를 currentCategories로 "백업"
        router.setParams({
          updatedCategories: undefined,
          currentCategories: params.updatedCategories,
        });
      }
    }, [isFocused, params.updatedCategories, router]) // ⭐️ router 추가
  );


  // 저장(생성/수정 공용)

  const onSave = async () => {

    const user = auth.currentUser;

    if (!user) return Alert.alert("안내", "로그인이 필요합니다.");

    if (!groupName?.trim())

      return Alert.alert("안내", "그룹장소명을 입력해 주세요.");

    if (!address || address === "주소를 선택하세요")

      return Alert.alert("안내", "주소를 선택해 주세요.");

    if (!radius || radius <= 0) {
      return Alert.alert("안내", "지도에서 반지름을 설정해 주세요.");
    }


    setSaving(true);



    try {

      if (isEditMode && placeId) {

        // --- 수정 모드 ---

        const payload = {
          groupName: groupName.trim(),
          address,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          radius: Number(radius),
          updatedAt: serverTimestamp(),
          // [추가] 스키마 필드
          blockingPolicy: blockingPolicy,
          blockedAppCategories: blockedAppCategories,
          isActive: true, //이미 저장해서 등록하면 isActive는 true인데 굳이 수정할 때도 값을 넣어줘야 하나?
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

          radius: Number(radius),

          // [수정] creatorId -> ownerId

          ownerId: user.uid,

          inviteCode: inviteCode,

          memberIds: [user.uid],   // 생성 시 만든 사람 UID 추가

          createdAt: serverTimestamp(),

          updatedAt: serverTimestamp(),

          // [추가] 스키마 필드

          blockingPolicy: blockingPolicy,

          blockedAppCategories: blockedAppCategories,

          isActive: true,
        };

        batch.set(newGroupRef, newGroupPayload);



        // 5. 'members' 서브 컬렉션에 그룹장 정보 저장

        const memberRef = doc(
          db,
          "groupLocations",
          newGroupRef.id,
          "members",
          user.uid // 👈 여기에 uid를 전달
        );

        // (선택) user 프로필에서 displayName 가져오기

        const userProfileSnap = await getDoc(doc(db, "users", user.uid));

        const displayName =
          userProfileSnap.data()?.nickname ?? user.displayName ?? "그룹장";

        batch.set(memberRef, {

          role: "owner",

          uid: user.uid, // [필수] uid 필드를 문서 내부에 추가!

          groupNickname: displayName,

          joinedAt: serverTimestamp(),

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
      // 항상 현재 폼 상태(groupName)를 'name' 키로 전달
      ...params,
      name: groupName,
      radius: radius?.toString(),
      address: address,
      blockingPolicy: blockingPolicy,
      currentCategories: JSON.stringify(blockedAppCategories),
    };

    // 값이 있을 때만 파라미터에 추가 (undefined 방지)

    if (latitude) mapParams.latitude = latitude.toString();

    if (longitude) mapParams.longitude = longitude.toString();

    if (address && address !== "주소를 선택하세요") mapParams.address = address;



    // 수정 모드일 때 ID 등 전달

    if (isEditMode && placeId) {

      mapParams.editMode = "true";

      mapParams.placeId = placeId;

    }

    router.push({

      pathname: "/(protected)/(tabs)/(group_zone)/map",

      params: mapParams,

    });

  };



  const goToCategorySelect = () => {

    // 현재 폼의 모든 상태를 파라미터로 넘겨줍니다.

    // categoryselect에서 "저장"을 누르면 이 파라미터들이 그대로 다시 돌아옵니다.

    router.push({

      pathname: "/(protected)/(tabs)/(group_zone)/categoryselect",

      params: {
        ...params, // ⭐️ 기존 params (placeId, editMode 등)
        // ⭐️ 현재 폼 상태
        name: groupName,
        address: address,
        latitude: latitude?.toString() ?? "",
        longitude: longitude?.toString() ?? "",
        radius: radius?.toString() ?? "",
        blockingPolicy: blockingPolicy,
        // ⭐️ 카테고리 선택기에 현재 선택된 카테고리 목록 전달
        currentCategories: JSON.stringify(blockedAppCategories),
      },

    });

  };



  const onCancel = () =>

    router.replace("/(protected)/(tabs)/(group_zone)/group_zone");



  return (

    <SafeAreaView style={styles.container}>

      <View style={styles.header}>

        <TouchableOpacity onPress={onCancel} disabled={saving}>

          <Text style={[styles.headerAction, styles.cancelText]}>취소</Text>

        </TouchableOpacity>

        <Text style={styles.headerTitle}>

          {isEditMode ? "그룹장소 수정" : "그룹장소 등록"}

        </Text>

        <TouchableOpacity onPress={onSave} disabled={saving || loadingDoc}>
          <Text
            style={[
              styles.headerAction,
              styles.saveText,
              (saving || loadingDoc) && styles.saveTextDisabled,
            ]}
          >
            {saving ? "저장중..." : "저장"}
          </Text>
        </TouchableOpacity>

      </View>



      {loadingDoc ? (

        <View style={styles.loadingContainer}>

          <ActivityIndicator size="large" color="#0D4093" />

        </View>

      ) : (

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          <View style={styles.card}>

            <Text style={styles.label}>

              그룹장소명

            </Text>

            <TextInput

              style={styles.input}

              placeholder="예) 도서관, 스터디카페"

              placeholderTextColor="#9CA3AF"

              value={groupName}

              onChangeText={setGroupName}

            />

          </View>



          <View style={styles.card}>

            <Text style={styles.label}>위치</Text>

            <TouchableOpacity

              style={styles.rowBtn}

              activeOpacity={0.7}

              onPress={goToMap}

            >

              <Ionicons name="navigate-outline" size={20} color="#0D4093" />

              <Text style={styles.rowBtnText}>

                {address || "주소를 선택하세요"}

              </Text>

            </TouchableOpacity>

          </View>



          <View style={styles.card}>

            <Text style={styles.label}>반지름</Text>

            <View style={styles.rowBtn}>
              <Text style={[
                styles.rowBtnText,
                !radius && styles.rowBtnTextDisabled
              ]}>
                {radius ? `${radius}m` : "지도에서 설정하세요"}
              </Text>
            </View>

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

                activeOpacity={0.7}

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

                activeOpacity={0.7}

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

          <View style={styles.card}>

            <Text style={styles.label}>

              차단할 카테고리

            </Text>

            <TouchableOpacity

              style={styles.rowBtn}

              activeOpacity={0.7}

              onPress={goToCategorySelect}

            >

              <Ionicons name="grid-outline" size={20} color="#0D4093" />

              <Text style={styles.rowBtnText}>

                카테고리 선택{" "}

                <Text style={styles.countText}>

                  ({blockedAppCategories.length})

                </Text>

              </Text>

            </TouchableOpacity>

          </View>
        </ScrollView>

      )}

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  headerAction: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 50,
    textAlign: "center",
  },

  cancelText: {
    color: "#EF4444",
  },

  saveText: {
    color: "#0D4093",
  },

  saveTextDisabled: {
    color: "#9CA3AF",
  },

  loadingContainer: {
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  label: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 10,
    fontWeight: "500",
  },

  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    color: "#111827",
    fontSize: 16,
  },

  rowBtn: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  rowBtnText: {
    marginLeft: 12,
    color: "#111827",
    fontSize: 16,
    flex: 1,
  },

  rowBtnTextDisabled: {
    color: "#9CA3AF",
  },

  countText: {
    color: "#0D4093",
    fontWeight: "700",
  },

  // [추가] 정책 선택 UI

  policyRow: {
    flexDirection: "row",
    gap: 12,
  },

  policyChip: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  policyChipActive: {
    borderColor: "#0D4093",
    backgroundColor: "rgba(13, 64, 147, 0.08)",
  },

  policyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },

  policyTextActive: {
    color: "#0D4093",
    fontWeight: "700",
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

});