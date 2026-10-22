import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import type { EmployerCandidate } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { Button, IconButton, Notice, T } from '@/src/ui';

const registryLabel: Record<string, string> = {
  gcis_company: '公司登記',
  gcis_business: '商業登記',
  // 經濟部網站停擺時改查的 g0v 鏡像，資料同樣來自公司／商業登記。
  g0v_company_mirror: '公司登記',
  g0v_business_mirror: '商業登記'
};

function candidateKey(c: Pick<EmployerCandidate, 'entity_type' | 'tax_id'>) {
  return `${c.entity_type}:${c.tax_id}`;
}

/**
 * 同名公司很多時，讓使用者自己選出實際簽約的雇主。
 * 只能從後端列出的登記資料中選；選定後由呼叫端重新跑體檢，才會查這家公司的官方紀錄。
 */
export function EmployerPicker({ jobId, visible, currentTaxId, onClose, onSelected }: {
  jobId: string;
  visible: boolean;
  currentTaxId?: string | null;
  onClose: () => void;
  onSelected: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<EmployerCandidate[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [lookupIncomplete, setLookupIncomplete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');

  async function load(nameOverride = companyQuery) {
    setLoading(true);
    setLoadError(null);
    try {
      const query = nameOverride.trim();
      const result = await api.listEmployerCandidates(jobId, query || undefined);
      setSearchedQuery(query);
      const list = (result.candidates ?? []).filter((c) => c.tax_id && c.legal_name);
      setCandidates(list);
      setReason(result.reason ?? null);
      setLookupIncomplete(result.external_lookup ? !result.external_lookup.ok : false);
      const current = list.find((c) => c.tax_id === currentTaxId);
      setPicked(current ? candidateKey(current) : null);
    } catch (e: any) {
      setLoadError(e?.message ?? '請稍後再試。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible) { setCompanyQuery(''); setSearchedQuery(''); void load(''); }
  }, [visible, jobId]);

  async function confirm() {
    const chosen = candidates.find((c) => candidateKey(c) === picked);
    if (!chosen) return;
    setSaving(true);
    try {
      const result = await api.selectEmployer(jobId, chosen, searchedQuery || undefined);
      // 舊版後端會忽略選擇、重新自動比對，這時不能當作已選定。
      if (result.status !== 'confirmed' || result.match_method !== 'user_selected') {
        throw new Error('目前無法儲存你的選擇，請稍後再試。');
      }
      onSelected();
    } catch (e: any) {
      Alert.alert('沒有選定雇主', e?.message ?? '請稍後再試。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="heading" accessibilityRole="header">這份工作是哪一家公司？</T>
            <T variant="caption" muted>對照職缺上的公司全名、地址或統編，選你實際要簽約的那一家；選好才會查它的違規紀錄。</T>
          </View>
          <IconButton icon="close" label="關閉" onPress={onClose} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 8 }}>
          <T variant="captionStrong">公司名稱不對？可以輸入招牌、登記全名或統編線索重新找</T>
          <TextInput accessibilityLabel="更正公司名稱" value={companyQuery} onChangeText={setCompanyQuery}
            autoCorrect={false} placeholder="輸入公司或雇主名稱" placeholderTextColor={colors.textMuted}
            style={{ borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text }} />
          <Button compact variant="soft" icon="search" label="重新搜尋雇主登記" disabled={loading || saving || !companyQuery.trim()} onPress={() => { void load(companyQuery); }} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : null}

          {!loading && loadError ? (
            <Notice tone="caution" title="讀不到候選名單">
              <T variant="caption" color={colors.textBody}>{loadError}</T>
              <Button compact variant="white" icon="refresh" label="重新讀取" onPress={() => { void load(); }} />
            </Notice>
          ) : null}

          {!loading && !loadError && lookupIncomplete ? (
            <Notice tone="caution" title="名單可能不完整">
              <T variant="caption" color={colors.textBody}>政府登記資料這次沒有完整回應。</T>
              <Button compact variant="white" icon="refresh" label="重新查詢" onPress={() => { void load(); }} />
            </Notice>
          ) : null}

          {!loading && !loadError && candidates.length === 0 ? (
            <T variant="caption" muted style={styles.empty}>
              {reason === 'organization_registry_not_supported_yet'
                ? '醫院、學校、協會這類機構目前還查不到登記資料，暫時無法選擇。'
                : reason === 'contact_person_not_employer'
                  ? '職缺上寫的是聯絡人姓名，不是公司名稱。請回到首頁補上公司全名後重新體檢。'
                  : reason === 'company_name_missing'
                    ? '職缺上沒有找到公司名稱。請在上方輸入公司或店家名稱，再按「重新搜尋雇主登記」。'
                    : '找不到名稱相近的登記資料。可以回到首頁補上公司全名後重新體檢。'}
            </T>
          ) : null}

          {!loading && candidates.map((c) => {
            const key = candidateKey(c);
            const selected = key === picked;
            return (
              <Pressable
                key={key}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => setPicked(key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="bodyStrong">{c.legal_name}</T>
                  <T variant="caption" muted>統編 {c.tax_id}{c.registry_source && registryLabel[c.registry_source] ? `・${registryLabel[c.registry_source]}` : ''}{c.status ? `・${c.status}` : ''}</T>
                  {c.address ? <T variant="caption" muted>{c.address}</T> : null}
                  {c.representative || c.established_at ? (
                    <T variant="caption" muted>
                      {[c.representative ? `負責人 ${c.representative}` : null, c.established_at ? `設立 ${c.established_at}` : null].filter(Boolean).join('・')}
                    </T>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {candidates.length > 0 ? (
          <View style={styles.footer}>
            <Button icon="shield-checkmark" label="選這家，開始查紀錄" loading={saving} disabled={!picked} onPress={() => { void confirm(); }} />
            <Pressable onPress={onClose} style={styles.textButton} accessibilityRole="button">
              <T variant="captionStrong" color={colors.primary}>都不是，先不選</T>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  body: { padding: 20, gap: 12, paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 16 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, padding: 14 },
  rowSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 6, borderTopWidth: 1, borderTopColor: colors.line },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }
});
