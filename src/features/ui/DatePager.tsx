// [STATS] NEW FILE: src/features/stats/ui/DatePager.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Granularity } from "../../features/stats/types";

const ORD = ["첫째주", "둘째주", "셋째주", "넷째주", "다섯째주"];

function startOfWeekSun(date: Date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=일
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekOfMonthLabel(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0~11
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekStart = startOfWeekSun(firstOfMonth); // 해당 달 '첫 일요일'이 포함된 주 시작
  const thisWeekStart = startOfWeekSun(date);
  const diffDays =
    (thisWeekStart.getTime() - firstWeekStart.getTime()) /
    (1000 * 60 * 60 * 24);
  const idx = Math.floor(diffDays / 7); // 0-based
  const ord = ORD[Math.min(ORD.length - 1, Math.max(0, idx))];
  return `${year}.${String(month + 1).padStart(2, "0")} ${ord}`;
}

function formatTitle(d: Date, g: Granularity) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (g === "day") return `${y}.${m}.${dd}`;
  if (g === "week") return weekOfMonthLabel(d); // ✅ 주간은 'YYYY.MM N째주'
  return `${y}.${m}`;
}

export default function DatePager({
  anchor,
  granularity,
  onChange,
  onToday,
}: {
  anchor: Date;
  granularity: Granularity;
  onChange: (d: Date) => void;
  onToday?: () => void;
}) {
  const move = (delta: number) => {
    const d = new Date(anchor);
    if (granularity === "day") d.setDate(d.getDate() + delta);
    else if (granularity === "week") d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    onChange(d);
  };
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => move(-1)} style={styles.nav}>
        <Text style={styles.navTxt}>◀︎</Text>
      </Pressable>
      <Pressable onPress={onToday} style={styles.titleWrap}>
        <Text style={styles.title}>{formatTitle(anchor, granularity)}</Text>
      </Pressable>
      <Pressable onPress={() => move(1)} style={styles.nav}>
        <Text style={styles.navTxt}>▶︎</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nav: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  navTxt: { fontWeight: "700", color: "#111827" },
  titleWrap: { padding: 6 },
  title: { fontSize: 16, fontWeight: "800", color: "#111827" },
});
