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
// [STATS][ADDED] 완료 세션(오늘) 재합산을 위해 toYMD 사용
import { fmtHm, toYMD } from "../../../../src/services/lib/time";

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

// [STATS][ADDED] 시간 시작/끝 유틸 (현재 시각 막대 라이브 반영용)
function startOfHour(date: Date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}
function endOfHour(date: Date) {
  const d = new Date(date);
  d.setMinutes(59, 59, 999);
  return d.getTime();
}

/**
 * [STATS][ADDED] 오늘(일 단위) 진행 중 세션의 실시간 ms 합계
 * - currentSessions:<userId> 를 1초마다 읽어서 합산
 * - anchor가 '오늘' & granularity==='day' 일 때만 동작
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

      tick(); // 즉시 1회
      timer = setInterval(tick, 1000); // 1초마다 라이브 갱신

      return () => {
        mounted = false;
        if (timer) clearInterval(timer);
      };
    }, [userId, anchor, granularity])
  );

  return liveMs;
}

/**
 * [STATS][ADDED] 오늘(일 단위) '완료된 세션' 총합(ms) 1초 재계산
 * - 이탈/비활성 직후에도 총합이 즉시 반영되도록 화면이 직접 폴링
 */
function useFinishedTodayMs(
  userId: string,
  anchor: Date,
  granularity: Granularity
) {
  const [ms, setMs] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      let timer: any;

      const load = async () => {
        if (!(granularity === "day" && sameYmd(anchor, new Date()))) {
          if (mounted) setMs(0);
          return;
        }

        try {
          const ymd = toYMD(anchor);
          const allKeys = await AsyncStorage.getAllKeys();
          const prefix = `stats:${userId}:`;
          const targetKeys = allKeys.filter(
            (k) => k.startsWith(prefix) && k.endsWith(`:${ymd}`)
          );

          if (targetKeys.length === 0) {
            if (mounted) setMs(0);
            return;
          }

          const pairs = await AsyncStorage.multiGet(targetKeys);
          let sum = 0;
          for (const [, raw] of pairs) {
            if (!raw) continue;
            try {
              const rows: {
                startedAt: number;
                endedAt: number;
                durationMs?: number;
              }[] = JSON.parse(raw);
              for (const r of rows) {
                sum +=
                  r.durationMs ??
                  Math.max(0, (r.endedAt ?? 0) - (r.startedAt ?? 0));
              }
            } catch {
              // ignore
            }
          }
          if (mounted) setMs(sum);
        } catch {
          if (mounted) setMs(0);
        }
      };

      load(); // 즉시 1회
      timer = setInterval(load, 1000); // 1초마다 완료 누적 재계산

      return () => {
        mounted = false;
        if (timer) clearInterval(timer);
      };
    }, [userId, anchor, granularity])
  );

  return ms;
}

/**
 * [STATS][ADDED] 오늘(일 단위) '완료된 세션'을 24시간(0~23시) 분 단위로 누적
 * - 활성 꺼져도 막대가 사라지지 않게, 1초마다 시간별로 재집계
 * - 각 시간은 0~60분으로 캡
 */
function useFinishedTodayMinutesByHour(
  userId: string,
  anchor: Date,
  granularity: Granularity
) {
  const [minsByHour, setMinsByHour] = useState<number[]>(new Array(24).fill(0));

  const hourEnd = (d: Date) => {
    const x = new Date(d);
    x.setMinutes(59, 59, 999);
    return x.getTime();
  };

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      let timer: any;

      const load = async () => {
        if (!(granularity === "day" && sameYmd(anchor, new Date()))) {
          if (mounted) setMinsByHour(new Array(24).fill(0));
          return;
        }

        try {
          const ymd = toYMD(anchor);
          const allKeys = await AsyncStorage.getAllKeys();
          const prefix = `stats:${userId}:`;
          const targetKeys = allKeys.filter(
            (k) => k.startsWith(prefix) && k.endsWith(`:${ymd}`)
          );

          const msByHour = new Array<number>(24).fill(0);

          if (targetKeys.length) {
            const pairs = await AsyncStorage.multiGet(targetKeys);

            const day0 = new Date(`${ymd}T00:00:00`).getTime();
            const dayEnd = day0 + 24 * 3600 * 1000 - 1;

            for (const [, raw] of pairs) {
              if (!raw) continue;
              let rows:
                | { startedAt: number; endedAt: number; durationMs?: number }[]
                | [] = [];
              try {
                rows = JSON.parse(raw) || [];
              } catch {
                // ignore
              }
              for (const r of rows) {
                const s = Math.max(day0, r.startedAt ?? day0);
                const e = Math.min(dayEnd, r.endedAt ?? day0);
                if (!(e > s)) continue;

                let cursor = s;
                while (cursor <= e) {
                  const h = new Date(cursor).getHours();
                  const segEnd = Math.min(e, hourEnd(new Date(cursor)));
                  const delta = Math.max(0, segEnd - cursor + 1);
                  msByHour[h] += delta;
                  cursor = segEnd + 1;
                }
              }
            }
          }

          const mins = msByHour.map((v) =>
            Math.max(0, Math.min(60, Math.floor(v / 60000)))
          );

          if (mounted) setMinsByHour(mins);
        } catch {
          if (mounted) setMinsByHour(new Array(24).fill(0));
        }
      };

      load();
      timer = setInterval(load, 1000);

      return () => {
        mounted = false;
        if (timer) clearInterval(timer);
      };
    }, [userId, anchor, granularity])
  );

  return minsByHour; // 길이 24, 각 인덱스=해당 시각의 '완료 분'
}

/**
 * [STATS][ADDED] 오늘·일(day) 화면에서 "현재 시각의 막대"에 라이브 분(min) 얹기
 * - 매 1초 currentSessions를 읽어서 현재 시각(hour)에 해당하는 진행 중 분을 계산
 * - 반환: 길이 24 배열(해당 시간 인덱스에만 값, 나머지는 0)
 */
function useLiveMinutesForCurrentHour(
  userId: string,
  anchor: Date,
  granularity: Granularity
) {
  const [liveMinByHour, setLiveMinByHour] = React.useState<number[]>(
    new Array(24).fill(0)
  );

  const isTodayDayView = granularity === "day" && sameYmd(anchor, new Date());

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      let timer: any;

      const poll = async () => {
        if (!isTodayDayView) {
          if (mounted) setLiveMinByHour(new Array(24).fill(0));
          return;
        }
        try {
          const raw = await AsyncStorage.getItem(`currentSessions:${userId}`);
          const sessions: { placeId: string; startedAt: number }[] = raw
            ? JSON.parse(raw)
            : [];

          const now = new Date();
          const hourIdx = now.getHours();
          const soh = startOfHour(now);
          const eoh = endOfHour(now);
          const nowTs = now.getTime();

          // 현재 시간대 내 진행 중 합산
          let liveMs = 0;
          for (const s of sessions) {
            const started = Math.max(s.startedAt ?? nowTs, soh);
            const ended = Math.min(nowTs, eoh);
            const delta = Math.max(0, ended - started);
            liveMs += delta;
          }
          const liveMin = Math.min(60, Math.floor(liveMs / 60000));

          if (mounted) {
            const next = new Array(24).fill(0);
            next[hourIdx] = liveMin; // 현재 시각에만 반영
            setLiveMinByHour(next);
          }
        } catch {
          if (mounted) setLiveMinByHour(new Array(24).fill(0));
        }
      };

      // 즉시 1회 + 1초마다 새로 계산
      poll();
      timer = setInterval(poll, 1000);

      return () => {
        mounted = false;
        if (timer) clearInterval(timer);
      };
    }, [userId, anchor, granularity, isTodayDayView])
  );

  return liveMinByHour; // 길이 24, 현재 시각 인덱스에만 min 값
}

/** [STATS][MODIFIED] 세로형 시간별 막대그래프 (0~23시, 각 시간 0~60분 비율로 채움) */
function DayHourBars({ minutesByHour }: { minutesByHour: number[] }) {
  return (
    <View style={{ marginTop: 20, alignItems: "center" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          width: "100%",
          height: 160, // 60분 = 100%
        }}
      >
        {Array.from({ length: 24 }).map((_, h) => {
          const min = Math.max(0, Math.min(60, minutesByHour[h] || 0));
          const pct = (min / 60) * 100;

          return (
            <View
              key={`hour-${h}`}
              style={{ alignItems: "center", flex: 1, marginHorizontal: 2 }}
            >
              <View
                style={{
                  width: 10,
                  height: `${pct}%`,
                  backgroundColor: "#10B981",
                  borderRadius: 3,
                }}
              />
              <Text style={{ marginTop: 4, fontSize: 9, color: "#6B7280" }}>
                {h}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function Stats() {
  const userId = "local";

  // 장소 집계는 전체("__all__") 유지 (특정 place 보기 기능이 있으면 prop/상태로 연결)
  const [placeId] = useState<string | undefined>(undefined);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [anchor, setAnchor] = useState(new Date());

  const stats = useStats({
    userId,
    placeId: "__all__",
    anchor,
    granularity,
  });

  // [STATS][ADDED] 오늘-일 화면일 때 진행 중/완료 누적을 화면에서 직접 합산
  const liveTodayMs = useLiveTodayMs(userId, anchor, granularity);
  const finishedTodayMs = useFinishedTodayMs(userId, anchor, granularity);

  // [STATS][MODIFIED] Day&오늘: (완료 누적 + 라이브), 그 외: 기존 합계
  const displayTotalMs =
    granularity === "day" && sameYmd(anchor, new Date())
      ? (finishedTodayMs || 0) + (liveTodayMs || 0)
      : stats?.totalMs ?? 0;

  const title = useMemo(
    () =>
      granularity === "day"
        ? "총 집중 시간"
        : granularity === "week"
        ? "주간 총 집중"
        : "월간 총 집중",
    [granularity]
  );

  // [STATS][MODIFIED] 일=HH:mm:ss, 주/월=HH:mm
  const formattedTotal =
    granularity === "day" ? fmtHms(displayTotalMs) : fmtHm(displayTotalMs);

  // [STATS][ADDED] 시간별 막대 데이터 구성
  // - 오늘·일: '완료분 시간별' + '현재 시각 라이브분' 합성(0~60 캡)
  // - 과거·주·월: useStats.timeline24(완료분) 기반으로만 표시
  const finishedByHourMinToday = useFinishedTodayMinutesByHour(
    userId,
    anchor,
    granularity
  );
  const liveMinByHour = useLiveMinutesForCurrentHour(
    userId,
    anchor,
    granularity
  );

  const minutesByHour =
    granularity === "day" && sameYmd(anchor, new Date())
      ? finishedByHourMinToday.map((m, i) =>
          Math.min(60, m + (liveMinByHour[i] || 0))
        )
      : (stats as any).timeline24
      ? (stats as any).timeline24.map((ms: number) =>
          Math.max(0, Math.min(60, Math.floor(ms / 60000)))
        )
      : new Array(24).fill(0);

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
          {/* [STATS][KEPT] 현재 체류중 표시 배지 (전체 집계면 자연스레 미표시) */}
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
              {/* [STATS][MODIFIED] 일 화면에서는 HH:mm:ss 실시간 증가 */}
              <Text style={styles.summaryValue}>{formattedTotal}</Text>

              {/* 보조 문구(‘+ 진행 중’) 제거 요구 반영 */}
              {granularity === "week" &&
                stats.activeDaysCount !== undefined && (
                  <Text style={styles.sub}>
                    참가일 {stats.activeDaysCount} / 7일
                  </Text>
                )}
            </View>

            {/* [STATS][ADDED] 시간별 막대 그래프 */}
            {granularity === "day" && (
              <DayHourBars minutesByHour={minutesByHour} />
            )}

            {/* 기존 그래프(원하면 제거 가능) */}
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
 * - 전체 집계("__all__")인 지금 화면 상태에선 보통 숨김
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
    }, [placeId, userId])
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
