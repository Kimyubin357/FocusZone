// [STATS] NEW FILE: src/services/features/stats/dev/StorageInspector.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function StorageInspector({
  userId,
  placeId,
}: {
  userId: string;
  placeId?: string;
}) {
  const [keys, setKeys] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      const all = await AsyncStorage.getAllKeys();
      const filtered = all.filter(
        (k) =>
          k.startsWith(`currentSessions:${userId}`) ||
          (placeId && k.startsWith(`stats:${userId}:${placeId}:`))
      );
      setKeys(filtered.sort());
    })();
  }, [userId, placeId, refresh]);

  if (!__DEV__) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>저장 점검(DEV)</Text>
        <Pressable onPress={() => setRefresh((v) => v + 1)} style={styles.btn}>
          <Text style={styles.btnTxt}>새로고침</Text>
        </Pressable>
      </View>
      {keys.map((k) => (
        <Text key={k} style={styles.key}>
          {k}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 8,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  title: { fontWeight: "700", color: "#111827" },
  btn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#111827",
    borderRadius: 6,
  },
  btnTxt: { color: "white", fontWeight: "700" },
  key: { color: "#6B7280", fontSize: 12, marginTop: 2 },
});
