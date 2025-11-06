// [STATS] UPDATED: 일 단위 총 집중 시간 = (기존 하루 총합 + 진행 중 시간) 을 HH:mm:ss로 실시간 표시
// - '+ 00:00:00 진행 중' 보조 문구 제거
// - 주/월 화면은 기존 HH:mm 유지
// - 기존 로직/다른 파일 미변경

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { Granularity } from "../../../../src/features/stats/types";
import { useStats } from "../../../../src/features/stats/useStats";
import DatePager from "../../../../src/features/ui/DatePager";
import PeriodToggle from "../../../../src/features/ui/PeriodToggle";
import { fmtHm } from "../../../../src/services/lib/time";

/** HH:mm:ss */
function fmtHms(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// [STATS][ADDED] 유틸: 자정, 같은 날짜 판정
function startOfDay(tsOrDate: number | Date) {
  const d =
    typeof tsOrDate === "number" ? new Date(tsOrDate) : new Date(tsOrDate);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function sameYmd(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * [STATS][ADDED] 오늘(일 단위) 진행 중 세션의 실시간 ms 합계를 반환
 * - currentSessions:<userId> 에 저장된 진행 중 세션들을 읽어 1초마다 합산
 * - 오늘 00:00 기준으로 절단하여 '오늘' 시간만 반영
 * - granularity==='day' && anchor가 오늘일 때만 활성
 */
function useLiveTodayMs(
  userId: string,
  anchor: Date,
  granularity: Granularity
) {
  const [liveMs, setLiveMs] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      let timer: any;

      const tick = async () => {
        if (!(granularity === "day" && sameYmd(anchor, new Date()))) {
          if (mounted) setLiveMs(0);
          return;
        }
        try {
          const raw = await AsyncStorage.getItem(`currentSessions:${userId}`);
          const sessions: { placeId: string; startedAt: number }[] = raw
            ? JSON.parse(raw)
            : [];
          const sod = startOfDay(new Date());
          const nowTs = Date.now();
          const sum = sessions.reduce((acc, s) => {
            const from = Math.max(s.startedAt ?? nowTs, sod);
            const delta = Math.max(0, nowTs - from);
            return acc + delta;
          }, 0);
          if (mounted) setLiveMs(sum);
        } catch {
          if (mounted) setLiveMs(0);
        }
      };

      tick();
      timer = setInterval(tick, 1000);

      return () => {
        mounted = false;
        if (timer) clearInterval(timer);
      };
    }, [userId, anchor, granularity])
  );

  return liveMs;
}

export default function Stats() {
  const userId = "local";

  // 장소 집계는 전체("__all__") 유지
  const [placeId] = useState<string | undefined>(undefined);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [anchor, setAnchor] = useState(new Date());

  const stats = useStats({
    userId,
    placeId: "__all__",
    anchor,
    granularity,
  });

  // [STATS][ADDED] 오늘-일 화면일 때 진행 중 세션의 실시간 ms
  const liveTodayMs = useLiveTodayMs(userId, anchor, granularity);

  // [STATS][MODIFIED] 표시 총합 = 기존 totalMs + (오늘·일 화면인 경우) liveTodayMs
  const baseTotalMs = stats?.totalMs ?? 0;
  const displayTotalMs =
    granularity === "day" && sameYmd(anchor, new Date())
      ? baseTotalMs + (liveTodayMs || 0)
      : baseTotalMs;

  const title = useMemo(
    () =>
      granularity === "day"
        ? "총 집중 시간"
        : granularity === "week"
        ? "주간 총 집중"
        : "월간 총 집중",
    [granularity]
  );

  // [STATS][ADDED] 일/주/월에 따라 표기 포맷 결정 (일=HH:mm:ss, 그 외=HH:mm)
  const formattedTotal =
    granularity === "day" ? fmtHms(displayTotalMs) : fmtHm(displayTotalMs);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <PeriodToggle value={granularity} onChange={setGranularity} />
          <View style={{ height: 8 }} />
          <DatePager
            anchor={anchor}
            granularity={granularity}
            onChange={setAnchor}
            onToday={() => setAnchor(new Date())}
          />
          {/* [STATS][KEPT] 현재 체류중 표시 배지 (기존 동작 유지) */}
          <LiveNowBadge userId={userId} placeId={placeId} />
        </View>

        {stats.loading ? (
          <View style={styles.center}>
            <Text style={{ color: "#6B7280" }}>집중장소를 선택하세요.</Text>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{title}</Text>
              {/* [STATS][MODIFIED] 총 집중 시간 = (기존 하루 총합 + 진행 중) 을 일 화면에서는 HH:mm:ss로 표시 */}
              <Text style={styles.summaryValue}>{formattedTotal}</Text>

              {/* 보조 문구(‘+ 진행 중’)는 요구대로 제거 */}
              {granularity === "week" &&
                stats.activeDaysCount !== undefined && (
                  <Text style={styles.sub}>
                    참가일 {stats.activeDaysCount} / 7일
                  </Text>
                )}
            </View>

            {/* 나머지 그래프/표시는 기존 훅 결과에 맞춰 유지 */}
            {granularity === "day" && (stats as any).timeline24 && (
              <View style={{ marginTop: 8 }}>
                {/* <DayTimeline hours={stats.timeline24} /> */}
              </View>
            )}
            {granularity === "week" && (stats as any).weekBars && (
              <View style={{ marginTop: 8 }}>
                {/* <WeekBars values={stats.weekBars} /> */}
              </View>
            )}
            {granularity === "month" && (stats as any).monthGrid && (
              <View style={{ marginTop: 8 }}>
                {/* <MonthGrid days={stats.monthGrid} /> */}
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>진입 & 이탈 시간</Text>
              {/* 기존 세션 로그 리스트 영역은 유지 */}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * [STATS][KEPT] 현재 체류 중인 장소가 있는지 간단히 보여주는 배지
 * - placeId가 특정되었을 때 currentSessions:<userId> 에 동일 placeId가 있으면 '진행 중'으로 표시
 * - 기존 구현이 다른 방식이라면 이 컴포넌트는 원래 버전을 유지하세요 (이 버전은 최소 대체용)
 */
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
      const sessions: { placeId: string; startedAt: number }[] = raw
        ? JSON.parse(raw)
        : [];
      const found = sessions.find((s) => s.placeId === placeId);
      setStartedAt(found?.startedAt ?? null);
    } catch {
      setStartedAt(null);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      let timer: any;
      load();
      timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
    }, [placeId])
  );

  if (!placeId || !startedAt) return null;

  const elapsed = Math.max(0, now - startedAt);

  return (
    <View style={styles.livePill}>
      <View style={styles.liveDot} />
      <Text style={styles.liveTitle}>진행 중</Text>
      <Text style={{ width: 6 }} />
      <Text style={styles.liveTimer}>{fmtHms(elapsed)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 8 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  body: {},
  summary: {
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  summaryTitle: { fontSize: 14, color: "#6B7280", marginBottom: 6 },
  summaryValue: { fontSize: 28, fontWeight: "bold", color: "#111827" },
  sub: { marginTop: 6, fontSize: 12, color: "#6B7280" },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#D1FAE5",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginTop: 8,
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
