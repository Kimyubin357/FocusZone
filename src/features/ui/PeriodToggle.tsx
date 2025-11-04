// [STATS] NEW FILE: src/features/stats/ui/PeriodToggle.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Granularity } from "../../features/stats/types";

export default function PeriodToggle({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (g: Granularity) => void;
}) {
  const items: { key: Granularity; label: string }[] = [
    { key: "day", label: "일" },
    { key: "week", label: "주" },
    { key: "month", label: "월" },
  ];
  return (
    <View style={styles.wrap}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={[styles.btn, active && styles.btnActive]}
          >
            <Text style={[styles.txt, active && styles.txtActive]}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 10 },
  btn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  btnActive: {
    backgroundColor: "#111827",
    borderRadius: 10,
  },
  txt: { color: "#6B7280", fontWeight: "700" },
  txtActive: { color: "white" },
});
