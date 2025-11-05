// [STATS] NEW FILE: src/features/stats/useStats.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  startOfMonth,
  startOfWeek,
  toYMD,
} from "../../services/lib/time"; // 경로 주의
import type { SessionRow, UseStatsParams, UseStatsResult } from "./types";
import AsyncStorageLib from "@react-native-async-storage/async-storage";

// 내부 키 포맷 상수
// - 진행중 세션 목록: currentSessions:${userId} => [{placeId, startedAt}]
// - 일자별 세션 로그:  stats:${userId}:${placeId}:${YYYY-MM-DD} => SessionRow[]
const CUR_KEY = (userId: string) => `currentSessions:${userId}`;
const DAY_KEY = (u: string, p: string, ymd: string) => `stats:${u}:${p}:${ymd}`;

async function loadDaySessions(userId: string, placeId: string, date: Date) {
  const ymd = toYMD(date);
  const key = DAY_KEY(userId, placeId, ymd);
  const raw = await AsyncStorage.getItem(key);
  const rows: SessionRow[] = raw ? JSON.parse(raw) : [];
  return rows;
}

async function getAllPlaceIds(): Promise<string[]> {
  try {
    const rawFocus = await AsyncStorageLib.getItem("focusPlaces");
    const rawLegacy = await AsyncStorageLib.getItem("places");
    let arr: any[] = [];
    if (rawFocus) {
      const parsed = JSON.parse(rawFocus) as any[];
      arr = (parsed || []).map((p) => p.id ?? p.placeId ?? String(p.name ?? p.address ?? "unknown"));
    } else if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy) as any[];
      arr = (parsed || []).map((p) => p.id ?? String(p.name ?? "unknown"));
    }
    const ids = (arr || []).map((v) => String(v)).filter(Boolean);
    // unique
    return Array.from(new Set(ids));
  } catch {
    return [];
  }
}

function sumMs(rows: SessionRow[]) {
  return rows.reduce(
    (acc, r) => acc + (r.durationMs || Math.max(0, r.endedAt - r.startedAt)),
    0
  );
}

/** 24시간 타임라인: 각 시(hour)별 ms 누적 */
function toTimeline24(rows: SessionRow[]) {
  const hours = new Array<number>(24).fill(0);
  for (const s of rows) {
    const start = new Date(s.startedAt);
    const end = new Date(s.endedAt);
    // 간단화: 각 세션을 시간 단위로 나눠 대략 분배
    let t = new Date(start);
    while (t <= end) {
      const h = t.getHours();
      const nextHour = new Date(t);
      nextHour.setMinutes(59, 59, 999);
      const spanEnd = end < nextHour ? end : nextHour;
      const delta = Math.max(0, spanEnd.getTime() - t.getTime());
      hours[h] += delta;
      t = new Date(nextHour.getTime() + 1);
    }
  }
  return hours;
}

export function useStats(params: UseStatsParams): UseStatsResult {
  const { userId, placeId, anchor, granularity } = params;
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (!placeId || placeId === "__none__") {
          if (alive) {
            setSessions([]);
          }
          return;
        }
        const loadForPlace = async (pid: string) => {
          if (granularity === "day") {
            return await loadDaySessions(userId, pid, anchor);
          } else if (granularity === "week") {
            const start = startOfWeek(anchor);
            const rows: SessionRow[] = [];
            for (let i = 0; i < 7; i++) {
              const r = await loadDaySessions(userId, pid, addDays(start, i));
              rows.push(...r);
            }
            return rows;
          } else {
            const start = startOfMonth(anchor);
            const nextMonth = new Date(start);
            nextMonth.setMonth(start.getMonth() + 1);
            const rows: SessionRow[] = [];
            for (let d = new Date(start); d < nextMonth; d.setDate(d.getDate() + 1)) {
              const r = await loadDaySessions(userId, pid, d);
              rows.push(...r);
            }
            return rows;
          }
        };

        if (placeId === "__all__") {
          const ids = await getAllPlaceIds();
          const allRows: SessionRow[] = [];
          for (const pid of ids) {
            const r = await loadForPlace(pid);
            allRows.push(...r);
          }
          if (alive) setSessions(allRows);
        } else {
          const rows = await loadForPlace(placeId);
          if (alive) setSessions(rows);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, placeId, anchor, granularity]);

  const result = useMemo<UseStatsResult>(() => {
    if (!placeId || placeId === "__none__")
      return { loading, totalMs: 0, sessions: [] };

    const totalMs = sumMs(sessions);

    if (granularity === "day") {
      return {
        loading,
        totalMs,
        sessions: [...sessions],
        timeline24: toTimeline24(sessions),
      };
    }

    if (granularity === "week") {
      const start = startOfWeek(anchor);
      const bars = new Array<number>(7).fill(0);
      const active = new Set<number>();
      for (let i = 0; i < 7; i++) {
        const ymd = toYMD(addDays(start, i));
        const daySum = sumMs(
          sessions.filter((s) => toYMD(new Date(s.startedAt)) === ymd)
        );
        bars[i] = daySum;
        if (daySum > 0) active.add(i);
      }
      return {
        loading,
        totalMs,
        sessions: [...sessions],
        weekBars: bars,
        activeDaysCount: active.size,
      };
    }

    // month
    const start = startOfMonth(anchor);
    const nextMonth = new Date(start);
    nextMonth.setMonth(start.getMonth() + 1);
    const days: { date: string; totalMs: number }[] = [];
    for (let d = new Date(start); d < nextMonth; d.setDate(d.getDate() + 1)) {
      const ymd = toYMD(d);
      const daySum = sumMs(
        sessions.filter((s) => toYMD(new Date(s.startedAt)) === ymd)
      );
      days.push({ date: ymd, totalMs: daySum });
    }
    return {
      loading,
      totalMs,
      sessions: [...sessions],
      monthGrid: days,
    };
  }, [loading, sessions, placeId, anchor, granularity]);

  return result;
}
