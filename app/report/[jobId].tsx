import { useCallback, useRef, useState, type ReactElement } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { supabase } from '@/src/lib/supabase';
import type { JobReport } from '@/src/types';
import { SalaryBenchmarkCard } from '@/src/components/SalaryBenchmarkCard';
import { MinimumWageNotice } from '@/src/components/MinimumWageNotice';
import { checkMinimumWage } from '@/src/lib/minimumWage';
import { officialRecordState } from '@/src/lib/officialRecordState';
import { WorkHoursNotice } from '@/src/components/WorkHoursNotice';
import { PostingRiskNotice } from '@/src/components/PostingRiskNotice';
import { checkWorkHours } from '@/src/lib/workHours';
import { hoursWithoutDaysOff } from '@/src/lib/hoursLabel';
import { buildReportShareText } from '@/src/lib/reportShare';
import { buildChecklist, friendlyVerdict, missingLabel, type CheckItem, type CheckKey } from '@/src/lib/reportSummary';
import { monthlyDaysOff, salaryScale, shiftBreakdown } from '@/src/lib/reportVisuals';
import { InterviewNotesList } from '@/src/components/InterviewNotesList';
import { OfficialRecordCard } from '@/src/components/OfficialRecordCard';
import { RiskHintCard } from '@/src/components/RiskHintCard';
import { EmployerPicker } from '@/src/components/EmployerPicker';
import { ShareCardSheet } from '@/src/components/ShareCardSheet';
import { buildShareCardItems } from '@/src/lib/shareCard';
import { favoriteUpdate } from '@/src/lib/favoriteChanges';
import { ensureTrackedJob } from '@/src/lib/jobTracking';
import { deleteJob } from '@/src/lib/jobs';
import { showMessage, confirmAction } from '@/src/lib/uiAlerts';
import { colors, radius, space, tone as toneStyles, type Tone } from '@/src/theme/tokens';
import { Button, Chip, Empty, FocusStatusBar, IconButton, IconCircle, Notice, Num, Screen, SectionTitle, Surface, T, type IconName } from '@/src/ui';
import { DaysOffGrid, SalaryScaleView, ShiftBar } from '@/src/ui/viz';

const lawNames: Record<string, string> = {
  labor_standards: '勞動基準法',
  employment_service: '就業服務法',
  gender_equality: '性別平等工作法',
  occupational_safety: '職業安全衛生',
  labor_pension: '勞工退休金',
  occupational_accident: '職災保險與保護'
};

const employmentLabels: Record<string, string> = {
  full_time: '全職', part_time: '兼職', contract: '約聘', internship: '實習', temporary: '臨時'
};

type Section = 'risks' | 'company' | 'records' | 'salary' | 'conditions' | 'interview';
type DetailSection = 'salary' | 'conditions' | 'company' | 'records';
const sectionFor: Record<CheckKey, Section> = {
  risks: 'risks', company: 'company', records: 'records', salary: 'salary',
  hours: 'conditions', conditions: 'conditions', missing: 'conditions'
};
const checkIcons: Record<CheckKey, IconName> = {
  risks: 'warning', company: 'business', records: 'shield-checkmark', salary: 'cash',
  hours: 'time', conditions: 'list', missing: 'help-circle'
};
const severity: Record<Tone, number> = { danger: 0, caution: 1, neutral: 2, info: 3, ok: 4 };

/** 細節區塊依查核結果排序：有問題的放前面，同等級維持固定順序。 */
function orderSections(items: readonly CheckItem[]): DetailSection[] {
  const worst = (section: DetailSection) => Math.min(5, ...items.filter(i => sectionFor[i.key] === section).map(i => severity[i.tone]));
  const order: DetailSection[] = ['salary', 'conditions', 'company', 'records'];
  return order.map((s, i) => ({ s, i, w: worst(s) })).sort((a, b) => a.w - b.w || a.i - b.i).map(x => x.s);
}

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW');

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function ReportScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [report, setReport] = useState<JobReport | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedReady, setSavedReady] = useState(false);
  const [savedBusy, setSavedBusy] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [correctedFields, setCorrectedFields] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<Section, number>>>({});
  const heroHeight = useRef(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setReport(null);
    setLoadError(null);
    setSaved(false);
    setSavedReady(false);
    setTracked(false);
    setCorrectedFields([]);
    setExpanded(false);
    setPickerOpen(false);
    setShareOpen(false);
    if (!jobId) {
      setLoadError('找不到這份職缺，請回職缺列表重新開啟。');
      return;
    }
    api.buildReport(jobId).then((nextReport) => {
      if (!nextReport || nextReport.job?.id !== jobId) throw new Error('報告資料不完整，請重新讀取。');
      if (active) setReport(nextReport);
    }).catch((error) => {
      if (active) setLoadError(error?.message || '請稍後再試。');
    });
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error('無法確認帳號身分。');
        const { data, error } = await supabase.from('saved_jobs')
          .select('id,favorite').eq('job_post_id', jobId)
          .eq('user_id', auth.user.id).maybeSingle();
        if (error) throw error;
        if (active) { setSaved(data?.favorite === true); setTracked(Boolean(data)); setSavedReady(true); }
      } catch (e: any) {
        if (active) showMessage('無法讀取收藏狀態', e?.message ?? '請重新開啟報告。');
      }
    })();
    supabase.from('job_posts').select('structured_data').eq('id', jobId).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const info = data?.structured_data as Record<string, unknown> | null | undefined;
        const revision = info?.manual_corrections as Record<string, unknown> | undefined;
        setCorrectedFields(Array.isArray(revision?.fields) ? revision.fields.filter((item): item is string => typeof item === 'string') : []);
      });
    // Ignore requests from a screen that lost focus or an earlier retry.
    return () => { active = false; };
  }, [jobId, retry]));

  async function shareReport() {
    if (!report) return;
    try {
      await Share.share({ message: buildReportShareText(report, new Date()), title: '職缺體檢摘要' });
    } catch {
      showMessage('無法分享', '這個裝置目前不支援分享，可以改用截圖傳送。');
    }
  }

  async function toggleSaved() {
    if (!savedReady || savedBusy || !jobId) return;
    setSavedBusy(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('登入狀態已失效。');
      const userId = auth.user.id;
      const { data: existing, error: lookupError } = await supabase.from('saved_jobs')
        .select('id,favorite').eq('user_id', userId).eq('job_post_id', jobId).maybeSingle();
      if (lookupError) throw lookupError;
      const nextFavorite = !saved;
      // Keep the row (and its interview status/notes) when removing a bookmark.
      // Removing the row would silently delete the user's job application progress.
      if (existing) {
        const { data, error } = await supabase.from('saved_jobs')
          .update(favoriteUpdate(nextFavorite, new Date().toISOString()))
          .eq('id', existing.id).eq('user_id', userId).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('收藏紀錄沒有更新，請稍後重試。');
      } else if (nextFavorite) {
        const { data, error } = await supabase.from('saved_jobs')
          .insert({ user_id: userId, job_post_id: jobId, favorite: true, status: 'saved' })
          .select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('收藏紀錄沒有建立，請稍後重試。');
      }
      setSaved(nextFavorite);
      if (nextFavorite) setTracked(true);
    } catch (e: any) {
      showMessage('收藏狀態沒有更新', e?.message ?? '請稍後再試。');
    } finally {
      setSavedBusy(false);
    }
  }

  async function openTracking() {
    if (!savedReady || trackingBusy || savedBusy || !jobId) return;
    if (tracked) {
      router.push(`/progress?jobId=${encodeURIComponent(jobId)}`);
      return;
    }
    setTrackingBusy(true);
    try {
      await ensureTrackedJob(jobId);
      setTracked(true);
      router.push(`/progress?jobId=${encodeURIComponent(jobId)}`);
    } catch (e: any) {
      showMessage('無法加入求職進度', e?.message ?? '請稍後再試。');
    } finally {
      setTrackingBusy(false);
    }
  }

  async function openOfficialSource(url?: string | null) {
    if (!url || !/^https?:\/\//i.test(url)) {
      showMessage('無法開啟來源', '這筆資料未附上有效的官方來源網址。');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      showMessage('無法開啟來源', '請稍後再試，或到政府公開資料網站查詢。');
    }
  }

  function confirmDelete() {
    confirmAction(
      '刪除這份職缺？',
      '會一併刪除體檢報告、收藏與求職進度，以及上傳的職缺原圖，無法復原。已使用的免費次數不會退回。',
      () => {
        void (async () => {
          try {
            await deleteJob(jobId);
            router.replace('/jobs');
          } catch (e: any) {
            showMessage('刪除失敗', e?.message ?? '請稍後再試。');
          }
        })();
      },
      true
    );
  }

  function jumpTo(section: Section) {
    const y = positions.current[section];
    if (typeof y === 'number') scrollRef.current?.scrollTo({ y: Math.max(0, y - space.sm), animated: true });
  }
  const remember = (section: Section) => (e: { nativeEvent: { layout: { y: number } } }) => {
    // 位置是相對於頁首下方的內容區；加上頁首高度才是捲動位置。
    positions.current[section] = e.nativeEvent.layout.y + heroHeight.current;
  };

  const topBar = (onShare?: () => void) => (
    <View style={styles.topBar} onLayout={(e) => { heroHeight.current = e.nativeEvent.layout.height + e.nativeEvent.layout.y; }}>
      <FocusStatusBar style="dark" />
      <IconButton icon="chevron-back" label="返回" onPress={goBack} />
      <View style={{ flex: 1 }} />
      {onShare ? <IconButton icon="share-outline" label="分享體檢摘要" onPress={onShare} /> : null}
    </View>
  );

  if (loadError) return (
    <Screen safeTop header={topBar()}>
      <Empty icon="cloud-offline-outline" title="讀取報告失敗" body={loadError}
        action={<View style={styles.emptyActions}>
          <Button label="重新讀取報告" icon="refresh" onPress={() => setRetry(n => n + 1)} />
          <Button label="回我的職缺" variant="outline" onPress={() => router.replace('/jobs')} />
        </View>} />
    </Screen>
  );

  if (!report) return (
    <Screen safeTop header={topBar()}>
      <View style={styles.verdict}>
        <Chip tone="white" label="體檢結果" />
        <T variant="title">正在整理體檢報告…</T>
        <T variant="caption" color={colors.textBody}>公司、薪資與官方紀錄資料讀取中</T>
      </View>
      {[0, 1].map(i => <View key={i} style={styles.skeleton} />)}
    </Screen>
  );

  const now = new Date();
  const companyConfirmed = report.company.match_status === 'confirmed';
  const userSelected = companyConfirmed && report.company.match_method === 'user_selected';
  const recordState = officialRecordState(report);
  // Before build-job-report v1.2, parser hints after a manual correction are only historical clues.
  const needsReportRefresh = correctedFields.length > 0 && !report.manual_review;
  const originalHints = report.manual_review?.original_hints_to_recheck ??
    (needsReportRefresh ? report.conditions_to_confirm ?? [] : []);
  const conditions = needsReportRefresh
    ? []
    : (report.conditions_to_confirm ?? []).filter((c) => c.question || c.source_text);
  const missing = report.missing_information ?? [];
  const postingRisks = report.posting_risks ?? [];
  const laborHints = report.labor_hints ?? checkWorkHours(report.job.work_hours);
  const checklist = buildChecklist({ ...report, conditions_to_confirm: conditions }, now);
  const verdict = friendlyVerdict(checklist, postingRisks);
  const wage = checkMinimumWage(report.salary.job_offer, now);
  const scale = salaryScale(report, now);
  const shift = shiftBreakdown(report.job.work_hours);
  const daysOffHint = laborHints.find(h => h.kind === 'few_days_off');
  const daysOffSource = daysOffHint?.kind === 'few_days_off' ? daysOffHint.source : null;
  const daysOff = daysOffSource ? monthlyDaysOff(daysOffSource) : null;
  const generated = report.generated_at ? `${Number(report.generated_at.slice(5, 7))}/${Number(report.generated_at.slice(8, 10))}` : null;
  const employment = report.job.employment_type ? employmentLabels[report.job.employment_type] ?? report.job.employment_type : null;
  const overview = checklist.filter(item => item.key !== 'risks');

  const actionBar = (
    <View style={styles.actionBar}>
      <IconButton soft size={52} icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? '取消收藏' : '收藏'} active={saved}
        onPress={() => { if (savedReady && !savedBusy) void toggleSaved(); }} />
      <View style={{ flex: 1 }}>
        <Button icon={tracked ? 'checkmark-circle' : 'add'}
          label={trackingBusy ? '建立追蹤中…' : tracked ? '查看求職進度' : '加入求職追蹤'}
          accessibilityLabel={tracked ? '查看這份職缺的求職進度' : '加入求職追蹤'}
          disabled={!savedReady || savedBusy} loading={trackingBusy} onPress={() => { void openTracking(); }} />
      </View>
    </View>
  );

  const offer = report.salary.job_offer;
  const salarySection = (
    <View key="salary" onLayout={remember('salary')} style={styles.section}>
      <SectionTitle title="薪資" />
      <Surface style={{ borderRadius: 26 }}>
        <View style={styles.amountRow}>
          <T variant="bodyStrong" muted>{scale ? scale.unit : '職缺寫的薪資'}</T>
          {scale
            ? <Num size={34}>{fmt(scale.offer)}{scale.offerMax ? `–${fmt(scale.offerMax)}` : ''}</Num>
            : <T variant="title">{offer.raw || '職缺沒寫'}</T>}
          {scale ? <T variant="bodyStrong" muted>元</T> : null}
          <View style={{ flex: 1 }} />
          {wage.status === 'below' ? <Chip tone="caution" label="低於基本工資" /> : wage.status === 'meets' ? <Chip tone="ok" label="不低於基本工資" /> : null}
        </View>
        {scale ? <SalaryScaleView scale={scale} /> : null}
        <MinimumWageNotice check={wage} />
        {report.salary.benchmarks.length === 0
          ? <T variant="caption" muted>目前找不到足夠接近的官方職類薪資行情。</T>
          : (
            <View style={{ gap: space.sm }}>
              {report.salary.benchmarks.slice(0, 4).map((benchmark, i) => (
                <SalaryBenchmarkCard key={`${benchmark.industry}-${benchmark.job_category}-${i}`}
                  benchmark={benchmark} onSource={(url) => void openOfficialSource(url)} />
              ))}
            </View>
          )}
        <T variant="small" muted>同職類平均是政府統計，不等於這份工作合理或你應該拿到的薪水。</T>
      </Surface>
    </View>
  );

  const conditionsSection = (
    <View key="conditions" onLayout={remember('conditions')} style={styles.section}>
      <SectionTitle title="工時與休假" />
      <Surface style={{ borderRadius: 26 }}>
        {shift ? <ShiftBar shift={shift} /> : null}
        {daysOff && daysOffSource ? (
          <View style={[{ gap: space.md }, shift ? styles.topDivider : null]}>
            <View style={styles.rowBetween}>
              <T variant="bodyStrong">一個月的休假</T>
              <Chip tone="caution" label={daysOffSource} />
            </View>
            <DaysOffGrid off={daysOff.off} expected={daysOff.expected} />
            <T variant="caption" color={colors.textBody}>勞基法規定每 7 天要有 2 天休假，一個月大約 8 天。休息日上班要另外算加班費。</T>
          </View>
        ) : null}
        <WorkHoursNotice hints={laborHints} />
        <View>
          {([
            ['上班時間', report.job.work_hours],
            ['工作地點', report.job.location],
            ['聘僱類型', employment],
            ['經驗要求', report.job.experience],
            ['學歷要求', report.job.education]
          ] as Array<[string, string | null | undefined]>).map(([label, value], i, all) => (
            <View key={label} style={[styles.factRow, i === all.length - 1 && { borderBottomWidth: 0 }]}>
              <T variant="caption" muted style={{ flex: 1 }}>{label}</T>
              <T variant="captionStrong" color={value ? colors.text : colors.placeholder} style={styles.factValue}>{value || '職缺沒寫'}</T>
            </View>
          ))}
        </View>
        {conditions.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <T variant="bodyStrong">要問清楚的條件</T>
            {conditions.map((item, index) => <RiskHintCard key={index} question={item.question} sourceText={item.source_text} />)}
          </View>
        ) : null}
        {originalHints.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <T variant="bodyStrong">修正前的舊線索</T>
            <T variant="caption" muted>這些提示產生於你修正欄位之前，不能當成修正後仍然成立的事實。</T>
            {originalHints.map((item, i) => <RiskHintCard key={i} question={item.question} sourceText={item.source_text} historical />)}
          </View>
        ) : null}
        {missing.length > 0 ? (
          <Notice tone="neutral" title="職缺沒寫清楚">
            {`${missing.map(missingLabel).join('、')}。報告不會自己猜，面試時要問清楚。`}
          </Notice>
        ) : null}
      </Surface>
    </View>
  );

  const companySection = (
    <View key="company" onLayout={remember('company')} style={styles.section}>
      <SectionTitle title="公司身分" />
      <Surface style={{ borderRadius: 26 }}>
        <View style={styles.rowBetween}>
          <T variant="heading" style={{ flex: 1 }}>{companyConfirmed ? '已確認是這家公司' : report.company.legal_name ? '還要你確認是哪一家' : '還沒找到這家公司'}</T>
          <Chip tone={companyConfirmed ? 'ok' : 'caution'} label={userSelected ? '你選定的' : companyConfirmed ? '已確認' : '待確認'} />
        </View>
        {!companyConfirmed ? (
          <T variant="caption" color={colors.textBody}>{report.company.legal_name ? '名稱相近的公司不只一家，系統不會替你猜。' : '系統沒有找到可以直接確認的公司。'}選好實際簽約的那一家，才會查它的違規紀錄。</T>
        ) : null}
        <View style={styles.candidate}>
          <IconCircle icon="business" coral />
          <View style={{ flex: 1, gap: 1 }}>
            <T variant="bodyStrong">{report.company.legal_name || '目前無法確認實際雇主'}</T>
            {report.company.tax_id || report.company.established_at ? (
              <T variant="caption" muted>{[report.company.tax_id ? `統編 ${report.company.tax_id}` : null, report.company.established_at ? `${report.company.established_at.slice(0, 4)} 年設立` : null].filter(Boolean).join('・')}</T>
            ) : null}
            {report.company.address ? <T variant="small" muted>{report.company.address}</T> : null}
          </View>
          {companyConfirmed ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : null}
        </View>
        {companyConfirmed
          ? <Button compact variant="ghost" label={userSelected ? '改選其他公司' : '不是這家公司？改選'} onPress={() => setPickerOpen(true)} />
          : <Button variant="soft" icon="business" label="從登記資料選擇實際雇主" onPress={() => setPickerOpen(true)} />}
      </Surface>
    </View>
  );

  const lawSummary = Object.entries(report.official_records.summary_by_law ?? {});
  const recordsSection = (
    <View key="records" onLayout={remember('records')} style={styles.section}>
      {recordState === 'unlinked' ? (
        <Surface style={styles.rowCard}>
          <IconCircle icon="lock-closed" tone="neutral" />
          <View style={{ flex: 1, gap: 1 }}>
            <T variant="bodyStrong">政府違規紀錄</T>
            <T variant="caption" muted>確認公司後才會幫你查</T>
          </View>
        </Surface>
      ) : (
        <>
          <SectionTitle title="政府違規紀錄" />
          <Surface style={{ borderRadius: 26 }}>
            {recordState === 'none' ? <Notice tone="ok" title="公開資料裡查無紀錄">查無資料不代表沒有違規，只代表目前公開資料裡沒有。</Notice> : null}
            {recordState === 'failed' ? (
              <Notice tone="caution" title="這次查詢失敗">
                <T variant="caption" color={colors.textBody}>不是查無資料。報告其他部分照常顯示，可以重新查詢。</T>
                <Button compact variant="white" icon="refresh" label="重新查詢" onPress={() => router.push(`/analysis/${jobId}`)} />
              </Notice>
            ) : null}
            {recordState === 'partial' ? (
              <Notice tone="caution" title="部分資料沒查到">
                <T variant="caption" color={colors.textBody}>有部分官方資料這次沒有查成功，下面的結果可能不完整。</T>
                <Button compact variant="white" icon="refresh" label="重新查詢" onPress={() => router.push(`/analysis/${jobId}`)} />
              </Notice>
            ) : null}
            {recordState === 'not_checked' ? (
              <Notice tone="neutral" title="還沒查詢">
                <T variant="caption" color={colors.textBody}>公司已確認，但還沒查這家公司的官方紀錄。</T>
                <Button compact variant="white" label="開始查詢" onPress={() => router.push(`/analysis/${jobId}`)} />
              </Notice>
            ) : null}
            {lawSummary.length ? (
              <View style={styles.lawGrid}>
                {lawSummary.map(([law, data]) => {
                  const info = data as { count: number; latest_date: string | null };
                  return (
                    <View key={law} style={styles.lawCell} accessible accessibilityLabel={`${lawNames[law] || law} ${info.count} 筆${info.latest_date ? `，最近 ${info.latest_date}` : ''}`}>
                      <Num size={26} color={colors.warning}>{info.count}</Num>
                      <T variant="captionStrong">{lawNames[law] || law}</T>
                      {info.latest_date ? <T variant="small" muted>最近 {info.latest_date}</T> : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
            {report.official_records.records.length > 0 ? (
              <>
                <Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)} style={styles.inlineLink}>
                  <T variant="captionStrong" color={colors.primary}>{expanded ? '收合明細' : `查看 ${report.official_records.records.length} 筆明細`}</T>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.primary} size={16} />
                </Pressable>
                {expanded && report.official_records.records.map((record, i) => (
                  <OfficialRecordCard key={`${record.dataset_id || record.source_url || 'record'}-${i}`}
                    record={record} lawName={lawNames[record.law_type || ''] || record.law_type || '官方紀錄'}
                    onSource={(url) => void openOfficialSource(url)} />
                ))}
              </>
            ) : null}
            {report.official_records.fetched_at ? <T variant="small" muted>查詢時間 {report.official_records.fetched_at.slice(0, 16).replace('T', ' ')}</T> : null}
          </Surface>
        </>
      )}
    </View>
  );

  const sections: Record<DetailSection, ReactElement> = {
    salary: salarySection, conditions: conditionsSection, company: companySection, records: recordsSection
  };

  return (
    <Screen safeTop scrollRef={scrollRef} header={topBar(() => setShareOpen(true))} footer={actionBar}>
      <View style={styles.verdict}>
        <Chip tone="white" label={`體檢結果${generated ? `・${generated}` : ''}`} />
        <T variant="title" accessibilityRole="header">{verdict.text}</T>
        <T variant="body" color={colors.textBody}>{[report.job.title || '未命名職缺', report.job.display_company_name || '公司待確認'].join('・')}</T>
        {report.job.location || report.job.work_hours || employment || daysOffSource ? (
          <View style={styles.chipRow}>
            {[report.job.location, hoursWithoutDaysOff(report.job.work_hours, daysOffSource), employment, daysOffSource].filter((c): c is string => !!c).map(c => <Chip key={c} tone="white" label={c} />)}
          </View>
        ) : null}
      </View>

      {correctedFields.length ? (
        <Notice tone="info" title={`有 ${correctedFields.length} 個欄位是你修正過的`}>
          報告依修正後的內容重新整理；原始刊登文字仍保留，部分提示可能來自原文，請一起核對。
        </Notice>
      ) : null}

      {postingRisks.length > 0 ? (
        <View onLayout={remember('risks')} style={styles.section}>
          <SectionTitle title="最需要小心" />
          <PostingRiskNotice hints={postingRisks} />
          <T variant="small" muted style={{ paddingHorizontal: space.xs }}>這些提醒依職缺裡的字眼判斷，不代表公司一定違法或是詐騙，請向雇主確認。</T>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle title={verdict.questions ? '其他要問清楚的' : '查核總覽'} />
        <View style={styles.grid}>
          {overview.map(item => {
            const t = toneStyles[item.tone];
            const bg = item.tone === 'neutral' || item.tone === 'info' ? colors.neutralSoft : t.bg;
            return (
              <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`${item.title}：${item.value}`}
                onPress={() => jumpTo(sectionFor[item.key])} style={({ pressed }) => [styles.tile, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}>
                <View style={styles.tileIcon}><Ionicons name={checkIcons[item.key]} size={18} color={item.tone === 'neutral' || item.tone === 'info' ? colors.textMuted : t.iconColor} /></View>
                <T variant="captionStrong" color={colors.textBody}>{item.title}</T>
                <T variant="subhead" color={item.tone === 'neutral' || item.tone === 'info' ? colors.text : t.fg} numberOfLines={3}>{item.value}</T>
              </Pressable>
            );
          })}
        </View>
      </View>

      {orderSections(checklist).map(section => sections[section])}

      <View onLayout={remember('interview')} style={styles.section}>
        <SectionTitle title="面試時要問的" />
        <Surface style={{ borderRadius: 26 }}>
          <T variant="caption" muted>依上面的結果整理。問過就勾起來，也可以記下雇主的回答。</T>
          {needsReportRefresh ? <Notice tone="info">目前的問題可能仍來自修正前的原文，請核對最新內容。</Notice> : null}
          <InterviewNotesList jobId={jobId} questions={report.interview_questions} />
        </Surface>
      </View>

      <View style={styles.manage}>
        <View style={{ flex: 1 }}><Button compact variant="outline" icon="create-outline" label="修正職缺資訊" onPress={() => router.push(`/job/edit/${jobId}`)} /></View>
        <View style={{ flex: 1 }}><Button compact variant="outline" icon="trash-outline" label="刪除" accessibilityLabel="刪除這份職缺" onPress={confirmDelete} /></View>
      </View>

      <View style={styles.sources}>
        {Object.values(report.sources).map((v) => <T key={v} variant="label" muted>資料來源：{v}</T>)}
        <T variant="label" muted>{report.disclaimer}</T>
      </View>

      <ShareCardSheet
        visible={shareOpen}
        jobLine={[report.job.title || '未命名職缺', report.job.display_company_name || '公司待確認'].join('・')}
        verdict={verdict.text}
        items={buildShareCardItems(report, now)}
        onClose={() => setShareOpen(false)}
        onShareText={() => { setShareOpen(false); void shareReport(); }}
      />

      <EmployerPicker
        jobId={jobId}
        visible={pickerOpen}
        currentTaxId={report.company.tax_id}
        onClose={() => setPickerOpen(false)}
        onSelected={() => {
          setPickerOpen(false);
          router.push(`/analysis/${jobId}`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md },
  emptyActions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
  skeleton: { height: 140, borderRadius: radius.xl, backgroundColor: colors.neutralSoft },
  verdict: { backgroundColor: colors.verdict, borderRadius: radius.xxl, padding: space.xl, gap: space.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  section: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, borderRadius: radius.xl, padding: 14, gap: 8 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  actionBar: { flexDirection: 'row', gap: space.md - 2, alignItems: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  topDivider: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  factValue: { flex: 1.6, textAlign: 'right' },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: space.md },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lawGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lawCell: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: space.md, gap: 2 },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40 },
  manage: { flexDirection: 'row', gap: 10 },
  sources: { gap: space.xs, paddingHorizontal: space.sm }
});
