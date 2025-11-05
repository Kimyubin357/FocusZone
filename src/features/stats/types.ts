// [STATS] NEW FILE: src/features/stats/types.ts

export type Granularity = "day" | "week" | "month";

export type SessionRow = {
  id: string;
  placeId: string;
  startedAt: number; // ms epoch
  endedAt: number; // ms epoch
  durationMs: number;
};

export type UseStatsParams = {
  userId: string;
  placeId: string; // "__none__" 받으면 비우기
  anchor: Date;
  granularity: Granularity;
};

export type UseStatsResult = {
  loading: boolean;
  totalMs: number;
  sessions: SessionRow[];

  // day
  timeline24?: number[]; // index: 0~23, 값: 밀리초(또는 분) 누적

  // week
  weekBars?: number[]; // index: 0(일)~6(토), 값: 밀리초 누적
  activeDaysCount?: number;

  // month
  monthGrid?: { date: string; totalMs: number }[]; // "YYYY-MM-DD"
};
