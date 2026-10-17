import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import { progressLabels } from '@/src/components/ProgressDashboard';
import { describeProgressEvent, formatTaipeiTime, newestFirst, type ProgressEvent } from '@/src/lib/progressHistory';

/**
 * 這份職缺的狀態變動紀錄。資料由資料庫觸發器寫入，App 只讀。
 * refreshKey 變動（例如剛改完狀態）時重新讀取。
 */
export function ProgressHistory({ savedJobId, refreshKey }: { savedJobId: string; refreshKey?: string }) {
  const [events, setEvents] = useState<ProgressEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    supabase.from('saved_job_events')
      .select('from_status,to_status,created_at')
      .eq('saved_job_id', savedJobId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError('暫時無法讀取歷程。');
          setEvents([]);
        } else {
          setEvents(newestFirst((data ?? []) as ProgressEvent[]));
        }
      });
    return () => { active = false; };
  }, [savedJobId, refreshKey]);

  return (
    <View style={styles.box} accessibilityLabel="進度歷程">
      <Text style={styles.label}>進度紀錄</Text>
      {events === null ? <Text style={styles.muted}>讀取中…</Text> : null}
      {error ? <Text style={styles.muted}>{error}</Text> : null}
      {events !== null && !error && events.length === 0 ? <Text style={styles.muted}>還沒有紀錄，改變狀態後會記在這裡。</Text> : null}
      {(events ?? []).map((event, i) => (
        <View key={`${event.created_at}-${i}`} style={styles.row}>
          <View style={[styles.dot, i === 0 && styles.dotLatest]} />
          <Text style={[styles.text, i === 0 && styles.textLatest]}>{describeProgressEvent(event, progressLabels)}</Text>
          <Text style={styles.time}>{formatTaipeiTime(event.created_at)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  label: { color: colors.text, fontSize: 15, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  dotLatest: { backgroundColor: colors.primary },
  text: { flex: 1, color: colors.text, fontSize: 14 },
  textLatest: { fontWeight: '800' },
  time: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] }
});
