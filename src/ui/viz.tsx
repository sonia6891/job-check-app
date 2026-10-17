/**
 * 報告用的小圖表（溫暖友善版）。全部用 View 排版（不靠圖表套件），手機與網頁長得一樣。
 * 每張圖都附 accessibilityLabel，用文字說出圖上的數字。
 */
import { StyleSheet, View } from 'react-native';
import type { SalaryScale, ShiftBreakdown, ToneCounts } from '@/src/lib/reportVisuals';
import { colors, tone as toneStyles } from '@/src/theme/tokens';
import { Num, T } from './index';

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW');

/** 查核結果分段條：高風險／注意／正常／其他各佔幾格。 */
export function ToneBar({ counts }: { counts: ToneCounts }) {
  const parts = [
    { key: 'danger', n: counts.danger, color: colors.dangerFill, label: '地雷' },
    { key: 'caution', n: counts.caution, color: colors.accent, label: '要問清楚' },
    { key: 'ok', n: counts.ok, color: colors.success, label: '沒問題' },
    { key: 'other', n: counts.other, color: colors.lineStrong, label: '參考' }
  ].filter(p => p.n > 0);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`查核結果：${parts.map(p => `${p.label} ${p.n} 項`).join('、')}`} style={styles.toneBar}>
      {parts.map(p => <View key={p.key} style={{ flex: p.n, height: 10, borderRadius: 5, backgroundColor: p.color }} />)}
    </View>
  );
}

/**
 * 薪資刻度：一條圓胖的尺，珊瑚色小球是職缺薪資，白色刻線是基本工資與行情平均。
 * 低於基本工資的區段塗淺珊瑚色。
 */
export function SalaryScaleView({ scale }: { scale: SalaryScale }) {
  const pct = (at: number) => `${Math.max(0, Math.min(1, at)) * 100}%` as const;
  const minimum = scale.markers.find(m => m.key === 'minimum')!;
  const offer = scale.markers.find(m => m.key === 'offer')!;
  const top = scale.markers.find(m => m.key === 'offerMax');
  const refs = scale.markers.filter(m => m.key === 'minimum' || m.key === 'benchmark');
  const label = scale.markers.map(m => `${m.label} ${fmt(m.value)} 元`).join('，');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${scale.unit}刻度：${label}`} style={styles.scale}>
      <View style={styles.track}>
        <View style={[styles.trackBelow, { width: pct(minimum.at) }]} />
        {top ? <View style={[styles.band, { left: pct(offer.at), width: pct(top.at - offer.at) }]} /> : null}
        {refs.map(m => <View key={m.key} style={[styles.tick, { left: pct(m.at) }]} />)}
      </View>
      <View style={[styles.knobWrap, { left: pct(offer.at) }]}>
        <T variant="label" color={colors.primary} style={styles.center}>{top ? '職缺下限' : '你的薪水'}</T>
      </View>
      <View style={[styles.knob, { left: pct(offer.at) }]} />
      {top ? <View style={[styles.knob, styles.knobSmall, { left: pct(top.at) }]} /> : null}
      {refs.map(m => (
        <View key={m.key} style={[styles.refLabel, { left: pct(m.at) }]}>
          <T variant="label" color={m.key === 'minimum' ? colors.warning : colors.success} style={styles.center}>{m.label}</T>
          <Num size={11} weight="600" color={m.key === 'minimum' ? colors.warning : colors.success} style={styles.center}>{fmt(m.value)}</Num>
        </View>
      ))}
    </View>
  );
}

/** 一天的班表時間條：正常工時（珊瑚）、休息（淺珊瑚）、可能的加班（黃）。 */
export function ShiftBar({ shift }: { shift: ShiftBreakdown }) {
  const label = `在公司 ${shift.spanHours} 小時：正常工時 ${shift.normal} 小時${shift.rest ? `、休息約 ${shift.rest} 小時` : ''}${shift.extra ? `，另有約 ${shift.extra} 小時可能是加班` : ''}`;
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.rowBetween}>
        <Num size={13} weight="600" color={colors.textMuted}>{shift.start}</Num>
        <T variant="captionStrong">一天在公司 {shift.spanHours} 小時</T>
        <Num size={13} weight="600" color={colors.textMuted}>{shift.end}</Num>
      </View>
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.shiftBar}>
        <View style={{ flex: shift.normal, backgroundColor: colors.primary }} />
        {shift.rest ? <View style={{ flex: shift.rest, backgroundColor: colors.primarySoft }} /> : null}
        {shift.extra ? <View style={{ flex: shift.extra, backgroundColor: colors.accent }} /> : null}
      </View>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Legend color={colors.primary} label={`正常 ${shift.normal} 小時`} />
        {shift.rest ? <Legend color={colors.primarySoft} label="休息（假設）" /> : null}
        {shift.extra ? <Legend color={colors.accent} label={`可能加班 ${shift.extra} 小時`} /> : null}
      </View>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, dashed ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: color } : { backgroundColor: color }]} />
      <T variant="label" color={colors.textBody}>{label}</T>
    </View>
  );
}

/** 一個月的休假格子：綠色是職缺寫的休假，虛線框是依每 7 天休 2 天還少的天數。 */
export function DaysOffGrid({ off, expected }: { off: number; expected: number }) {
  const days = 30;
  const shortBy = Math.max(0, expected - off);
  // 休假平均分散在一個月裡，看起來像真的排班。
  const offDays = new Set(Array.from({ length: off }, (_, i) => Math.floor(((i + 0.5) * days) / Math.max(off, 1))));
  const missingDays = new Set<number>();
  for (let i = 0; i < shortBy; i += 1) {
    let d = Math.floor(((i + 0.25) * days) / Math.max(shortBy, 1));
    while (offDays.has(d) || missingDays.has(d)) d = (d + 1) % days;
    missingDays.add(d);
  }
  return (
    <View style={{ gap: 8 }}>
      <View accessible accessibilityRole="image" accessibilityLabel={`一個月約 ${days} 天，職缺寫休 ${off} 天；每 7 天休 2 天約 ${expected} 天，少 ${shortBy} 天`} style={styles.grid}>
        {Array.from({ length: days }, (_, d) => (
          <View key={d} style={[styles.cell, offDays.has(d) ? styles.cellOff : missingDays.has(d) ? styles.cellMissing : null]} />
        ))}
      </View>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Legend color={colors.success} label={`職缺寫的休假 ${off} 天`} />
        {shortBy ? <Legend color={colors.warningIcon} dashed label={`依每 7 天休 2 天約少 ${shortBy} 天`} /> : null}
      </View>
    </View>
  );
}

/** 細進度條（面試問題已問幾題、本月用了幾次）。 */
export function ProgressBar({ value, color = toneStyles.ok.bar, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={[styles.progress, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toneBar: { flexDirection: 'row', gap: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  scale: { height: 74, marginHorizontal: 18 },
  track: { position: 'absolute', left: 0, right: 0, top: 22, height: 14, borderRadius: 7, backgroundColor: colors.successSoft, overflow: 'hidden' },
  trackBelow: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primarySoft },
  band: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.primary, opacity: 0.25 },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 3, marginLeft: -1.5, backgroundColor: colors.surface },
  knobWrap: { position: 'absolute', top: 0, width: 80, marginLeft: -40 },
  knob: { position: 'absolute', top: 16, width: 26, height: 26, marginLeft: -13, borderRadius: 13, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.surface, shadowColor: '#8A5A2B', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  knobSmall: { top: 19, width: 20, height: 20, marginLeft: -10, borderRadius: 10, borderWidth: 3 },
  refLabel: { position: 'absolute', top: 42, width: 90, marginLeft: -45 },
  shiftBar: { flexDirection: 'row', height: 26, borderRadius: 10, overflow: 'hidden', gap: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 5 },
  cell: { width: '9.2%', aspectRatio: 1.45, borderRadius: 6, backgroundColor: colors.neutralSoft },
  cellOff: { backgroundColor: colors.success },
  cellMissing: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.warningIcon },
  progress: { backgroundColor: colors.neutralSoft, overflow: 'hidden' }
});
