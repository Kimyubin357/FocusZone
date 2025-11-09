// app/(protected)/(tabs)/(group_zone)/stats/index.tsx
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
//노윤석 추가코드
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  FieldPath,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../../../firebaseConfig";
import DatePager from "../../../../../src/features/ui/DatePager";
import PeriodToggle from "../../../../../src/features/ui/PeriodToggle";
// 타입
type Granularity = "day" | "week" | "month";
type Interval = { startedAt: number; endedAt: number; durationMs?: number };
type DayDoc = { totalMs?: number; intervals?: Interval[]; updatedAt?: any };
// 공통 유틸
const to2 = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date | number) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${to2(x.getMonth() + 1)}-${to2(x.getDate())}`;
};
const sameYmd = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const sameYm = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const startOfDay = (d: Date | number) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};
const startOfHour = (date: Date) => {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.getTime();
};
const endOfHour = (date: Date) => {
  const d = new Date(date);
  d.setMinutes(59, 59, 999);
  return d.getTime();
};
const startOfWeekSun = (date: Date) => {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfWeekSun = (date: Date) => {
  const s = startOfWeekSun(date);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
};
const startOfMonth = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfMonth = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
};
const fmtHms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${to2(h)}:${to2(m)}:${to2(ss)}`;
};
const fmtHHmm = (ts: number) => {
  const d = new Date(ts);
  return `${to2(d.getHours())}:${to2(d.getMinutes())}`;
};
// 합집합 총합
const sumMergedIntervals = (
  intervals: { start: number; end: number }[],
  clampStart: number,
  clampEnd: number
) => {
  if (!intervals.length) return 0;
  const clipped = intervals
    .map(({ start, end }) => {
      const s = Math.max(start, clampStart);
      const e = Math.min(end, clampEnd);
      return e > s ? { start: s, end: e } : null;
    })
    .filter(Boolean) as { start: number; end: number }[];
  if (!clipped.length) return 0;
  clipped.sort((a, b) => a.start - b.start);
  let curS = clipped[0].start;
  let curE = clipped[0].end;
  let total = 0;
  for (let i = 1; i < clipped.length; i++) {
    const { start, end } = clipped[i];
    if (start <= curE) curE = Math.max(curE, end);
    else {
      total += curE - curS;
      curS = start;
      curE = end;
    }
  }
  total += curE - curS;
  return Math.max(0, total);
};
//노윤석 끝

export default function GroupZoneStatsScreen() {
  const { groupId, memberId } = useLocalSearchParams<{
    groupId?: string;
    memberId?: string;
  }>();

  //노윤석 추가코드
  const effectiveMemberId = useMemo(
    () => (memberId ? String(memberId) : auth.currentUser?.uid || "local"),
    [memberId]
  );
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [anchor, setAnchor] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Day 데이터(완료 intervals + totalMs)
  const [dayIntervals, setDayIntervals] = useState<Interval[]>([]);
  const [dayTotalMs, setDayTotalMs] = useState(0);

  // Week/Month 데이터
  const [weekBars, setWeekBars] = useState<number[] | null>(null); // 길이 7
  const [monthGrid, setMonthGrid] = useState<
    { date: string; totalMs: number }[] | null
  >(null);

  // 라이브(진행중) 오버레이
  const [liveTodayMs, setLiveTodayMs] = useState(0);
  const [liveMinByHour, setLiveMinByHour] = useState<number[]>(
    new Array(24).fill(0)
  );

  const todayYmd = useMemo(() => toYMD(new Date()), []);
  const anchorYmd = useMemo(() => toYMD(anchor), [anchor]);
  //노윤석 끝

  //노윤석 추가코드
  // Day: Firestore 해당 날짜 문서 실시간
  useEffect(() => {
    if (!groupId || !effectiveMemberId) return;
    setLoading(true);
    const dayRef = doc(
      collection(
        db,
        "groupLocations",
        String(groupId),
        "memberStats",
        effectiveMemberId,
        "days"
      ),
      anchorYmd
    );
    const unsub = onSnapshot(
      dayRef,
      (snap) => {
        const data = (snap.data() || {}) as DayDoc;
        setDayIntervals(Array.isArray(data.intervals) ? data.intervals : []);
        setDayTotalMs(data.totalMs || 0);
        setLoading(false);
      },
      () => {
        setDayIntervals([]);
        setDayTotalMs(0);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [groupId, effectiveMemberId, anchorYmd]);

  // Week: 기간에 포함된 days 문서 쿼리 후 7칸 합계 배열
  useEffect(() => {
    if (!groupId || !effectiveMemberId || granularity !== "week") {
      setWeekBars(null);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const s = startOfWeekSun(anchor);
        const e = endOfWeekSun(anchor);
        const ymds: string[] = [];
        const d = new Date(s.getTime());
        while (d.getTime() <= e.getTime()) {
          ymds.push(toYMD(d));
          d.setDate(d.getDate() + 1);
        }
        // Firestore: docId in range (문서ID = YYYY-MM-DD)
        const daysCol = collection(
          db,
          "groupLocations",
          String(groupId),
          "memberStats",
          effectiveMemberId,
          "days"
        );
        const qy = query(
          daysCol,
          where(FieldPath.documentId(), ">=", ymds[0]),
          where(FieldPath.documentId(), "<=", ymds[ymds.length - 1]),
          orderBy(FieldPath.documentId(), "asc"),
          limit(31)
        );
        const snap = await getDocs(qy);
        const map = new Map<string, number>();
        snap.forEach((doc) => {
          const d = doc.data() as DayDoc;
          map.set(doc.id, Math.max(0, d.totalMs || 0));
        });
        const arr = ymds.map((k) => map.get(k) || 0);
        setWeekBars(arr);
      } catch {
        setWeekBars(new Array(7).fill(0));
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, effectiveMemberId, anchor, granularity]);

  // Month: 월 그리드(각 날짜 총합)
  useEffect(() => {
    if (!groupId || !effectiveMemberId || granularity !== "month") {
      setMonthGrid(null);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const s = startOfMonth(anchor);
        const e = endOfMonth(anchor);
        const ymds: string[] = [];
        const cur = new Date(s.getTime());
        while (cur.getTime() <= e.getTime()) {
          ymds.push(toYMD(cur));
          cur.setDate(cur.getDate() + 1);
        }
        const daysCol = collection(
          db,
          "groupLocations",
          String(groupId),
          "memberStats",
          effectiveMemberId,
          "days"
        );
        const qy = query(
          daysCol,
          where(FieldPath.documentId(), ">=", ymds[0]),
          where(FieldPath.documentId(), "<=", ymds[ymds.length - 1]),
          orderBy(FieldPath.documentId(), "asc"),
          limit(62)
        );
        const snap = await getDocs(qy);
        const map = new Map<string, number>();
        snap.forEach((doc) => {
          const d = doc.data() as DayDoc;
          map.set(doc.id, Math.max(0, d.totalMs || 0));
        });
        const grid = ymds.map((d) => ({ date: d, totalMs: map.get(d) || 0 }));
        setMonthGrid(grid);
      } catch {
        setMonthGrid([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, effectiveMemberId, anchor, granularity]);

  // 라이브(진행중) 오버레이: currentSessions 중 이 groupId에 해당하는 세션만
  useEffect(() => {
    let t: any;
    const tick = async () => {
      if (!groupId) {
        setLiveTodayMs(0);
        setLiveMinByHour(new Array(24).fill(0));
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(
          `currentSessions:${effectiveMemberId || "local"}`
        );
        const sessions: { placeId: string; startedAt: number }[] = raw
          ? JSON.parse(raw)
          : [];
        const mySessions = sessions.filter(
          (s) => s.placeId === String(groupId)
        );
        const now = new Date();
        const nowTs = now.getTime();

        // Day 라이브 총합(합집합 1배속) — 오늘만
        const sod = startOfDay(new Date());
        if (
          granularity === "day" &&
          sameYmd(anchor, new Date()) &&
          mySessions.length
        ) {
          const minStarted = Math.min(
            ...mySessions.map((s) => s.startedAt ?? nowTs)
          );
          setLiveTodayMs(Math.max(0, nowTs - Math.max(minStarted, sod)));
        } else {
          setLiveTodayMs(0);
        }

        // 현재 시간대 라이브 분(해당 시간대만 계산)
        const idx = now.getHours();
        const soh = startOfHour(now);
        const eoh = endOfHour(now);
        let liveMsHour = 0;
        for (const s of mySessions) {
          const st = Math.max(s.startedAt ?? nowTs, soh);
          const ed = Math.min(nowTs, eoh);
          liveMsHour += Math.max(0, ed - st);
        }
        const arr = new Array(24).fill(0);
        arr[idx] = Math.min(60, Math.floor(liveMsHour / 60000));
        setLiveMinByHour(arr);
      } catch {
        setLiveTodayMs(0);
        setLiveMinByHour(new Array(24).fill(0));
      }
    };
    tick();
    t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [groupId, effectiveMemberId, anchor, granularity]);
  //노윤석 끝

  // ───────── UI 데이터 가공 (개인 통계 UI와 동일한 모양) ─────────
  // Day: 시간별 막대 (완료 + 진행중(현재시각 bar만))
  const finishedByHourMinToday = useMemo(() => {
    if (!(granularity === "day")) return new Array(24).fill(0);
    // 완료 intervals → 오늘 범위로 쪼개어 분 집계
    const ymd = anchorYmd;
    const day0 = new Date(`${ymd}T00:00:00`).getTime();
    const dayEnd = day0 + 24 * 3600 * 1000 - 1;
    const msByHour = new Array<number>(24).fill(0);
    for (const r of dayIntervals || []) {
      const s = Math.max(day0, r.startedAt);
      const e = Math.min(dayEnd, r.endedAt);
      if (!(e > s)) continue;
      let cursor = s;
      while (cursor <= e) {
        const h = new Date(cursor).getHours();
        const segEnd = Math.min(e, endOfHour(new Date(cursor)));
        msByHour[h] += Math.max(0, segEnd - cursor + 1);
        cursor = segEnd + 1;
      }
    }
    return msByHour.map((v) =>
      Math.max(0, Math.min(60, Math.floor(v / 60000)))
    );
  }, [dayIntervals, anchorYmd, granularity]);

  const minutesByHour =
    granularity === "day" && sameYmd(anchor, new Date())
      ? finishedByHourMinToday.map((m, i) =>
          Math.min(60, m + (liveMinByHour[i] || 0))
        )
      : finishedByHourMinToday;

  // Week Bars (24h = 100%)
  const weekBarsCapped = useMemo(() => {
    if (!weekBars) return null;
    const DAY_MS = 24 * 3600 * 1000;
    const arr = [...weekBars];
    // 이번 주면 오늘 칸에 라이브 더하기 (cap 24h)
    if (
      startOfWeekSun(anchor).getTime() === startOfWeekSun(new Date()).getTime()
    ) {
      const idx = new Date().getDay();
      const base = arr[idx] || 0;
      const extra = Math.min(DAY_MS - Math.min(DAY_MS, base), liveTodayMs || 0);
      arr[idx] = base + Math.max(0, extra);
    }
    return arr.map((v) => Math.min(DAY_MS, Math.max(0, v)));
  }, [weekBars, anchor, liveTodayMs]);

  // Month Grid (오늘 칸 라이브 더하기)
  const monthGridWithLive = useMemo(() => {
    if (!monthGrid) return null;
    if (!sameYm(anchor, new Date())) return monthGrid;
    return monthGrid.map((d) =>
      d.date === todayYmd
        ? { ...d, totalMs: (d.totalMs || 0) + (liveTodayMs || 0) }
        : d
    );
  }, [monthGrid, anchor, liveTodayMs, todayYmd]);

  // Day 총합(표시값): 완료 + 라이브(합집합 방식)
  const displayDayTotal = useMemo(() => {
    if (granularity !== "day") return 0;
    const start = startOfDay(anchor);
    const end = start + 24 * 3600 * 1000 - 1;
    const doneIntervals = (dayIntervals || []).map((r) => ({
      start: r.startedAt,
      end: r.endedAt,
    }));
    // 라이브는 currentSessions에서 구한 1개 등가 구간
    const live =
      liveTodayMs > 0
        ? [{ start: Date.now() - liveTodayMs, end: Date.now() }]
        : [];
    return sumMergedIntervals([...doneIntervals, ...live], start, end);
  }, [granularity, dayIntervals, liveTodayMs, anchor]);

  // 주차 라벨
  const ORD = ["첫째주", "둘째주", "셋째주", "넷째주", "다섯째주"];
  const weekLabel = useMemo(() => {
    if (granularity !== "week") return "";
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const d1 = new Date(year, month, 1);
    const firstSun = startOfWeekSun(d1);
    const thisSun = startOfWeekSun(anchor);
    const diff = Math.round(
      (thisSun.getTime() - firstSun.getTime()) / 86400000
    );
    const idx = Math.floor(diff / 7);
    return `${year}.${to2(month + 1)} ${ORD[Math.min(4, Math.max(0, idx))]}`;
  }, [anchor, granularity]);
  //노윤석 끝

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ title: "그룹장소 통계" }} />

      {!groupId ? (
        <View style={styles.center}>
          <Text style={styles.warn}>groupId 파라미터가 없습니다.</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* 헤더: Period + DatePager + 점프 + 라이브뱃지 자리 */}
          <View style={styles.header}>
            <PeriodToggle value={granularity} onChange={setGranularity} />
            <View style={{ height: 8 }} />
            <DatePager
              anchor={anchor}
              granularity={granularity}
              onChange={setAnchor}
              onToday={() => setAnchor(new Date())}
            />
            <Pressable
              style={styles.jumpBtn}
              onPress={() => setAnchor(new Date())}
            >
              <Text style={styles.jumpBtnText}>
                {granularity === "day"
                  ? "오늘로 가기"
                  : granularity === "week"
                  ? "이번 주로"
                  : "이번 달로"}
              </Text>
            </Pressable>
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            {granularity === "week" && (
              <Text style={styles.weekMeta}>{weekLabel}</Text>
            )}
            <Text style={styles.summaryTitle}>
              {granularity === "day"
                ? "총 집중 시간"
                : granularity === "week"
                ? "주간 총 집중 시간"
                : "월간 총 집중 시간"}
            </Text>
            <Text style={styles.summaryValue}>
              {granularity === "day"
                ? fmtHms(displayDayTotal)
                : granularity === "week" && weekBarsCapped
                ? fmtHms(weekBarsCapped.reduce((a, b) => a + b, 0))
                : monthGridWithLive
                ? fmtHms(
                    monthGridWithLive.reduce((a, b) => a + (b.totalMs || 0), 0)
                  )
                : "00:00:00"}
            </Text>
            {/* <Text style={styles.sub}>
              그룹: {String(groupId)} · 멤버: {effectiveMemberId}
            </Text> */}
          </View>

          {/* Day 그래프(시간별) */}
          {granularity === "day" && (
            <DayHourBars minutesByHour={minutesByHour} />
          )}

          {/* Week 그래프(요일 24h=100%) */}
          {granularity === "week" && weekBarsCapped && (
            <WeekBarsKR msByDay={weekBarsCapped} />
          )}

          {/* Month 달력 히트맵 */}
          {granularity === "month" && monthGridWithLive && (
            <MonthCalendar anchor={anchor} monthGrid={monthGridWithLive} />
          )}

          {/* Day 전용: 진입 & 이탈 카드 */}
          {granularity === "day" && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>진입 & 이탈 시간</Text>
              <PaginatedStayList rows={dayIntervals || []} />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
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

/* ───────── Week 그래프(요일, 24h=100%) ───────── */
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
          height: 160,
        }}
      >
        {msByDay.map((v, i) => {
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
                  backgroundColor: "#10B981",
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

/* ───────── Day: 진입&이탈 카드 + 페이지네이션 ───────── */
function fmtKrDuration(ms: number) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `체류 시간 : ${h}시간 ${m}분`;
  if (h > 0) return `체류 시간 : ${h}시간`;
  return `체류 시간 : ${m}분`;
}
function StayCard({ startedAt, endedAt, durationMs }: Interval) {
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
  rows: Interval[];
  pageSize?: number;
}) {
  const sorted = useMemo(() => {
    return [...(rows || [])].sort((a, b) => {
      const da = (a.endedAt ?? a.startedAt) || 0;
      const db = (b.endedAt ?? b.startedAt) || 0;
      return db - da;
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
        <StayCard key={`${r.startedAt}-${r.endedAt}-${idx}`} {...r} />
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

/* ───────── Month 달력 히트맵 ───────── */
const HOUR_COLORS = [
  "#E5E7EB",
  "#D1FAE5",
  "#BFEFDB",
  "#ACE6D1",
  "#99DCC7",
  "#87D2BD",
  "#74C8B3",
  "#62BEA9",
  "#4FB49F",
  "#3DAA95",
  "#2AA08B",
  "#189681",
  "#078C77",
  "#067F6C",
  "#067461",
  "#066956",
  "#065F4C",
  "#055542",
  "#054B38",
  "#04422F",
  "#043A27",
  "#04321F",
  "#032A19",
  "#032313",
  "#022D1B",
];
const clampHourColor = (hours: number) => {
  const capped = Math.max(0, Math.min(24, hours));
  const idx = capped === 0 ? 0 : Math.min(24, Math.max(1, Math.ceil(capped)));
  return HOUR_COLORS[idx];
};
function MonthCalendar({
  anchor,
  monthGrid,
}: {
  anchor: Date;
  monthGrid: { date: string; totalMs: number }[];
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstDayIdx = first.getDay();
  const totalDays = last.getDate();
  const todayYmd = toYMD(new Date());

  const map = new Map<string, number>();
  for (const d of monthGrid || []) map.set(d.date, d.totalMs || 0);

  const cells: { ymd?: string; num?: number; ms?: number }[] = [];
  for (let i = 0; i < firstDayIdx; i++) cells.push({});
  for (let d = 1; d <= totalDays; d++) {
    const ymd = `${year}-${to2(month + 1)}-${to2(d)}`;
    cells.push({ ymd, num: d, ms: map.get(ymd) || 0 });
  }
  while (cells.length % 7 !== 0) cells.push({});

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={{ marginTop: 12 }}>
      <View style={monthStyles.weekHeader}>
        {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
          <Text key={w} style={monthStyles.weekHeadTxt}>
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((w, wi) => (
        <View key={`w-${wi}`} style={monthStyles.row}>
          {w.map((c, ci) => {
            const isBlank = !c.ymd;
            const hours = (c.ms || 0) / 3600000;
            const color = isBlank ? "transparent" : clampHourColor(hours);
            const isToday = c.ymd === todayYmd;
            return (
              <View key={`c-${wi}-${ci}`} style={monthStyles.cell}>
                <View
                  style={[
                    monthStyles.box,
                    {
                      backgroundColor: color,
                      borderColor: isToday ? "#111827" : "#E5E7EB",
                      borderWidth: isToday ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  {!isBlank && (
                    <Text
                      style={[
                        monthStyles.dayNum,
                        { color: hours > 0 ? "#0B3B2E" : "#6B7280" },
                      ]}
                    >
                      {c.num}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/* ───────── Styles ───────── */
const styles = StyleSheet.create({
  header: { marginBottom: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  warn: { color: "#DC2626", fontSize: 14 },
  jumpBtn: {
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  jumpBtnText: { color: "white", fontSize: 12, fontWeight: "700" },
  summary: {
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  weekMeta: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  summaryTitle: { fontSize: 14, color: "#6B7280", marginBottom: 6 },
  summaryValue: { fontSize: 28, fontWeight: "bold", color: "#111827" },
  sub: { marginTop: 4, fontSize: 12, color: "#6B7280" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
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
    backgroundColor: "#10B981",
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
  pageBtnActive: { backgroundColor: "#111827", borderColor: "#111827" },
  pageLabel: { fontSize: 12, color: "#374151" },
  pageLabelActive: { color: "#FFFFFF", fontWeight: "700" },
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
  navBtnDisabled: { opacity: 0.4 },
  navLabel: { fontSize: 12, color: "#374151" },
});

const monthStyles = StyleSheet.create({
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  weekHeadTxt: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 12,
    color: "#6B7280",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cell: { width: `${100 / 7}%`, paddingHorizontal: 2 },
  box: {
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    padding: 6,
    backgroundColor: "#E5E7EB",
  },
  dayNum: { fontSize: 12, fontWeight: "700" },
});
