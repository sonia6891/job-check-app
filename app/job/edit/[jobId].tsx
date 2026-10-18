import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { showMessage } from '@/src/lib/uiAlerts';
import { colors, radius, space } from '@/src/theme/tokens';
import { Button, Chip, Notice, Screen, Surface, T } from '@/src/ui';
import { correctionNeedsReanalysis, makeJobCorrectionPatch, type EditableJobFields } from '@/src/lib/jobCorrections';

const fields: Array<{ key: keyof EditableJobFields; label: string; placeholder: string }> = [
  {key:'display_company_name',label:'職缺上的公司名稱',placeholder:'請輸入刊登職缺的公司名稱'},
  {key:'job_title',label:'職稱',placeholder:'請輸入實際職稱'},
  {key:'salary_raw',label:'薪資待遇',placeholder:'例如：月薪 32,000–38,000 元'},
  {key:'location_raw',label:'工作地點',placeholder:'例如：臺北市信義區'},
  {key:'work_hours_raw',label:'上班時間',placeholder:'例如：週一至週五 09:00–18:00'},
  {key:'employment_type',label:'聘僱類型',placeholder:'例如：全職、兼職、約聘'}
];

type JobEditRow = EditableJobFields & { structured_data: Record<string, unknown> | null; source_url: string | null };

function editable(row: Partial<EditableJobFields>): EditableJobFields {
  return {
    display_company_name: row.display_company_name || '',
    job_title: row.job_title || '',
    salary_raw: row.salary_raw || '',
    location_raw: row.location_raw || '',
    work_hours_raw: row.work_hours_raw || '',
    employment_type: row.employment_type || ''
  };
}

export default function JobEditScreen() {
  const { jobId } = useLocalSearchParams<{jobId:string}>();
  const [original,setOriginal] = useState<JobEditRow|null>(null);
  const [draft,setDraft] = useState<EditableJobFields|null>(null);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [loadError,setLoadError] = useState<string|null>(null);
  const [reloadCount,setReloadCount] = useState(0);

  useFocusEffect(useCallback(()=>{
    let active=true;
    async function load(){
      setLoading(true);setLoadError(null);
      try {
        if(!jobId) throw new Error('找不到職缺編號。');
        const userResult = await supabase.auth.getUser();
        const userId = userResult.data.user?.id;
        if(!userId) throw new Error('登入狀態失效，請重新進入。');
        const {data,error} = await supabase.from('job_posts')
          .select('display_company_name,job_title,salary_raw,location_raw,work_hours_raw,employment_type,structured_data,source_url')
          .eq('id',jobId).eq('user_id',userId).maybeSingle();
        if(error) throw error;
        if(!data) throw new Error('找不到你的職缺或沒有權限修改。');
        if(active) {
          const row=data as JobEditRow;
          setOriginal(row);
          setDraft(editable(row));
        }
      }catch(e:any){
        if(active)setLoadError(e?.message ?? '無法讀取職缺。');
      }finally{if(active)setLoading(false);}
    }
    void load();
    return ()=>{active=false;};
  },[jobId,reloadCount]));

  async function save(){
    if(!original||!draft||!jobId||saving)return;
    if(!draft.job_title.trim())return showMessage('請填入職稱','職稱不能留空。');
    if(!draft.display_company_name.trim())return showMessage('請填入公司名稱','至少需要公司在職缺中使用的名稱，才能進行身分辨識。');
    const patch=makeJobCorrectionPatch(editable(original),draft,original.structured_data,new Date().toISOString());
    if(!Object.keys(patch).length){router.back();return;}
    const reanalyze=correctionNeedsReanalysis(editable(original),draft);
    setSaving(true);
    try {
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user)throw new Error('請重新登入後再試。');
      // Guard both by job id and authenticated owner. RLS also verifies auth.uid() = user_id.
      const {data,error}=await supabase.from('job_posts').update(patch)
        .eq('id',jobId).eq('user_id',user.id).select('id').maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('這份職缺已不存在，或沒有修改權限。');
      // A new company name needs a fresh employer lookup; other fields only change the report,
      // which the report screen rebuilds from the corrected fields when it opens.
      if (reanalyze) router.replace(`/analysis/${jobId}`);
      else if (router.canGoBack()) router.back();
      else router.replace(`/report/${jobId}`);
    }catch(e:any){showMessage('儲存未完成',e?.message??'已保留輸入內容，可以再試一次。');}
    finally{setSaving(false);}
  }

  const reanalyze = Boolean(original && draft && correctionNeedsReanalysis(editable(original), draft));
  const employmentValue = draft ? (employmentAliases[draft.employment_type.trim()] ?? draft.employment_type.trim()) : '';

  return (
    <Screen>
      <Notice tone="info">改公司名稱會重新查公司和違規紀錄（同一份職缺同一個月內重查，不會重複算次數）；改其他欄位報告會馬上更新。原始職缺內容仍保留，方便核對。</Notice>
      {loading ? [0, 1].map(i => <View key={i} style={styles.skeleton} />) : null}
      {loadError ? (
        <Notice tone="caution" title="讀不到這份職缺">
          <T variant="caption" color={colors.textBody}>{loadError}</T>
          <Button compact variant="white" icon="refresh" label="重新讀取" onPress={() => setReloadCount(v => v + 1)} />
        </Notice>
      ) : null}
      {draft ? (
        <>
          <Surface style={{ borderRadius: 26, gap: space.lg }}>
            {fields.filter(f => f.key !== 'employment_type').map(({ key, label, placeholder }) => {
              const companyChanged = key === 'display_company_name' && original && draft.display_company_name.trim() !== (original.display_company_name || '').trim();
              return (
                <View key={key} style={{ gap: 6 }}>
                  <T variant="captionStrong" muted>{label}</T>
                  <View style={[styles.input, companyChanged && styles.inputChanged]}>
                    <TextInput accessibilityLabel={label} value={draft[key]}
                      editable={!saving} onChangeText={value => setDraft(v => v ? { ...v, [key]: value } : v)}
                      placeholder={placeholder} placeholderTextColor={colors.placeholder} style={styles.inputText} />
                    {companyChanged ? <Chip tone="coral" label="會重新查詢" /> : null}
                  </View>
                  {!draft[key].trim() && key !== 'display_company_name' && key !== 'job_title' ? <T variant="small" color={colors.warning}>職缺沒寫的話，可以先空著</T> : null}
                </View>
              );
            })}
            <View style={{ gap: 6 }}>
              <T variant="captionStrong" muted>聘僱類型</T>
              <View style={styles.pills}>
                {employmentOptions.map(o => {
                  const on = employmentValue === o.value;
                  return (
                    <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} disabled={saving}
                      onPress={() => setDraft(v => v ? { ...v, employment_type: on ? '' : o.value } : v)}
                      style={[styles.pill, on && styles.pillOn]}>
                      <T variant="captionStrong" color={on ? '#FFFFFF' : colors.textBody}>{o.label}</T>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {original?.source_url ? (
              <View style={styles.source}>
                <Ionicons name="link" color={colors.primary} size={15} />
                <T variant="small" muted numberOfLines={2} style={{ flex: 1 }}>{original.source_url}</T>
              </View>
            ) : null}
          </Surface>
          <T variant="small" muted style={{ paddingHorizontal: space.xs }}>改薪資文字後，舊的解析數字會先清掉，避免留下錯的區間；新報告會重新對照官方薪資。</T>
          <View style={{ gap: 10 }}>
            <Button icon="checkmark" label={reanalyze ? '儲存並重新檢查' : '儲存修正'} loading={saving} onPress={() => void save()} />
            <Button variant="outline" label="取消" disabled={saving} onPress={() => router.back()} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const employmentOptions = [
  { value: 'full_time', label: '全職' },
  { value: 'part_time', label: '兼職' },
  { value: 'contract', label: '約聘' },
  { value: 'internship', label: '實習' }
];
/** 舊資料可能存中文，選取狀態要認得。 */
const employmentAliases: Record<string, string> = { 全職: 'full_time', 兼職: 'part_time', 約聘: 'contract', 實習: 'internship' };

const styles = StyleSheet.create({
  skeleton: { height: 120, borderRadius: radius.xl, backgroundColor: colors.neutralSoft },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 50, borderWidth: 2, borderColor: 'transparent' },
  inputChanged: { borderColor: colors.primary },
  inputText: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 12 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, minHeight: 38, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.text, borderColor: colors.text },
  source: { flexDirection: 'row', gap: 8, alignItems: 'center' }
});
