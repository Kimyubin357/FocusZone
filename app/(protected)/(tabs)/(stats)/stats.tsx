// [STATS] UPDATED: 일 단위 총 집중 시간 = (기존 하루 총합 + 진행 중 시간) 을 HH:mm:ss로 실시간 표시
// - '+ 00:00:00 진행 중' 보조 문구 제거
// - 주/월 화면은 기존 HH:mm 유지
// - "진입 & 이탈 시간"을 최신순 카드 + 페이지네이션(1 2 3 …)으로 표시
// - "진입 & 이탈 시간" 목록은 1초마다 AsyncStorage를 폴링해 라이브 갱신
// - 카드 점 색상은 전부 초록(#10B981)

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Granularity } from "../../../../src/features/stats/types";
import { useStats } from "../../../../src/features/stats/useStats";
import DatePager from "../../../../src/features/ui/DatePager";
import PeriodToggle from "../../../../src/features/ui/PeriodToggle";
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

// [STATS][ADDED] 시간 시작/끝 유틸
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

/**
 * [STATS][ADDED] 오늘(일 단위) '완료된 세션' 총합(ms) 1초 재계산
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
            } catch {}
          }
          if (mounted) setMs(sum);
        } catch {
          if (mounted) setMs(0);
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

  return ms;
}

/**
 * [STATS][ADDED] 오늘(일 단위) '완료된 세션'을 24시간(0~23시) 분 단위로 누적 (1초 폴링)
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
              } catch {}
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

  return minsByHour;
}

/**
 * [STATS][ADDED] 오늘·일(day) 화면에서 "현재 시각의 막대" 라이브 분(min)
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
            next[hourIdx] = liveMin;
            setLiveMinByHour(next);
          }
        } catch {
          if (mounted) setLiveMinByHour(new Array(24).fill(0));
        }
      };

      poll();
      timer = setInterval(poll, 1000);

      return () => {
        mounted = false;
        if (timer) clearInterval(timer);
      };
    }, [userId, anchor, granularity, isTodayDayView])
  );

  return liveMinByHour;
}

/** [STATS][MODIFIED] 세로형 시간별 막대그래프 */
function DayHourBars({ minutesByHour }: { minutesByHour: number[] }) {
  return (
    <View style={{ marginTop: 20, alignItems: "center" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          width: "100%",
          height: 160,
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

// ──────────────────────────────────────────────────────────────
// [STATS][ADDED] Stay 카드/리스트 + 페이지네이션 + 라이브 데이터
function fmtHHmm(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function fmtKrDuration(ms: number) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `체류 시간 : ${h}시간 ${m}분`;
  if (h > 0) return `체류 시간 : ${h}시간`;
  return `체류 시간 : ${m}분`;
}

/**
 * [STATS][ADDED] 오늘(일 단위) 완료 세션들을 1초마다 읽어오는 훅 (카드 리스트 라이브 갱신용)
 */
function useDaySessionsLive(
  userId: string,
  anchor: Date,
  granularity: Granularity
) {
  const [rows, setRows] = useState<
    { startedAt: number; endedAt: number; durationMs?: number }[]
  >([]);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      let timer: any;

      const load = async () => {
        if (!(granularity === "day")) {
          if (mounted) setRows([]);
          return;
        }
        try {
          const ymd = toYMD(anchor);
          const allKeys = await AsyncStorage.getAllKeys();
          const prefix = `stats:${userId}:`;
          const keys = allKeys.filter(
            (k) => k.startsWith(prefix) && k.endsWith(`:${ymd}`)
          );

          if (keys.length === 0) {
            if (mounted) setRows([]);
            return;
          }

          const pairs = await AsyncStorage.multiGet(keys);
          const out: {
            startedAt: number;
            endedAt: number;
            durationMs?: number;
          }[] = [];
          for (const [, raw] of pairs) {
            if (!raw) continue;
            try {
              const arr = JSON.parse(raw) as {
                startedAt: number;
                endedAt: number;
                durationMs?: number;
              }[];
              if (Array.isArray(arr)) out.push(...arr);
            } catch {}
          }
          if (mounted) setRows(out);
        } catch {
          if (mounted) setRows([]);
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

  return rows; // 완료 세션만 (진행 중은 currentSessions에 있음)
}

function StayCard({
  startedAt,
  endedAt,
  durationMs,
}: {
  startedAt: number;
  endedAt: number;
  durationMs?: number;
}) {
  const dur = durationMs ?? Math.max(0, (endedAt ?? 0) - (startedAt ?? 0));
  return (
    <View style={stayStyles.card}>
      <View style={stayStyles.row}>
        {/* [STATS][MODIFIED] 점 색상 고정 초록 */}
        <View style={[stayStyles.dot, { backgroundColor: "#10B981" }]} />
        <Text style={stayStyles.mainTime}>
          {fmtHHmm(startedAt)} <Text style={stayStyles.arrow}>→</Text>{" "}
          {endedAt ? fmtHHmm(endedAt) : "진행 중"}
        </Text>
      </View>
      <Text style={stayStyles.sub}>{fmtKrDuration(dur)}</Text>
    </View>
  );
}

// [STATS][ADDED] 페이지네이션 있는 리스트 (최신순)
function PaginatedStayList({
  rows,
  pageSize = 5,
}: {
  rows: { startedAt: number; endedAt: number; durationMs?: number }[];
  pageSize?: number;
}) {
  const sorted = useMemo(() => {
    return [...(rows || [])].sort((a, b) => {
      const da = (a.endedAt ?? a.startedAt) || 0;
      const db = (b.endedAt ?? b.startedAt) || 0;
      return db - da; // 최신순
    });
  }, [rows]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPage] = useState(1);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [page, pageSize, sorted]);

  const goPage = (p: number) => {
    const clamped = Math.min(totalPages, Math.max(1, p));
    setPage(clamped);
  };

  if (!rows || rows.length === 0) {
    return (
      <Text style={{ color: "#9CA3AF", marginTop: 6 }}>기록이 없습니다.</Text>
    );
  }

  return (
    <View style={stayStyles.wrap}>
      {pageRows.map((r, idx) => (
        <StayCard
          key={`${r.startedAt}-${r.endedAt}-${idx}`}
          startedAt={r.startedAt}
          endedAt={r.endedAt}
          durationMs={r.durationMs}
        />
      ))}

      <View style={pagerStyles.container}>
        <Pressable
          onPress={() => goPage(page - 1)}
          disabled={page <= 1}
          style={[pagerStyles.navBtn, page <= 1 && pagerStyles.navBtnDisabled]}
        >
          <Text style={pagerStyles.navLabel}>〈</Text>
        </Pressable>

        <View style={pagerStyles.pages}>
          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            const active = p === page;
            return (
              <Pressable
                key={`p-${p}`}
                onPress={() => goPage(p)}
                style={[
                  pagerStyles.pageBtn,
                  active && pagerStyles.pageBtnActive,
                ]}
              >
                <Text
                  style={[
                    pagerStyles.pageLabel,
                    active && pagerStyles.pageLabelActive,
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => goPage(page + 1)}
          disabled={page >= totalPages}
          style={[
            pagerStyles.navBtn,
            page >= totalPages && pagerStyles.navBtnDisabled,
          ]}
        >
          <Text style={pagerStyles.navLabel}>〉</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────

export default function Stats() {
  const userId = "local";

  const [placeId] = useState<string | undefined>(undefined);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [anchor, setAnchor] = useState(new Date());

  const stats = useStats({
    userId,
    placeId: "__all__",
    anchor,
    granularity,
  });

  const liveTodayMs = useLiveTodayMs(userId, anchor, granularity);
  const finishedTodayMs = useFinishedTodayMs(userId, anchor, granularity);

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

  const formattedTotal =
    granularity === "day" ? fmtHms(displayTotalMs) : fmtHm(displayTotalMs);

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

  // [STATS][ADDED] 진입/이탈 카드용 데이터: 오늘-일 화면에선 1초 폴링 훅 사용(라이브), 그 외엔 useStats.sessions 사용
  const dayRowsLive = useDaySessionsLive(userId, anchor, granularity);
  const stayRows =
    granularity === "day" ? dayRowsLive : (stats as any).sessions || [];

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
              <Text style={styles.summaryValue}>{formattedTotal}</Text>

              {granularity === "week" &&
                (stats as any).activeDaysCount !== undefined && (
                  <Text style={styles.sub}>
                    참가일 {(stats as any).activeDaysCount} / 7일
                  </Text>
                )}
            </View>

            {granularity === "day" && (
              <DayHourBars minutesByHour={minutesByHour} />
            )}

            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>진입 & 이탈 시간</Text>
              {/* 최신순 + 페이지네이션 + 라이브 */}
              <PaginatedStayList rows={stayRows} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * [STATS][KEPT] 현재 체류 중인 장소가 있는지 간단히 보여주는 배지
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

const stayStyles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center" },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    backgroundColor: "#10B981", // 초록 고정
  },
  mainTime: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  arrow: { color: "#6B7280" },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
    fontVariant: ["tabular-nums"],
  },
});

const pagerStyles = StyleSheet.create({
  container: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8 as any,
  },
  pages: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6 as any,
    marginHorizontal: 6,
  },
  pageBtn: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  pageBtnActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  pageLabel: {
    fontSize: 12,
    color: "#374151",
  },
  pageLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  navBtn: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navLabel: {
    fontSize: 12,
    color: "#374151",
  },
});
