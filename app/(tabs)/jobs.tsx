import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import type { JobCardData } from '@/src/components/JobCard';
import { progressLabels, progressSummary, type ProgressStatus } from '@/src/components/ProgressDashboard';
import { filterAndSortJobs, type JobSort } from '@/src/lib/jobFilters';
import { attachTracking, isEnded, matchesView, relativeDay, viewCounts, type MyJobView, type TrackRow } from '@/src/lib/myJobs';
import { showMessage } from '@/src/lib/uiAlerts';
import { colors, radius, shadow, space, type Tone } from '@/src/theme/tokens';
import { Button, Chip, Empty, FocusStatusBar, Num, Screen, Segmented, T } from '@/src/ui';

type JobRow = JobCardData & { created_at: string | null };

const statusStyle: Record<ProgressStatus, { tone: Tone }> = {
  saved: { tone: 'neutral' },
  applied: { tone: 'info' },
  interview_1: { tone: 'ok' },
  interview_2: { tone: 'ok' },
  offer: { tone: 'caution' },
  accepted: { tone: 'ok' },
  rejected: { tone: 'neutral' },
  withdrawn: { tone: 'neutral' }
};

export default function JobsScreen() {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [view, setView] = useState<MyJobView>('all');
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<JobSort>('newest');

  useFocusEffect(useCallback(() => {
    let active = true;
    setError(null);
    setJobs(null);
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('登入狀態尚未就緒。');
        const [jobRes, trackRes] = await Promise.all([
          supabase.from('job_posts')
            .select('id,job_title,display_company_name,salary_raw,location_raw,created_at')
            // 還沒解析完的上傳列（中途失敗留下的）沒有內容，不列出來。
            .eq('user_id', user.id).neq('parse_status', 'uploaded').order('created_at', { ascending: false }),
          // 收藏與求職進度共用 saved_jobs；收藏篩選只看 favorite === true 的列。
          supabase.from('saved_jobs')
            .select('job_post_id,status,favorite,updated_at').eq('user_id', user.id)
        ]);
        if (jobRes.error) throw jobRes.error;
        if (trackRes.error) throw trackRes.error;
        if (!active) return;
        setJobs((jobRes.data ?? []) as JobRow[]);
        setTracks((trackRes.data ?? []) as TrackRow[]);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? '讀取職缺失敗，請重新整理。');
        setJobs([]);
        setTracks([]);
      }
    })();
    return () => { active = false; };
  }, [reload]));

  const merged = useMemo(() => jobs === null ? null : attachTracking(jobs, tracks), [jobs, tracks]);
  const counts = useMemo(() => viewCounts((merged ?? []).map(j => j.track)), [merged]);
  const summary = useMemo(() => progressSummary(tracks), [tracks]);
  const favoriteIds = useMemo(() => tracks.filter(t => t.favorite === true).map(t => t.job_post_id), [tracks]);
  const visible = useMemo(() => {
    if (!merged) return null;
    return filterAndSortJobs(merged.filter(j => matchesView(j.track, view)), query, 'all', favoriteIds, sort);
  }, [merged, view, query, favoriteIds, sort]);

  function openCompare() {
    if (favoriteIds.length < 2) {
      showMessage('先收藏兩份以上', '在體檢報告下方按「收藏」，收藏兩份以上的職缺就能並排比較。');
      return;
    }
    router.push('/compare?source=saved');
  }

  const header = (
    <View style={styles.header}>
      <FocusStatusBar style="dark" />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="display" accessibilityRole="header">我的職缺</T>
        <T variant="caption" muted>{jobs === null ? '讀取中…' : `${jobs.length} 份檢查過的工作，${counts.tracking} 份正在追蹤`}</T>
      </View>
      <Button compact variant="soft" icon="git-compare" label="比較" accessibilityLabel="比較收藏的職缺" onPress={openCompare} />
    </View>
  );

  const stats: Array<{ label: string; value: number; color: string }> = [
    { label: '追蹤中', value: summary.active, color: colors.primary },
    { label: '面試中', value: summary.interviewing, color: colors.success },
    { label: 'Offer', value: summary.offers, color: colors.warning },
    { label: '已結束', value: summary.ended, color: colors.textMuted }
  ];

  return (
    <Screen safeTop tabBar header={header}>
      <View style={styles.stats}>
        {stats.map(s => (
          <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.label} ${s.value} 份`}>
            <Num size={22} color={s.color}>{s.value}</Num>
            <T variant="caption" muted>{s.label}</T>
          </View>
        ))}
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="搜尋職稱、公司、地點" placeholderTextColor={colors.placeholder}
          accessibilityLabel="搜尋我的職缺" style={styles.searchInput} returnKeyType="search" />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="清除搜尋" onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.placeholder} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: space.sm, marginHorizontal: -space.xs }}>
        <Segmented<MyJobView> value={view} onChange={setView} options={[
          { value: 'all', label: '全部', count: counts.all },
          { value: 'tracking', label: '追蹤中', count: counts.tracking },
          { value: 'favorite', label: '收藏', count: counts.favorite },
          { value: 'ended', label: '已結束', count: counts.ended }
        ]} />
        <View style={styles.sortRow}>
          <T variant="small" muted>排序</T>
          {([['newest', '最新'], ['oldest', '最舊'], ['company', '公司名稱']] as Array<[JobSort, string]>).map(([value, label]) => (
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: sort === value }} onPress={() => setSort(value)} hitSlop={6}>
              <T variant={sort === value ? 'captionStrong' : 'caption'} color={sort === value ? colors.primary : colors.textMuted}>{label}</T>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? (
        <Empty icon="cloud-offline-outline" title="讀不到我的職缺" body={error}
          action={<Button compact variant="soft" icon="refresh" label="重新整理" onPress={() => setReload(n => n + 1)} />} />
      ) : visible === null ? (
        [0, 1, 2].map(i => <View key={i} style={styles.skeleton} />)
      ) : visible.length === 0 ? (
        <Empty icon={query.trim() ? 'search' : 'briefcase'}
          title={query.trim() ? '沒有符合搜尋的職缺' : view === 'favorite' ? '還沒有收藏的職缺' : view === 'tracking' ? '還沒有追蹤中的職缺' : view === 'ended' ? '還沒有結束的應徵' : '還沒有檢查過的工作'}
          body={query.trim() ? '換個關鍵字，或清除搜尋。' : view === 'all' ? '回到「體檢」貼上第一份職缺。' : '在體檢報告下方按書籤或「加入求職追蹤」，就會出現在這裡。'}
          action={<Button compact variant="soft" label={query.trim() ? '清除搜尋' : '去體檢'} onPress={() => query.trim() ? setQuery('') : router.push('/')} />} />
      ) : (
        <View style={{ gap: 10 }}>
          {visible.map(job => {
            const status = (job.track?.status || 'saved') as ProgressStatus;
            const style = job.track ? statusStyle[status] ?? statusStyle.saved : null;
            const ended = isEnded(job.track);
            const day = relativeDay(job.created_at, new Date());
            return (
              <View key={job.id} style={[styles.card, ended && styles.cardEnded]}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={`查看體檢報告：${job.job_title || '未命名職缺'}，${job.display_company_name || '公司待確認'}，${job.track ? progressLabels[status] ?? '追蹤中' : '未追蹤'}`}
                  onPress={() => router.push(`/report/${job.id}`)}
                  style={({ pressed }) => [styles.cardMain, pressed && { opacity: 0.85 }]}>
                  <View style={styles.cardTop}>
                    <Chip tone={style?.tone ?? 'neutral'} label={job.track ? progressLabels[status] ?? '追蹤中' : '未追蹤'} />
                    {day ? <T variant="small" muted>{day}檢查</T> : null}
                    <View style={{ flex: 1 }} />
                    {job.track?.favorite ? <Ionicons name="bookmark" size={18} color={colors.primary} accessibilityLabel="已收藏" /> : null}
                  </View>
                  <View style={{ gap: 1 }}>
                    <T variant="subhead" numberOfLines={2}>{job.job_title || '未命名職缺'}</T>
                    <T variant="caption" muted numberOfLines={1}>{[job.display_company_name || '公司待確認', job.location_raw].filter(Boolean).join('・')}</T>
                  </View>
                  <T variant="captionStrong" color={job.salary_raw ? colors.text : colors.placeholder} numberOfLines={1}
                    style={job.track && !ended ? { paddingRight: 90 } : null}>{job.salary_raw || '薪資沒寫'}</T>
                </Pressable>
                {job.track && !ended ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`更新「${job.job_title || '這份職缺'}」的求職進度`} hitSlop={8}
                    onPress={() => router.push(`/progress?jobId=${encodeURIComponent(job.id)}`)} style={styles.progressLink}>
                    <T variant="captionStrong" color={colors.primary}>更新進度</T>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: 20, paddingBottom: space.lg },
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 26, paddingVertical: 16, paddingHorizontal: 8, ...shadow.card },
  stat: { flex: 1, alignItems: 'center', gap: 0 },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, minHeight: 48, borderWidth: 1.5, borderColor: colors.line },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: space.sm },
  skeleton: { height: 120, borderRadius: 22, backgroundColor: colors.neutralSoft },
  card: { backgroundColor: colors.surface, borderRadius: 22, ...shadow.card },
  cardEnded: { backgroundColor: colors.surfaceMuted, shadowOpacity: 0, elevation: 0 },
  cardMain: { padding: space.lg, gap: space.sm, borderRadius: 22 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  progressLink: { position: 'absolute', right: 12, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 1, minHeight: 32, paddingHorizontal: 4 }
});
