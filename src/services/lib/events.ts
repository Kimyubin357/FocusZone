// src/services/lib/events.ts
type EventMap = {
  "focusPlaces:changed": void; // payload 없음
  // "stats:updated": { placeId: string }  // 필요한 이벤트를 여기에 추가
};

type Handler<T> = (payload: T) => void;

class TypedBus<M extends Record<string, any>> {
  private map = new Map<keyof M, Set<Handler<any>>>();

  on<K extends keyof M>(event: K, handler: Handler<M[K]>) {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event)!.add(handler);
    return () => this.off(event, handler);
  }
  off<K extends keyof M>(event: K, handler: Handler<M[K]>) {
    const set = this.map.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this.map.delete(event);
  }
  emit<K extends keyof M>(event: K, payload: M[K]) {
    const set = this.map.get(event);
    if (!set) return;
    for (const h of Array.from(set)) h(payload);
  }
}

export const bus = new TypedBus<EventMap>();

export const on = bus.on.bind(bus);
export const off = bus.off.bind(bus);
export const emit = bus.emit.bind(bus);

export const EVENTS = {
  FOCUS_PLACES_CHANGED: "focusPlaces:changed",
} as const;
