export type ProgressEvent = { from_status: string | null; to_status: string; created_at: string };

// 台灣沒有日光節約時間，固定 UTC+8；不依賴各平台 Intl 時區支援。
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

export function formatTaipeiTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + TAIPEI_OFFSET_MS);
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function describeProgressEvent(event: ProgressEvent, labels: Record<string, string>): string {
  const to = labels[event.to_status] ?? event.to_status;
  if (!event.from_status) return `開始追蹤：${to}`;
  const from = labels[event.from_status] ?? event.from_status;
  return `${from} → ${to}`;
}

/** 最新在上；同一時間的紀錄維持資料庫給的順序。 */
export function newestFirst(events: readonly ProgressEvent[]): ProgressEvent[] {
  return events
    .map((event, index) => ({ event, index, ms: Date.parse(event.created_at) }))
    .sort((a, b) => (Number.isFinite(b.ms) ? b.ms : 0) - (Number.isFinite(a.ms) ? a.ms : 0) || a.index - b.index)
    .map(x => x.event);
}
