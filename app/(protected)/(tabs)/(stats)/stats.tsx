// [STATS] FINAL
// - Day: 실시간 총합(HH:mm:ss), 시간별 세로 막대, '진입&이탈 시간' 카드(해당 날짜), '오늘로 가기' 버튼
// - Week: 실시간 총합(HH:mm), 'YYYY.MM N째주' 라벨, 요일 세로 막대, '이번 주로' 버튼, 진입&이탈 섹션 숨김
// - Month: 총합(HH:mm), '이번 달로' 버튼, 진입&이탈 섹션 숨김

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Granularity } from "../../../../src/features/stats/types";
import { useStats } from "../../../../src/features/stats/useStats";
import DatePager from "../../../../src/features/ui/DatePager";
import PeriodToggle from "../../../../src/features/ui/PeriodToggle";
import { fmtHm, toYMD } from "../../../../src/services/lib/time";

/* ───────── 공통 유틸 ───────── */
function fmtHms(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}
function sameYmd(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function startOfDay(d: Date | number) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
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
function startOfWeekSun(date: Date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeekSun(date: Date) {
  const s = startOfWeekSun(date);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

/* ───────── Day: 라이브 총합 / 완료합 / 시간별 막대 ───────── */
function useLiveTodayMs(
  userId: string,
  anchor: Date,
  granularity: Granularity
) {
  const [liveMs, setLiveMs] = useState(0);
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
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
            return acc + Math.max(0, nowTs - from);
          }, 0);
          if (mounted) setLiveMs(sum);
        } catch {
          if (mounted) setLiveMs(0);
        }
      };
      tick();
      const t = setInterval(tick, 1000);
      return () => {
        mounted = false;
        clearInterval(t);
      };
    }, [userId, anchor, granularity])
  );
  return liveMs;
}

function useFinishedTodayMs(
  userId: string,
  anchor: Date,
  granularity: Granularity
) {
  const [ms, setMs] = useState(0);
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const load = async () => {
        if (!(granularity === "day" && sameYmd(anchor, new Date()))) {
          if (mounted) setMs(0);
          return;
        }
        try {
          const ymd = toYMD(anchor);
          const keys = (await AsyncStorage.getAllKeys()).filter(
            (k) => k.startsWith(`stats:${userId}:`) && k.endsWith(`:${ymd}`)
          );
          if (!keys.length) {
            if (mounted) setMs(0);
            return;
          }
          const pairs = await AsyncStorage.multiGet(keys);
          let sum = 0;
          for (const [, raw] of pairs) {
            if (!raw) continue;
            try {
              const rows: {
                startedAt: number;
                endedAt: number;
                durationMs?: number;
              }[] = JSON.parse(raw) || [];
              for (const r of rows)
                sum += r.durationMs ?? Math.max(0, r.endedAt - r.startedAt);
            } catch {}
          }
          if (mounted) setMs(sum);
        } catch {
          if (mounted) setMs(0);
        }
      };
      load();
      const t = setInterval(load, 1000);
      return () => {
        mounted = false;
        clearInterval(t);
      };
    }, [userId, anchor, granularity])
  );
  return ms;
}

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
      const load = async () => {
        if (!(granularity === "day" && sameYmd(anchor, new Date()))) {
          if (mounted) setMinsByHour(new Array(24).fill(0));
          return;
        }
        try {
          const ymd = toYMD(anchor);
          const keys = (await AsyncStorage.getAllKeys()).filter(
            (k) => k.startsWith(`stats:${userId}:`) && k.endsWith(`:${ymd}`)
          );
          const msByHour = new Array<number>(24).fill(0);
          if (keys.length) {
            const pairs = await AsyncStorage.multiGet(keys);
            const day0 = new Date(`${ymd}T00:00:00`).getTime();
            const dayEnd = day0 + 24 * 3600 * 1000 - 1;
            for (const [, raw] of pairs) {
              if (!raw) continue;
              let rows: { startedAt: number; endedAt: number }[] = [];
              try {
                rows = JSON.parse(raw) || [];
              } catch {}
              for (const r of rows) {
                const s = Math.max(day0, r.startedAt);
                const e = Math.min(dayEnd, r.endedAt);
                if (!(e > s)) continue;
                let cursor = s;
                while (cursor <= e) {
                  const h = new Date(cursor).getHours();
                  const segEnd = Math.min(e, hourEnd(new Date(cursor)));
                  msByHour[h] += Math.max(0, segEnd - cursor + 1);
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
      const t = setInterval(load, 1000);
      return () => {
        mounted = false;
        clearInterval(t);
      };
    }, [userId, anchor, granularity])
  );
  return minsByHour;
}

function useLiveMinutesForCurrentHour(
  userId: string,
  anchor: Date,
  granularity: Granularity
) {
  const [liveMinByHour, setLiveMinByHour] = React.useState<number[]>(
    new Array(24).fill(0)
  );
  const isToday = granularity === "day" && sameYmd(anchor, new Date());
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const poll = async () => {
        if (!isToday) {
          if (mounted) setLiveMinByHour(new Array(24).fill(0));
          return;
        }
        try {
          const raw = await AsyncStorage.getItem(`currentSessions:${userId}`);
          const sessions: { placeId: string; startedAt: number }[] = raw
            ? JSON.parse(raw)
            : [];
          const now = new Date();
          const idx = now.getHours();
          const soh = startOfHour(now);
          const eoh = endOfHour(now);
          const nowTs = now.getTime();
          let liveMs = 0;
          for (const s of sessions) {
            const st = Math.max(s.startedAt ?? nowTs, soh);
            const ed = Math.min(nowTs, eoh);
            liveMs += Math.max(0, ed - st);
          }
          const liveMin = Math.min(60, Math.floor(liveMs / 60000));
          if (mounted) {
            const arr = new Array(24).fill(0);
            arr[idx] = liveMin;
            setLiveMinByHour(arr);
          }
        } catch {
          if (mounted) setLiveMinByHour(new Array(24).fill(0));
        }
      };
      poll();
      const t = setInterval(poll, 1000);
      return () => {
        mounted = false;
        clearInterval(t);
      };
    }, [userId, anchor, granularity, isToday])
  );
  return liveMinByHour;
}

/* ───────── Week: 라이브 총합 ───────── */
function useLiveWeekMs(userId: string, anchor: Date, granularity: Granularity) {
  const [ms, setMs] = useState(0);
  const isThisWeek =
    granularity === "week" &&
    startOfWeekSun(anchor).getTime() === startOfWeekSun(new Date()).getTime();
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const tick = async () => {
        if (!isThisWeek) {
          if (mounted) setMs(0);
          return;
        }
        try {
          const raw = await AsyncStorage.getItem(`currentSessions:${userId}`);
          const sessions: { placeId: string; startedAt: number }[] = raw
            ? JSON.parse(raw)
            : [];
          const nowTs = Date.now();
          const ws = startOfWeekSun(new Date()).getTime();
          const we = endOfWeekSun(new Date()).getTime();
          const sum = sessions.reduce((acc, s) => {
            const from = Math.max(s.startedAt ?? nowTs, ws);
            const to = Math.min(nowTs, we);
            return acc + Math.max(0, to - from);
          }, 0);
          if (mounted) setMs(sum);
        } catch {
          if (mounted) setMs(0);
        }
      };
      tick();
      const t = setInterval(tick, 1000);
      return () => {
        mounted = false;
        clearInterval(t);
      };
    }, [userId, anchor, granularity, isThisWeek])
  );
  return ms;
}

/* ───────── Day 그래프(시간별) ───────── */
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

/* ───────── Week 그래프(요일) ───────── */
function WeekBarsKR({ msByDay }: { msByDay: number[] }) {
  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  const DAY_MS = 24 * 60 * 60 * 1000;

  return (
    <View style={{ marginTop: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          height: 160, // 그래프 총 높이(디자인만)
        }}
      >
        {msByDay.map((v, i) => {
          // 혹시 저장/계산상의 이유로 24시간을 초과해도 100%로 캡
          const clamped = Math.min(DAY_MS, Math.max(0, v || 0));
          const pct = (clamped / DAY_MS) * 100;

          return (
            <View
              key={`w-${i}`}
              style={{ alignItems: "center", flex: 1, marginHorizontal: 3 }}
            >
              <View
                style={{
                  width: 16,
                  height: `${pct}%`,
                  backgroundColor: "#10B981", // 초록
                  borderRadius: 4,
                }}
              />
              <Text style={{ marginTop: 6, fontSize: 12, color: "#6B7280" }}>
                {labels[i]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ───────── 일 전용: 진입&이탈 카드 + 페이지네이션 ───────── */
function fmtHHmm(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}
function fmtKrDuration(ms: number) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `체류 시간 : ${h}시간 ${m}분`;
  if (h > 0) return `체류 시간 : ${h}시간`;
  return `체류 시간 : ${m}분`;
}
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
      const load = async () => {
        if (granularity !== "day") {
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
          if (!keys.length) {
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
      const t = setInterval(load, 1000); // [DAY][ADDED] 새 항목 생기면 라이브 반영
      return () => {
        mounted = false;
        clearInterval(t);
      };
    }, [userId, anchor, granularity])
  );
  return rows;
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
        <View style={stayStyles.dot} />
        <Text style={stayStyles.mainTime}>
          {fmtHHmm(startedAt)} <Text style={stayStyles.arrow}>→</Text>{" "}
          {endedAt ? fmtHHmm(endedAt) : "진행 중"}
        </Text>
      </View>
      <Text style={stayStyles.sub}>{fmtKrDuration(dur)}</Text>
    </View>
  );
}
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
  const goPage = (p: number) => setPage(Math.min(totalPages, Math.max(1, p)));

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

/* ───────── 주차 라벨 ───────── */
const ORD = ["첫째주", "둘째주", "셋째주", "넷째주", "다섯째주"];
// function weekOfMonthLabel(date: Date) {
//   const year = date.getFullYear();
//   const month = date.getMonth(); // 0-11
//   const d1 = new Date(year, month, 1);
//   const firstSun = startOfWeekSun(d1); // 1일이 포함된 주의 일요일
//   const thisSun = startOfWeekSun(date);
//   const diff = Math.round((thisSun.getTime() - firstSun.getTime()) / 86400000);
//   const idx = Math.floor(diff / 7); // 0-based
//   return `${year}.${String(month + 1).padStart(2, "0")} ${
//     ORD[Math.min(4, Math.max(0, idx))]
//   }`;
// }
function weekOfMonthLabel(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0~11
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekStart = new Date(firstOfMonth);
  firstWeekStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay()); // 해당 달의 첫 일요일
  const thisWeekStart = new Date(date);
  thisWeekStart.setDate(date.getDate() - date.getDay());
  const diffDays = Math.floor(
    (thisWeekStart.getTime() - firstWeekStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekIdx = Math.floor(diffDays / 7); // 0-based
  return `${year}.${String(month + 1).padStart(2, "0")} ${
    ORD[Math.min(ORD.length - 1, weekIdx)]
  }`;
}
/* ───────── 메인 컴포넌트 ───────── */
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

  // Day
  const liveTodayMs = useLiveTodayMs(userId, anchor, granularity);
  const finishedTodayMs = useFinishedTodayMs(userId, anchor, granularity);
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

  // Week
  const liveWeekMs = useLiveWeekMs(userId, anchor, granularity);
  let weekBars: number[] | undefined = (stats as any).weekBars;
  if (granularity === "week" && weekBars) {
    weekBars = [...weekBars];
    const thisWeekStart = startOfWeekSun(anchor).getTime();
    if (thisWeekStart === startOfWeekSun(new Date()).getTime()) {
      const todayIdx = new Date().getDay();
      weekBars[todayIdx] = (weekBars[todayIdx] || 0) + (liveTodayMs || 0);
    }
  }

  // 표시 총합
  const baseTotal = stats?.totalMs ?? 0;
  const displayTotalMs =
    granularity === "day" && sameYmd(anchor, new Date())
      ? (finishedTodayMs || 0) + (liveTodayMs || 0)
      : granularity === "week"
      ? baseTotal + (liveWeekMs || 0)
      : baseTotal;

  // 헤더 타이틀
  const title = useMemo(
    () =>
      granularity === "day"
        ? "총 집중 시간"
        : granularity === "week"
        ? "주간 총 집중 시간"
        : "월간 총 집중",
    [granularity]
  );
  const formattedTotal =
    granularity === "day" ? fmtHms(displayTotalMs) : fmtHm(displayTotalMs);

  const weekLabel =
    granularity === "week" ? weekOfMonthLabel(anchor) : undefined;

  // [NAV][ADDED] 날짜 점프 버튼 라벨/동작
  const jumpLabel =
    granularity === "day"
      ? "오늘로"
      : granularity === "week"
      ? "이번 주로"
      : "이번 달로";
  const onJump = () => setAnchor(new Date());

  // Day: 진입/이탈 기록(해당 날짜만)
  const dayRowsLive = useDaySessionsLive(userId, anchor, granularity);

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
          {/* [NAV][ADDED] 오늘/이번주/이번달 버튼 가운데 정렬하기 */}
          <Pressable style={styles.jumpBtn} onPress={onJump}>
            <Text style={styles.jumpBtnText}>{jumpLabel}</Text>
          </Pressable>

          <LiveNowBadge userId={userId} placeId={placeId} />
        </View>

        {stats.loading ? (
          <View style={styles.center}>
            <Text style={{ color: "#6B7280" }}>집중장소를 선택하세요.</Text>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.summary}>
              {granularity === "week" && (
                <Text style={styles.weekMeta}>{weekLabel}</Text>
              )}
              <Text style={styles.summaryTitle}>{title}</Text>
              <Text style={styles.summaryValue}>{formattedTotal}</Text>
            </View>

            {granularity === "day" && (
              <DayHourBars minutesByHour={minutesByHour} />
            )}
            {granularity === "week" && weekBars && (
              <WeekBarsKR msByDay={weekBars} />
            )}

            {/* [DAY][KEEP] 일 화면에서만 '진입 & 이탈 시간' 표기 */}
            {granularity === "day" && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.sectionTitle}>진입 & 이탈 시간</Text>
                <PaginatedStayList rows={dayRowsLive} />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ───────── 현재 체류 배지 ───────── */
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
      let t: any;
      load();
      t = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(t);
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

/* ───────── Styles ───────── */
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
  jumpBtn: {
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  jumpBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  summary: {
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  weekMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  summaryTitle: { fontSize: 14, color: "#6B7280", marginBottom: 6 },
  summaryValue: { fontSize: 28, fontWeight: "bold", color: "#111827" },
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
