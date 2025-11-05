// [STATS] NEW FILE: src/services/lib/events.ts
type Handler<T = any> = (payload?: T) => void;

class SimpleBus {
  private map = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler) {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: Handler) {
    const set = this.map.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this.map.delete(event);
  }

  emit<T = any>(event: string, payload?: T) {
    const set = this.map.get(event);
    if (!set) return;
    for (const h of Array.from(set)) h(payload);
  }
}

export const bus = new SimpleBus();

// 편의 함수
export const on = bus.on.bind(bus);
export const off = bus.off.bind(bus);
export const emit = bus.emit.bind(bus);

// 이벤트 이름 표준화
export const EVENTS = {
  FOCUS_PLACES_CHANGED: "focusPlaces:changed",
} as const;
