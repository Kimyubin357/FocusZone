import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EVENTS, on } from "../../services/lib/events";

type Place = { id: string; name: string };

export default function PlaceSelector({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id?: string) => void;
}) {
  const [items, setItems] = useState<Place[]>([]);
  const selected = items.find((p) => p.id === value);
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

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

      if (value && !normalized.find((p) => p.id === value)) {
        onChange(undefined);
      }
    } catch {
      setItems([]);
      if (value) onChange(undefined);
    }
  }, [value, onChange]);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  useFocusEffect(
    useCallback(() => {
      loadPlaces();
      return () => {};
    }, [loadPlaces])
  );

  useEffect(() => {
    const off = on(EVENTS.FOCUS_PLACES_CHANGED, () => loadPlaces());
    return () => {
      off?.();
    };
  }, [loadPlaces]);

  const trigger = (
    <Pressable style={styles.selectBtn} onPress={() => setOpen(true)}>
      <Text style={styles.selectBtnText} numberOfLines={1}>
        {selected ? selected.name : "집중장소 선택"}
      </Text>
    </Pressable>
  );

  return (
    <View>
      {trigger}
      <Modal
        animationType="slide"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.sheet, { marginTop: insets.top + 12 }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>집중장소 선택</Text>
          </View>
          <View style={styles.sheetBody}>
            {items.length === 0 ? (
              <View style={{ padding: 16 }}>
                <Text style={{ color: "#6B7280" }}>
                  먼저 집중장소를 추가하세요.
                </Text>
              </View>
            ) : (
              items.map((p) => {
                const active = p.id === value;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      onChange(active ? undefined : p.id);
                      setOpen(false);
                    }}
                    style={[styles.itemRow, active && styles.itemRowActive]}
                  >
                    <Text
                      style={[styles.itemText, active && styles.itemTextActive]}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
          <Pressable style={styles.sheetClose} onPress={() => setOpen(false)}>
            <Text style={styles.sheetCloseText}>닫기</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Trigger button
  selectBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignSelf: "flex-start",
  },
  selectBtnText: { color: "#111827", fontWeight: "700" },

  // Overlay and floating sheet
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  sheetBody: { paddingVertical: 4 },
  sheetClose: {
    padding: 14,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  sheetCloseText: { color: "#111827", fontWeight: "700" },

  // Item rows
  itemRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemRowActive: {
    backgroundColor: "#111827",
  },
  itemText: { color: "#111827", fontWeight: "600" },
  itemTextActive: { color: "#FFFFFF" },
});
