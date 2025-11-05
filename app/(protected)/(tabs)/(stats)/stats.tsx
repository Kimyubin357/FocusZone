// [STATS] UPDATED: 통계 화면 (스크롤 가능 + 라이브 타이머 유지)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import StorageInspector from "../../../../src/features/stats/dev/StorageInspector";
import type { Granularity } from "../../../../src/features/stats/types";
import { useStats } from "../../../../src/features/stats/useStats";
import DatePager from "../../../../src/features/ui/DatePager";
import PeriodToggle from "../../../../src/features/ui/PeriodToggle";
import PlaceSelector from "../../../../src/features/ui/PlaceSelector";
import { fmtHm } from "../../../../src/services/lib/time";

/** HH:mm:ss */
function fmtHms(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

/** 현재 장소에 체류 중이면 진입/지속시간 표시 */
function LiveNowBadge({
  userId,
  placeId,
}: {
  userId: string;
  placeId?: string;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const load = async () => {
    try {
      if (!placeId) {
        setStartedAt(null);
        return;
      }
      const raw = await AsyncStorage.getItem(`currentSessions:${userId}`);
      const rows: { placeId: string; startedAt: number }[] = raw
        ? JSON.parse(raw)
        : [];
      const row = rows?.find((r) => r.placeId === placeId);
      setStartedAt(row ? row.startedAt : null);
    } catch {
      setStartedAt(null);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      load();
      return () => {};
    }, [placeId])
  );
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!placeId || !startedAt) return null;

  const enter = new Date(startedAt);
  const hh = String(enter.getHours()).padStart(2, "0");
  const mm = String(enter.getMinutes()).padStart(2, "0");
  const dur = now - startedAt;

  return (
    <View style={styles.liveWrap}>
      <View style={styles.liveDot} />
      <Text style={styles.liveTitle}>
        진입 {hh}:{mm}
      </Text>
      <View style={{ width: 8 }} />
      <Text style={styles.liveTimer}>{fmtHms(dur)}</Text>
    </View>
  );
}

export default function Stats() {
  const userId = "local";

  const [placeId, setPlaceId] = useState<string | undefined>(undefined);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [anchor, setAnchor] = useState(new Date());

  const stats = useStats({
    userId,
    placeId: placeId || "__none__",
    anchor,
    granularity,
  });

  const title = useMemo(
    () =>
      granularity === "day"
        ? "총 집중 시간"
        : granularity === "week"
        ? "주간 총 집중"
        : "월간 총 집중",
    [granularity]
  );

  return (
    <View style={styles.container}>
      {/* [STATS] 수정됨: 전체를 ScrollView로 감싸서 세션 로그가 길어도 스크롤 가능 */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <PlaceSelector value={placeId} onChange={setPlaceId} />
          <View style={{ height: 8 }} />
          <PeriodToggle value={granularity} onChange={setGranularity} />
          <View style={{ height: 8 }} />
          <DatePager
            anchor={anchor}
            granularity={granularity}
            onChange={setAnchor}
            onToday={() => setAnchor(new Date())}
          />
          {/* 실시간 배지 + 저장 확인 */}
          <LiveNowBadge userId={userId} placeId={placeId} />
          <StorageInspector userId={userId} placeId={placeId} />
        </View>

        {!placeId ? (
          <View style={styles.center}>
            <Text style={{ color: "#6B7280" }}>집중장소를 선택하세요.</Text>
          </View>
        ) : stats.loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{title}</Text>
              <Text style={styles.summaryValue}>{fmtHm(stats.totalMs)}</Text>
              {granularity === "week" &&
                stats.activeDaysCount !== undefined && (
                  <Text style={styles.sub}>
                    참가일 {stats.activeDaysCount} / 7일
                  </Text>
                )}
            </View>

            {granularity === "day" && stats.timeline24 && (
              <DayTimeline hours={stats.timeline24} />
            )}
            {granularity === "week" && stats.weekBars && (
              <WeekBars values={stats.weekBars} />
            )}
            {granularity === "month" && stats.monthGrid && (
              <MonthGrid days={stats.monthGrid} />
            )}

            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>진입 & 이탈 시간</Text>
              <FlatList
                data={stats.sessions.sort((a, b) => a.startedAt - b.startedAt)}
                keyExtractor={(it) => it.id}
                renderItem={({ item }) => (
                  <View style={styles.sessionRow}>
                    <Text style={styles.sessionText}>
                      {toHm(item.startedAt)} ~ {toHm(item.endedAt)}
                    </Text>
                    <Text style={[styles.sessionText, { color: "#2563EB" }]}>
                      {fmtHm(item.durationMs)}
                    </Text>
                  </View>
                )}
                // [STATS] 수정됨: 스크롤은 상위 ScrollView가 담당 → 내부 리스트 스크롤 끔
                scrollEnabled={false}
                ListEmptyComponent={
                  <Text style={{ color: "#9CA3AF", marginTop: 6 }}>
                    기록이 없습니다.
                  </Text>
                }
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* 간단 시각화 */
function DayTimeline({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.sectionTitle}>체류 타임라인</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {hours.map((v, i) => (
          <View key={i} style={{ alignItems: "center", flex: 1 }}>
            <View
              style={{
                height: Math.max(2, (80 * v) / max),
                width: "70%",
                backgroundColor: "#22C55E",
                borderRadius: 4,
              }}
            />
            {i % 3 === 0 && (
              <Text style={{ fontSize: 10, color: "#6B7280" }}>{i}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
function WeekBars({ values }: { values: number[] }) {
  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  const max = Math.max(1, ...values);
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.sectionTitle}>요일별 집중</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {values.map((v, i) => (
          <View key={i} style={{ alignItems: "center", flex: 1 }}>
            <View
              style={{
                height: Math.max(2, (80 * v) / max),
                width: "60%",
                backgroundColor: "#22C55E",
                borderRadius: 4,
              }}
            />
            <Text style={{ fontSize: 12, color: "#6B7280" }}>{labels[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
function MonthGrid({ days }: { days: { date: string; totalMs: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.totalMs));
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.sectionTitle}>달력</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((d) => (
          <View key={d.date} style={styles.dayCell}>
            <View
              style={{
                flex: 1,
                width: "100%",
                backgroundColor: `rgba(34,197,94,${
                  max > 0 ? 0.15 + 0.85 * (d.totalMs / max) : 0.15
                })`,
                borderRadius: 8,
              }}
            />
            <Text style={styles.dayLabel}>{Number(d.date.split("-")[2])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* 유틸 */
function toHm(ms: number) {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  // [STATS] 수정됨: ScrollView 안쪽 여백/하단 패딩
  scrollContent: { paddingBottom: 40 }, // [STATS] 수정됨
  header: { padding: 16 },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summary: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  summaryTitle: { fontSize: 14, color: "#6B7280" },
  summaryValue: { fontSize: 28, fontWeight: "800", marginTop: 4 },
  sub: { marginTop: 4, color: "#2563EB", fontWeight: "700" },
  sectionTitle: {
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "700",
    color: "#111827",
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  sessionText: { fontSize: 14, color: "#111827" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 4 },
  dayLabel: {
    position: "absolute",
    top: 6,
    left: 8,
    fontSize: 10,
    color: "#111827",
  },

  // 실시간 배지
  liveWrap: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 8,
  },
  liveTitle: { fontSize: 12, color: "#065F46", fontWeight: "700" },
  liveTimer: { fontSize: 12, color: "#065F46", fontWeight: "700" },
});
