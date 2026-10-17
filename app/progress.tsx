import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, shadow, space } from '@/src/theme/tokens';
import { Button, Chip, Empty, IconCircle, Screen, SectionTitle, T } from '@/src/ui';
import { ProgressStepper } from '@/src/components/ProgressStepper';
import { showMessage, confirmAction } from '@/src/lib/uiAlerts';
import { ProgressDashboard, ProgressStatusSelector, progressLabels, isClosedProgress, type ProgressStatus } from '@/src/components/ProgressDashboard';
import { planProgressRemoval, resetProgressFields } from '@/src/lib/progressRemoval';
import { ProgressNoteEditor } from '@/src/components/ProgressNoteEditor';
import { ProgressHistory } from '@/src/components/ProgressHistory';
import { hasUnsavedProgressNote } from '@/src/lib/progressNotes';
import { JobSearchField } from '@/src/components/JobSearchField';
import { FilterChips } from '@/src/components/FilterChips';
import { filterProgressRows, type ProgressView } from '@/src/lib/progressFilters';

export default function ProgressScreen() {
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const openedFromLink = useRef<string | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<ProgressView>('all');

  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (isCurrent()) setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('登入狀態尚未就緒。');
      const { data, error: queryError } = await supabase
        .from('saved_jobs')
        .select('id,job_post_id,status,notes,favorite,job_posts(id,job_title,display_company_name)')
        .eq('user_id', user.id).order('updated_at', { ascending: false });
      if (queryError) throw queryError;
      if (isCurrent()) setRows(data ?? []);
    } catch (e: any) {
      if (isCurrent()) {
        setError(e?.message ?? '無法讀取求職進度。');
        setRows([]);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setRows(null);
    void load(() => active);
    return () => { active = false; };
  }, [load, refresh]));

  // Opening progress from a report focuses that exact job instead of making
  // the user search through every application again.
  useEffect(() => {
    if (!jobId) { openedFromLink.current = null; return; }
    if (!rows || openedFromLink.current === jobId) return;
    const match = rows.find(row => row.job_post_id === jobId);
    if (!match || savingNote || updatingStatus) return;
    const previous = rows.find(row => row.id === openId);
    if (previous && hasUnsavedProgressNote(noteDraft, previous.notes)) return;
    openedFromLink.current = jobId;
    setOpenId(match.id);
    setNoteDraft(match.notes || '');
  }, [jobId, rows, openId, noteDraft, savingNote, updatingStatus]);

  async function saveNote(row: any) {
    if (savingNote) return;
    const savedText = noteDraft;
    setSavingNote(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('登入狀態已失效。');
      const { data: savedRow, error: saveError } = await supabase.from('saved_jobs')
        .update({ notes: savedText, updated_at: new Date().toISOString() })
        .eq('id', row.id).eq('user_id', user.id)
        .select('id').maybeSingle();
      if (saveError) throw saveError;
      if (!savedRow) throw new Error('找不到可儲存的求職紀錄，請重新整理。');
      setRows(prev => (prev ?? []).map(item => item.id === row.id ? { ...item, notes: savedText } : item));
      showMessage('已儲存', '求職筆記已更新。');
    } catch (e: any) {
      showMessage('筆記儲存失敗', e?.message ?? '請稍後再試，輸入內容仍保留。');
    } finally { setSavingNote(false); }
  }

  function selectRow(row: any) {
    if (savingNote || updatingStatus) return;
    const nextId = openId === row.id ? null : row.id;
    const previous = (rows ?? []).find(item => item.id === openId);
    const switchTo = () => {
      setOpenId(nextId);
      setNoteDraft(nextId ? row.notes || '' : '');
    };
    if (previous && hasUnsavedProgressNote(noteDraft, previous.notes)) {
      confirmAction('有尚未儲存的筆記', '切換職缺會放棄目前未儲存的文字。要繼續嗎？', switchTo, true);
      return;
    }
    switchTo();
  }

  async function setStatus(row: any, status: ProgressStatus) {
    if (row.status === status || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('登入狀態已失效。');
      const { data, error: updateError } = await supabase.from('saved_jobs')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', row.id).eq('user_id', user.id)
        .select('id').maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error('沒有找到可以更新的求職紀錄。');
      setRows(prev => (prev ?? []).map(item => item.id === row.id ? { ...item, status } : item));
    } catch (e: any) {
      showMessage('狀態沒有更新', e?.message ?? '請稍後再試。');
    } finally {
      setUpdatingStatus(false);
    }
  }

  function confirmRemove(row: any) {
    const isFavorite = row.favorite === true;
    confirmAction(
      isFavorite ? '重設這份職缺的求職進度？' : '移除這份職缺的求職進度？',
      isFavorite
        ? '這份職缺仍在收藏中。會清除求職筆記，將狀態重設為「收藏」，不會刪除書籤或體檢報告。'
        : '會刪除這份職缺的求職進度與筆記，體檢報告仍保留。',
      () => {
        void (async () => {
          try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error('登入狀態已失效。');
            // Read the latest favorite value to prevent an old screen snapshot
            // from deleting a bookmark that was added in another tab.
            const { data: current, error: readError } = await supabase.from('saved_jobs')
              .select('id,favorite').eq('id', row.id).eq('user_id', user.id).maybeSingle();
            if (readError) throw readError;
            if (!current) throw new Error('找不到這筆求職紀錄，請重新整理。');
            if (planProgressRemoval(current.favorite === true) === 'reset_to_bookmark') {
              const { data, error } = await supabase.from('saved_jobs')
                .update(resetProgressFields(new Date().toISOString()))
                .eq('id', row.id).eq('user_id', user.id).eq('favorite', true)
                .select('id').maybeSingle();
              if (error) throw error;
              if (!data) throw new Error('收藏狀態已變更，請重新整理後再試。');
            } else {
              const { data, error } = await supabase.from('saved_jobs')
                .delete().eq('id', row.id).eq('user_id', user.id).eq('favorite', false)
                .select('id').maybeSingle();
              if (error) throw error;
              if (!data) throw new Error('收藏狀態已變更，請重新整理後再試。');
            }
            setOpenId(null);
            setNoteDraft('');
            await load();
          } catch (e: any) {
            showMessage('無法移除進度', e?.message ?? '請稍後再試。');
          }
        })();
      },
      true
    );
  }

  const visible = useMemo(() => filterProgressRows(rows ?? [], search, stage), [rows, search, stage]);
  const active = visible.filter((r) => !isClosedProgress(r.status));
  const ended = visible.filter((r) => isClosedProgress(r.status));

  function changeFilters(nextSearch: string, nextStage: ProgressView) {
    const current = (rows ?? []).find(item => item.id === openId);
    const nextVisible = filterProgressRows(rows ?? [], nextSearch, nextStage);
    const hidesCurrent = current && !nextVisible.some(item => item.id === current.id);
    const apply = () => {
      setSearch(nextSearch);
      setStage(nextStage);
      if (hidesCurrent) { setOpenId(null); setNoteDraft(''); }
    };
    if (hidesCurrent && hasUnsavedProgressNote(noteDraft, current.notes)) {
      confirmAction('有尚未儲存的筆記', '切換篩選會收合目前職缺並放棄未儲存文字，確定繼續嗎？', apply, true);
      return;
    }
    apply();
  }

  function renderRow(row: any) {
    const open = openId === row.id;
    const closed = isClosedProgress(row.status);
    const label = progressLabels[row.status as ProgressStatus] || row.status;
    return (
      <View key={row.id} style={[styles.card, closed && !open && styles.cardClosed]}>
        <Pressable
          style={styles.cardHead}
          onPress={() => selectRow(row)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <IconCircle icon="briefcase" coral={!closed} tone="neutral" />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="bodyStrong" numberOfLines={1}>{row.job_posts?.job_title || '未命名職缺'}</T>
            <T variant="caption" muted numberOfLines={1}>{row.job_posts?.display_company_name || '公司待確認'}</T>
          </View>
          <Chip tone={closed ? 'neutral' : row.status === 'interview_1' || row.status === 'interview_2' ? 'ok' : row.status === 'offer' ? 'caution' : 'coral'} label={label} />
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.placeholder} />
        </Pressable>

        {open ? (
          <View style={styles.panel}>
            <ProgressStepper status={row.status} />
            <View style={{ gap: space.sm }}>
              <T variant="captionStrong" muted>換到這一步</T>
              <ProgressStatusSelector value={row.status} disabled={updatingStatus}
                onChange={(next) => void setStatus(row, next)} />
            </View>
            <View style={styles.divider} />
            <ProgressNoteEditor value={noteDraft} original={row.notes}
              onChangeText={setNoteDraft} saving={savingNote}
              onSave={() => { void saveNote(row); }} />
            <View style={styles.divider} />
            <ProgressHistory savedJobId={row.id} refreshKey={row.status} />
            <View style={styles.actions}>
              <Pressable style={styles.linkButton} onPress={() => router.push(`/report/${row.job_post_id}`)} accessibilityRole="button">
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <T variant="captionStrong" color={colors.primary}>看體檢報告</T>
              </Pressable>
              <Pressable style={styles.linkButton} onPress={() => confirmRemove(row)} accessibilityRole="button">
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <T variant="captionStrong" color={colors.danger}>{row.favorite === true ? '重設進度' : '不再追蹤'}</T>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Screen>
      {!error && rows !== null && rows.length > 0 ? <ProgressDashboard rows={rows} /> : null}
      {!error && rows !== null && rows.length > 0 ? (
        <View style={styles.filters}>
          <JobSearchField value={search} onChangeText={(value) => changeFilters(value, stage)}
            placeholder="搜尋職稱、公司或筆記" />
          <FilterChips<ProgressView> value={stage} onChange={(value) => changeFilters(search, value)}
            options={[
              { value: 'all', label: '全部' },
              { value: 'active', label: '進行中' },
              { value: 'interview', label: '面試' },
              { value: 'offer', label: 'Offer' },
              { value: 'ended', label: '已結束' }
            ]} />
          {visible.length === 0 ? (
            <Empty icon="search" title="沒有符合條件的求職紀錄" body="換個關鍵字或篩選階段看看。"
              action={<Button compact variant="soft" label="清除篩選" onPress={() => changeFilters('', 'all')} />} />
          ) : null}
        </View>
      ) : null}
      {error ? (
        <Empty icon="cloud-offline-outline" title="求職進度暫時讀不到" body={error}
          action={<Button compact variant="soft" icon="refresh" label="重新整理" onPress={() => setRefresh(n => n + 1)} />} />
      ) : null}
      {!error && rows === null ? [0, 1].map(i => <View key={i} style={styles.skeleton} />) : null}
      {!error && rows !== null && rows.length === 0 ? (
        <Empty icon="checkmark-done" title="還沒有追蹤的工作"
          body="在體檢報告下方按「加入求職追蹤」，就能在這裡記下投遞、面試和結果。"
          action={<Button compact variant="soft" label="去我的職缺" onPress={() => router.push('/jobs')} />} />
      ) : null}

      {!error && active.length > 0 ? <SectionTitle title={`進行中 ${active.length}`} /> : null}
      {!error ? active.map(renderRow) : null}

      {!error && ended.length > 0 ? <SectionTitle title={`已結束 ${ended.length}`} /> : null}
      {!error ? ended.map(renderRow) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.md },
  skeleton: { height: 76, borderRadius: radius.xl, backgroundColor: colors.neutralSoft },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, ...shadow.card },
  cardClosed: { backgroundColor: colors.surfaceMuted, shadowOpacity: 0, elevation: 0 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14, minHeight: 72 },
  panel: { borderTopWidth: 1, borderTopColor: colors.line, padding: space.lg, gap: space.lg },
  divider: { height: 1, backgroundColor: colors.line },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }
});
