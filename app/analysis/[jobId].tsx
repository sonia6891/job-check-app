import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { paymentsEnabled, readQuotaHit, type QuotaHit } from '@/src/lib/plan';
import { api } from '@/src/lib/api';
import { supabase } from '@/src/lib/supabase';
import { colors, space } from '@/src/theme/tokens';
import { Button, Notice, Screen, Surface, T } from '@/src/ui';
import { classifyAnalysisOutcome, isConnectionFailure, recoveredRunState, type RecoveredRunState } from '@/src/lib/analysisOutcome';

const RECOVERY_WINDOW_MS = 180_000;
const RECOVERY_INTERVAL_MS = 3_000;
import { AnalysisStepCard } from '@/src/components/AnalysisStepCard';

const labels: Record<string, string> = {
  resolve_company: '找出是哪家公司',
  official_records: '查政府違規紀錄',
  build_report: '整理成報告'
};

export default function AnalysisScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [current, setCurrent] = useState('resolve_company');
  const [steps, setSteps] = useState<Record<string, any>>({ resolve_company: 'running', official_records: 'pending', build_report: 'pending' });
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<string>('running');
  const [quotaExceeded, setQuotaExceeded] = useState<QuotaHit | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const ordered = useMemo(() => ['resolve_company', 'official_records', 'build_report'], []);

  useEffect(() => {
    let active = true;
    let polling = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    setDone(false);
    setQuotaExceeded(null);
    setAnalysisError(null);
    setStatus('running');
    setCurrent('resolve_company');
    setSteps({ resolve_company: 'running', official_records: 'pending', build_report: 'pending' });

    async function poll() {
      if (!active || polling || !jobId) return;
      polling = true;
      try {
        const { data, error } = await supabase.from('analysis_runs')
          .select('status,current_step,steps').eq('job_post_id', jobId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (error || !active || !data) return;
        // Progress snapshots may arrive after the function response.
        // They should update the steps only, not overwrite the final error/quota status.
        setCurrent(data.current_step || 'resolve_company');
        setSteps(data.steps || {});
      } catch {
        // Polling is best-effort; the Edge Function response is authoritative.
      } finally {
        polling = false;
      }
    }

    async function latestRun() {
      const { data, error } = await supabase.from('analysis_runs')
        .select('id,status,current_step,steps').eq('job_post_id', jobId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    }

    // The connection dropped but the Edge Function may still finish on the server.
    async function waitForServerResult(baselineRunId: string | null): Promise<RecoveredRunState | 'timeout'> {
      const deadline = Date.now() + RECOVERY_WINDOW_MS;
      while (active && Date.now() < deadline) {
        try {
          const run = await latestRun();
          if (!active) break;
          const state = recoveredRunState(run, baselineRunId);
          if (run && state !== 'pending') {
            setSteps(run.steps || {});
            return state;
          }
        } catch {
          // Still offline; keep checking until the window closes.
        }
        await new Promise((resolve) => setTimeout(resolve, RECOVERY_INTERVAL_MS));
      }
      return 'timeout';
    }

    async function run() {
      if (!jobId) {
        setStatus('failed');
        setAnalysisError('找不到這份職缺，請回職缺列表重新開啟。');
        return;
      }
      let baselineRunId: string | null = null;
      let baselineKnown = false;
      try {
        baselineRunId = (await latestRun())?.id ?? null;
        baselineKnown = true;
      } catch {
        // Without a baseline an older run could be mistaken for this attempt, so no recovery.
      }
      timer = setInterval(() => { void poll(); }, 1200);
      try {
        const result = await api.runAnalysis(jobId);
        if (!active) return;
        const outcome = classifyAnalysisOutcome(result, jobId);
        if (outcome.ready) {
          setStatus(outcome.status);
          setDone(true);
        } else {
          setStatus('failed');
          setDone(false);
          setAnalysisError(outcome.message);
        }
        if (result.steps) setSteps(result.steps);
      } catch (e: any) {
        if (!active) return;
        const code = e?.payload?.error;
        if (code === 'analysis_quota_exceeded') {
          setQuotaExceeded(readQuotaHit(e?.payload));
          setStatus('quota_exceeded');
        } else if (baselineKnown && isConnectionFailure(e)) {
          setStatus('recovering');
          const recovered = await waitForServerResult(baselineRunId);
          if (!active) return;
          if (recovered === 'completed' || recovered === 'partial') {
            setStatus(recovered);
            setDone(true);
          } else {
            setStatus('failed');
            setAnalysisError(recovered === 'failed'
              ? '這次分析沒有完成，職缺內容已保存，可以重新體檢。'
              : '網路連線中斷，暫時沒有收到體檢結果。職缺內容已保存，可以稍後到體檢紀錄查看，或重新體檢。');
          }
        } else {
          setStatus('failed');
          setAnalysisError(e?.message ?? '這次分析沒有完成，請稍後再試。');
        }
      } finally {
        if (timer) clearInterval(timer);
        if (active) await poll();
      }
    }

    void run();
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [jobId, attempt]);

  // 只顯示真實完成的流程步數，不用假百分比冒充即時進度。
  const completedSteps = 1 + ['resolve_company', 'official_records', 'build_report']
    .filter((key) => {
      const value = steps[key];
      const state = typeof value === 'string' ? value : value?.status;
      return ['completed', 'partial', 'skipped'].includes(state);
    }).length;

  function retry() {
    setDone(false);
    setQuotaExceeded(null);
    setAnalysisError(null);
    setStatus('running');
    setCurrent('resolve_company');
    setSteps({ resolve_company: 'running', official_records: 'pending', build_report: 'pending' });
    setAttempt((n) => n + 1);
  }

  function stepStatus(key: string) {
    const value = steps[key];
    return typeof value === 'string' ? value : value?.status;
  }

  // 跑完但沒有完整結果的步驟（官方紀錄查詢失敗或只查到一部分），用警示圖示而不是打勾。
  function stepWarning(key: string) {
    const s = stepStatus(key);
    if (key === 'official_records') return s === 'failed' || s === 'partial';
    if (key === 'resolve_company') {
      const match = steps.resolve_company?.match_status;
      return s === 'completed' && Boolean(match) && match !== 'confirmed';
    }
    return false;
  }

  function stepHint(key: string, s: string | undefined, running: boolean, complete: boolean, stopped: boolean) {
    if (key === 'resolve_company' && stepWarning(key)) return '還不能確定是哪一家公司，可以在報告裡選擇實際雇主';
    if (key === 'official_records' && s === 'failed') return '這次沒有查到，報告會標示「查詢失敗」並可重新查詢';
    if (key === 'official_records' && s === 'partial') return '部分資料集沒有查到，報告會標示結果不完整';
    if (s === 'skipped') return '公司尚未確認，已略過官方紀錄關聯';
    if (running) return '處理中…';
    if (complete) return '已完成';
    return stopped ? '尚未執行' : '等待中';
  }

  const stopped = Boolean(quotaExceeded) || status === 'failed';
  const progress = done ? 1 : completedSteps / 4;
  const R = 68, C = 2 * Math.PI * R;

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.ring} accessible accessibilityLabel={done ? '分析已完成' : `已完成 ${completedSteps} / 4 步`}>
          <Svg width={150} height={150} viewBox="0 0 150 150">
            <Circle cx={75} cy={75} r={R} stroke={colors.neutralSoft} strokeWidth={10} fill="none" />
            <Circle cx={75} cy={75} r={R} stroke={stopped ? colors.warningIcon : colors.primary} strokeWidth={10} fill="none"
              strokeLinecap="round" strokeDasharray={`${C * progress} ${C}`} transform="rotate(-90 75 75)" />
          </Svg>
          <View style={styles.ringInner}>
            <Ionicons name={done ? 'checkmark' : stopped ? 'alert' : 'search'} size={44} color={stopped ? colors.warningIcon : colors.primary} />
          </View>
        </View>
        <T variant="title" style={styles.center} accessibilityRole="header">
          {done ? (status === 'partial' ? '好了，部分資料沒查到' : '好了，報告整理完成') : quotaExceeded ? '這個月的檢查次數用完了' : status === 'failed' ? '這次沒有檢查完' : status === 'recovering' ? '連線中斷，正在確認結果…' : '正在幫你看這份工作…'}
        </T>
        <T variant="caption" muted style={styles.center}>
          {status === 'recovering' ? '可能已經在伺服器完成了，正在確認，請先不要離開。' : done ? '公司、官方紀錄、薪資和工時都整理好了。' : stopped ? '職缺內容已經保存，不用重新貼。' : '大約 20 秒。公司還沒確認前，不會把別家公司的紀錄算進來。'}
        </T>
      </View>

      <Surface style={{ borderRadius: 26, paddingVertical: 6 }}>
        <AnalysisStepCard title="讀懂職缺內容" hint="職缺沒寫的資訊會標成未知，不會亂猜" state="done" number={1} />
        {ordered.map((key, index) => {
          const s = stepStatus(key);
          const complete = s === 'completed' || s === 'skipped' || s === 'partial' || s === 'failed';
          const warning = complete && stepWarning(key);
          const running = current === key && !complete && !stopped;
          return (
            <AnalysisStepCard key={key} number={index + 2} title={labels[key]} last={index === ordered.length - 1}
              hint={stepHint(key, s, running, complete, stopped)}
              state={warning ? 'warning' : s === 'failed' ? 'warning' : complete ? 'done' : running ? 'running' : 'pending'} />
          );
        })}
      </Surface>

      {done ? <Button label="看體檢報告" icon="arrow-forward" onPress={() => router.replace(`/report/${jobId}`)} /> : null}
      {done && status === 'partial' ? (
        <Notice tone="caution">有步驟沒有取得資料，報告會照常顯示，並標明缺少哪些項目。</Notice>
      ) : null}

      {quotaExceeded ? (
        <View style={{ gap: space.md }}>
          {quotaExceeded.pro ? (
            <Notice tone="info" title={`這個月的 ${quotaExceeded.limit} 次檢查用完了`}>
              {`為了防止濫用，Pro 每月最多檢查 ${quotaExceeded.limit} 份職缺，下個月 1 日恢復。同一份職缺當月重新檢查不會重複算，這份職缺已經存在「我的職缺」。`}
            </Notice>
          ) : (
            <Notice tone="info" title={`這個月的 ${quotaExceeded.limit} 次免費檢查用完了`}>
              {`${paymentsEnabled ? '升級 Pro 就能繼續檢查；也可以' : '可以'}等下個月 1 日恢復。同一份職缺當月重新檢查不會重複算，這份職缺已經存在「我的職缺」。`}
            </Notice>
          )}
          {paymentsEnabled && !quotaExceeded.pro ? <Button icon="sparkles" label="升級 Pro・增加每月額度" onPress={() => router.push('/plans')} /> : null}
          <Button variant="soft" label="回我的職缺" onPress={() => router.replace('/jobs')} />
        </View>
      ) : null}

      {!done && !quotaExceeded && status === 'failed' ? (
        <View style={{ gap: space.md }}>
          <Notice tone="caution" title="檢查沒有完成">{analysisError || '職缺內容已保存，可以重試，不用重新輸入。'}</Notice>
          <Button label="重新檢查" icon="refresh" onPress={retry} />
          <Button variant="outline" label="回我的職缺" onPress={() => router.replace('/jobs')} />
        </View>
      ) : null}

      {!done && !stopped ? (
        <View style={styles.tip}>
          <View style={styles.tipIcon}><Ionicons name="bulb" size={20} color={colors.text} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="captionStrong" color={colors.warning}>你知道嗎？</T>
            <T variant="caption" color={colors.textBody}>勞基法規定每 7 天要有 2 天休假，一個月大約 8 天。</T>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.lg, paddingHorizontal: space.sm },
  center: { textAlign: 'center' },
  ring: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  ringInner: { position: 'absolute', width: 104, height: 104, borderRadius: 52, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.accentSoft, borderRadius: 22, padding: 14 },
  tipIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }
});
