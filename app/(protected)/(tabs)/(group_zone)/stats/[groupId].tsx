// 파일 경로 : app/(protected)/(tabs)/(group_zone)/stats/[groupId].tsx
// {
//   totalMs: number,                 // 하루 총합 (옵션: 서버에서 미리 누적해 저장)
//   intervals: [{ startedAt, endedAt, durationMs }] // 진입/이탈 리스트
//   updatedAt: serverTimestamp()
// }
import type { FieldValue } from "firebase/firestore"; // ✅ 올바른 타입 import

export type DayDoc = {
  totalMs: number;
  intervals: { startedAt: number; endedAt: number; durationMs: number }[];
  updatedAt: FieldValue; // ✅ 올바른 타입 지정
};
