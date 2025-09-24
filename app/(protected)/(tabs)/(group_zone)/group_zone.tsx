// app/(protected)/(tabs)/group_zone.tsx
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../../../firebaseConfig";
import { createGroup } from "../../../../src/services/group/createGroup";
import type { Group } from "../../../../src/services/group/getGroup";

export default function GroupZone() {
  const [loading, setLoading] = useState(true); // 목록 로딩
  const [creating, setCreating] = useState(false); // 생성 중
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState("");

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list: Group[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Group, "id">),
      }));
      setGroups(list);
    } catch (err: any) {
      console.error("그룹 목록 불러오기 오류:", err?.code, err?.message ?? err);
      Alert.alert(
        "오류",
        `그룹 목록을 불러오지 못했습니다.\n${err?.message ?? err}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) {
      Alert.alert("입력 필요", "그룹 이름을 입력해 주세요.");
      return;
    }
    try {
      setCreating(true);
      const id = await createGroup(name); // 중복 검사 포함
      setNewGroupName(""); // ✅ 입력칸 초기화
      await fetchGroups(); // ✅ 목록 갱신
      Alert.alert("완료", `그룹이 생성되었습니다.\nID: ${id}`); // ✅ 성공 안내
    } catch (err: any) {
      Alert.alert("오류", err?.message ?? "그룹 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }, [newGroupName, fetchGroups]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>그룹 정보를 불러오는 중...</Text>
      </View>
    );
  }

  const disabled = creating || !newGroupName.trim();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>그룹장소 페이지</Text>

      {/* 그룹 생성 UI */}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="새 그룹 이름"
          value={newGroupName}
          onChangeText={setNewGroupName}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => !disabled && handleCreateGroup()}
        />
        <TouchableOpacity
          onPress={handleCreateGroup}
          disabled={disabled}
          style={[styles.button, disabled && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>
            {creating ? "생성중..." : "생성"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 그룹 목록 */}
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.groupItem}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupMeta}>
              멤버: {item.memberCount} | 오너: {item.ownerId}
            </Text>
            <Text style={styles.groupMetaSmall}>ID: {item.id}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>생성된 그룹이 없습니다.</Text>}
        contentContainerStyle={
          groups.length === 0 && {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  row: { flexDirection: "row", marginBottom: 16, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonDisabled: { backgroundColor: "#9e9e9e" },
  buttonText: { color: "white", fontWeight: "700" },
  groupItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  groupName: { fontSize: 16, fontWeight: "600" },
  groupMeta: { fontSize: 12, color: "#666" },
  groupMetaSmall: { fontSize: 11, color: "#999" },
});
