// [STATS] NEW FILE (updated): src/features/stats/ui/PlaceSelector.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native"; // [STATS] 수정됨
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EVENTS, on } from "../../services/lib/events"; // [STATS] 수정됨 (경로 확인)

/**
 * 간단한 장소 선택기
 * - "focusPlaces" 우선, 없으면 "places" 폴백
 */
type Place = { id: string; name: string };

// 오류 시 이 코드 사용
// export default function PlaceSelector({
//   value,
//   onChange,
// }: {
//   value?: string;
//   onChange: (id?: string) => void;
// }) {
//   const [items, setItems] = useState<Place[]>([]);
//   const selected = items.find((p) => p.id === value);

//   const loadPlaces = useCallback(async () => {
//     // [STATS] 수정됨
//     try {
//       const rawFocus = await AsyncStorage.getItem("focusPlaces");
//       const rawLegacy = await AsyncStorage.getItem("places");

//       let arr: any[] = [];
//       if (rawFocus) {
//         const parsed = JSON.parse(rawFocus) as any[];
//         arr = (parsed || []).map((p) => ({
//           id: p.id ?? p.placeId ?? String(p.name ?? p.address ?? "unknown"),
//           name:
//             p.name ??
//             p.address ??
//             (p.latitude && p.longitude
//               ? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`
//               : "이름없는 장소"),
//         }));
//       } else if (rawLegacy) {
//         const parsed = JSON.parse(rawLegacy) as any[];
//         arr = (parsed || []).map((p) => ({
//           id: p.id ?? String(p.name ?? "unknown"),
//           name: p.name ?? "이름없는 장소",
//         }));
//       } else {
//         arr = [];
//       }

//       const normalized: Place[] = arr
//         .filter((p) => p && p.id && p.name)
//         .map((p) => ({ id: String(p.id), name: String(p.name) }));

//       setItems(normalized);
//     } catch {
//       setItems([]);
//     }
//   }, []);

//   useEffect(() => {
//     loadPlaces();
//   }, [loadPlaces]); // [STATS] 수정됨

//   // 화면 포커스될 때마다 최신화
//   useFocusEffect(
//     // [STATS] 수정됨
//     useCallback(() => {
//       loadPlaces();
//       return () => {};
//     }, [loadPlaces])
//   );

//   // 장소 저장 변경 이벤트를 구독하여 즉시 반영
//   useEffect(() => {
//     // [STATS] 수정됨
//     const off = on(EVENTS.FOCUS_PLACES_CHANGED, () => loadPlaces());
//     return () => {
//       off?.();
//     };
//   }, [loadPlaces]);

//   if (!items.length) {
//     return (
//       <View style={styles.empty}>
//         <Text style={{ color: "#6B7280" }}>집중장소를 먼저 추가하세요.</Text>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.wrap}>
//       {items.map((p) => {
//         const active = p.id === value;
//         return (
//           <Pressable
//             key={p.id}
//             onPress={() => onChange(active ? undefined : p.id)}
//             style={[styles.btn, active && styles.btnActive]}
//           >
//             <Text style={[styles.txt, active && styles.txtActive]}>
//               {p.name}
//             </Text>
//           </Pressable>
//         );
//       })}
//     </View>
//   );
// }

export default function PlaceSelector({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id?: string) => void;
}) {
  const [items, setItems] = useState<Place[]>([]);
  const selected = items.find((p) => p.id === value);

  const loadPlaces = useCallback(async () => {
    try {
      const rawFocus = await AsyncStorage.getItem("focusPlaces");
      const rawLegacy = await AsyncStorage.getItem("places");

      let arr: any[] = [];
      if (rawFocus) {
        const parsed = JSON.parse(rawFocus) as any[];
        arr = (parsed || []).map((p) => ({
          id: p.id ?? p.placeId ?? String(p.name ?? p.address ?? "unknown"),
          name:
            p.name ??
            p.address ??
            (p.latitude && p.longitude
              ? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`
              : "이름없는 장소"),
        }));
      } else if (rawLegacy) {
        const parsed = JSON.parse(rawLegacy) as any[];
        arr = (parsed || []).map((p) => ({
          id: p.id ?? String(p.name ?? "unknown"),
          name: p.name ?? "이름없는 장소",
        }));
      } else {
        arr = [];
      }

      const normalized: Place[] = arr
        .filter((p) => p && p.id && p.name)
        .map((p) => ({ id: String(p.id), name: String(p.name) }));

      setItems(normalized);

      // [STATS] 수정됨: 삭제된 선택값 자동 해제
      if (value && !normalized.find((p) => p.id === value)) {
        onChange(undefined);
      }
    } catch {
      setItems([]);
      // [STATS] 수정됨: 오류 시에도 선택 해제
      if (value) onChange(undefined);
    }
  }, [value, onChange]); // [STATS] 수정됨: 의존성에 value, onChange 추가

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  // 화면 포커스될 때마다 최신화
  useFocusEffect(
    useCallback(() => {
      loadPlaces();
      return () => {};
    }, [loadPlaces])
  );

  // 장소 저장 변경 이벤트를 구독하여 즉시 반영
  useEffect(() => {
    const off = on(EVENTS.FOCUS_PLACES_CHANGED, () => loadPlaces());
    return () => {
      off?.();
    };
  }, [loadPlaces]);

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: "#6B7280" }}>집중장소를 먼저 추가하세요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {items.map((p) => {
        const active = p.id === value;
        return (
          <Pressable
            key={p.id}
            onPress={() => onChange(active ? undefined : p.id)}
            style={[styles.btn, active && styles.btnActive]}
          >
            <Text style={[styles.txt, active && styles.txtActive]}>
              {p.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
  },
  btnActive: { backgroundColor: "#111827" },
  txt: { color: "#6B7280", fontWeight: "700" },
  txtActive: { color: "white" },
  empty: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
  },
});
