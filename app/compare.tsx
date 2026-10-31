import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, space } from '@/src/theme/tokens';
import { Button, CardGrid, columnsFor, Empty, Notice, Screen, SectionTitle, T, useLayout } from '@/src/ui';
import { showMessage } from '@/src/lib/uiAlerts';
import { CompareTable, type CompareJob } from '@/src/components/JobCompareResultCard';
import { chooseSavedForComparison } from '@/src/lib/compareSelection';
import { validateCompareResults } from '@/src/lib/compareValidation';
import { paymentsEnabled, usePlan } from '@/src/lib/plan';

export default function CompareScreen() {
  const { readingWidth } = useLayout();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [ready, setReady] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<CompareJob[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const requestVersion = useRef(0);
  const plan = usePlan();

  useFocusEffect(useCallback(() => {
    let active = true;
    requestVersion.current += 1;
    setBusy(false);
    setReady(false);
    setLoadError(null);
    setCompareError(null);
    setResult(null);
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('登入狀態尚未就緒，請重新整理。');
        const savedRes = source === 'saved'
          ? await supabase.from('saved_jobs').select('job_post_id').eq('user_id', user.id)
              .eq('favorite', true).order('updated_at', { ascending: false }).limit(20)
          : { data: [] as { job_post_id: string }[], error: null };
        if (savedRes.error) throw savedRes.error;
        const savedIds = (savedRes.data ?? []).map(row => row.job_post_id);
        const jobQuery = supabase.from('job_posts')
          .select('id,job_title,display_company_name,salary_raw')
          .eq('user_id', user.id);
        // Compare the user's actual bookmarked jobs, not only the 20 newest jobs.
        const jobRes = source === 'saved'
          ? savedIds.length ? await jobQuery.in('id', savedIds) : { data: [], error: null }
          : await jobQuery.order('created_at', { ascending: false }).limit(20);
        if (jobRes.error) throw jobRes.error;
        if (!active) return;
        setReady(true);
        const list = jobRes.data ?? [];
        const order = new Map(savedIds.map((id, index) => [id, index]));
        const sorted = source === 'saved'
          ? [...list].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity))
          : list;
        setJobs(sorted);
        const visibleIds = new Set(sorted.map(j => j.id));
        if (source === 'saved') {
          setSelected(chooseSavedForComparison(savedIds, [...visibleIds]));
        } else {
          setSelected(prev => prev.filter(id => visibleIds.has(id)));
        }
      } catch (e: any) {
        if (!active) return;
        setLoadError(e?.message ?? '無法取得你的職缺資料，請稍後重試。');
      }
    })();
    return () => { active = false; requestVersion.current += 1; };
  }, [refreshCount, source]));

  // 從方案頁買完回來要馬上看到 Pro。
  const refreshPlan = plan.refresh;
  useFocusEffect(useCallback(() => { void refreshPlan(); }, [refreshPlan]));

  function toggle(id: string) {
    if (busy) return;
    requestVersion.current += 1;
    setCompareError(null);
    setResult(null);
    setSelected((v) => (v.includes(id) ? v.filter((x) => x !== id) : v.length < 5 ? [...v, id] : v));
  }

  async function compare() {
    if (busy) return;
    if (selected.length < 2) return showMessage('至少選 2 份職缺');
    const request = ++requestVersion.current;
    const selectedSnapshot = [...selected];
    setBusy(true);
    setCompareError(null);
    setResult(null);
    try {
      const response = await api.compareJobs(selectedSnapshot);
      if (request === requestVersion.current) setResult(validateCompareResults(response, selectedSnapshot));
    } catch (e: any) {
      if (request !== requestVersion.current) return;
      setCompareError(e?.message ?? '暫時無法完成比較，請稍後再試。');
    } finally {
      if (request === requestVersion.current) setBusy(false);
    }
  }

  if (loadError) {
    return (
      <Screen>
        <Empty icon="cloud-offline-outline" title="暫時讀不到職缺" body={loadError}
          action={<Button compact variant="soft" icon="refresh" label="重新整理" onPress={() => setRefreshCount((n) => n + 1)} />} />
      </Screen>
    );
  }

  if (!ready || plan.loading) {
    return <Screen>{[0, 1, 2].map(i => <View key={i} style={styles.skeleton} />)}</Screen>;
  }

  // 並排比較是 Pro 功能；後端 compare-jobs 也會檢查，這裡先說明並引導升級。
  // 讀不到方案時不先擋，交給後端判斷，免得 Pro 使用者因為網路問題被鎖住。
  // Android 還不能購買，只說明之後開放，不放升級按鈕。
  if (!plan.pro && !plan.error) {
    return (
      <Screen>
        <Empty icon="sparkles" title="並排比較是 Pro 功能"
          body={paymentsEnabled
            ? '把 2～5 份職缺的薪資、工時、休假和公司紀錄排在一起看，一眼找出哪份比較好。升級 Pro 可增加每月職缺體檢額度，詳細內容請查看方案頁。'
            : '把 2～5 份職缺的薪資、工時、休假和公司紀錄排在一起看。Android 版的 Pro 方案之後開放。'}
          action={paymentsEnabled ? <Button icon="sparkles" label="看 Pro 方案" onPress={() => router.push('/plans')} /> : undefined} />
      </Screen>
    );
  }

  if (jobs.length < 2) {
    return (
      <Screen>
        <Empty icon="git-compare" title="至少要 2 份職缺"
          body={source === 'saved' ? `目前收藏了 ${jobs.length} 份。在體檢報告下方按書籤，收藏兩份以上就能比較。` : `目前有 ${jobs.length} 份。再檢查一份職缺，就能在這裡並排比較。`}
          action={<Button compact variant="soft" label={source === 'saved' ? '去我的職缺' : '去體檢'} onPress={() => router.push(source === 'saved' ? '/jobs' : '/')} />} />
      </Screen>
    );
  }

  return (
    <Screen>
      <T variant="caption" muted style={{ paddingHorizontal: space.xs }}>{source === 'saved' ? '從收藏裡挑 2–5 份，並排看條件。' : '挑 2–5 份檢查過的工作，並排看條件。'}</T>

      <CardGrid columns={columnsFor(readingWidth, 280, 10, 2)} gap={10}>
        {jobs.map((j) => {
          const on = selected.includes(j.id);
          const full = !on && selected.length >= 5;
          return (
            <Pressable
              key={j.id}
              onPress={() => toggle(j.id)}
              disabled={full || busy}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: full || busy }}
              style={[styles.job, styles.jobFill, on && styles.jobSelected, full && { opacity: 0.5 }]}
            >
              <View style={[styles.check, on && styles.checkOn]}>{on ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}</View>
              <View style={{ flex: 1, gap: 1 }}>
                <T variant="bodyStrong" numberOfLines={1}>{j.job_title || '未命名職缺'}</T>
                <T variant="caption" muted numberOfLines={1}>{[j.display_company_name || '公司待確認', j.salary_raw].filter(Boolean).join('・')}</T>
              </View>
            </Pressable>
          );
        })}
      </CardGrid>

      <Button icon="git-compare" label={`開始比較（${selected.length}/5）`} loading={busy}
        disabled={selected.length < 2} onPress={() => { void compare(); }} />
      {compareError ? (
        <Notice tone="caution" title="比較暫時失敗">
          <T variant="caption" color={colors.textBody}>{compareError}</T>
          <Button compact variant="white" icon="refresh" label="重新比較" onPress={() => { void compare(); }} />
        </Notice>
      ) : null}

      {result ? (
        <View style={{ gap: space.md }}>
          <SectionTitle title="比較結果" />
          <CompareTable jobs={result} onOpen={(id) => router.push(`/report/${id}`)} />
          <Notice tone="info">各職缺的薪資口徑（月薪／年薪／時薪）可能不同，這裡照原文並列、不換算；沒有官方紀錄不代表沒有違規。點職缺名稱可以看完整報告。</Notice>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { height: 64, borderRadius: radius.xl, backgroundColor: colors.neutralSoft },
  job: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  jobFill: { flexGrow: 1 },
  jobSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary }
});
