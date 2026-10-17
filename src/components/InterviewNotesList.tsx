import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { showMessage } from '@/src/lib/uiAlerts';
import { colors } from '@/src/theme/colors';
import { ANSWER_LIMIT, askedCount, cleanAnswer, matchNotes, type InterviewNote } from '@/src/lib/interviewNotes';
import { ProgressBar } from '@/src/ui/viz';

type Question = { question: string; source_text?: string | null };

/**
 * 面試必問清單，每題可以勾「已問過」並記下雇主的回答。筆記存在 interview_notes，只有本人能讀寫。
 */
export function InterviewNotesList({ jobId, questions }: { jobId: string; questions: readonly Question[] }) {
  const [notes, setNotes] = useState<InterviewNote[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setNotes(null);
    setLoadError(null);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('登入狀態尚未就緒。');
        const { data, error } = await supabase.from('interview_notes')
          .select('question,asked,answer').eq('job_post_id', jobId).eq('user_id', user.id);
        if (error) throw error;
        if (active) setNotes((data ?? []) as InterviewNote[]);
      } catch (e: any) {
        if (active) { setLoadError(e?.message ?? '無法讀取面試筆記。'); setNotes([]); }
      }
    })();
    return () => { active = false; };
  }, [jobId]);

  const list = questions.map(q => q.question);
  const { byQuestion, orphaned } = matchNotes(list, notes ?? []);

  async function save(question: string, patch: { asked: boolean; answer: string | null }) {
    if (saving) return false;
    setSaving(question);
    const previous = notes ?? [];
    const next = [...previous.filter(n => n.question !== question), { question, ...patch }];
    setNotes(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('登入狀態已失效，請重新開啟報告。');
      const { error } = await supabase.from('interview_notes').upsert({
        user_id: user.id, job_post_id: jobId, question,
        asked: patch.asked, answer: patch.answer, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,job_post_id,question' });
      if (error) throw error;
      return true;
    } catch (e: any) {
      setNotes(previous);
      showMessage('筆記沒有儲存', e?.message ?? '請稍後再試。');
      return false;
    } finally {
      setSaving(null);
    }
  }

  function toggleAsked(question: string) {
    const note = byQuestion.get(question);
    void save(question, { asked: !note?.asked, answer: note?.answer ?? null });
  }

  async function saveAnswer(question: string) {
    const answer = cleanAnswer(drafts[question] ?? '');
    // 記下回答就代表問過了。
    const ok = await save(question, { asked: answer ? true : byQuestion.get(question)?.asked ?? false, answer });
    if (ok) setEditing(null);
  }

  function startEditing(question: string) {
    setDrafts(d => ({ ...d, [question]: d[question] ?? byQuestion.get(question)?.answer ?? '' }));
    setEditing(question);
  }

  if (!questions.length) return <Text style={styles.muted}>目前沒有額外需要確認的問題。</Text>;

  return (
    <View style={styles.wrap}>
      {notes === null ? <ActivityIndicator color={colors.primary} /> : (
        <View style={{ gap: 6 }}>
          <Text style={styles.progress}>{`已問 ${askedCount(list, byQuestion)} / ${list.length} 題`}</Text>
          <ProgressBar value={list.length ? askedCount(list, byQuestion) / list.length : 0} />
        </View>
      )}
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      {questions.map((q, i) => {
        const note = byQuestion.get(q.question);
        const isEditing = editing === q.question;
        const busy = saving === q.question;
        return (
          <View key={q.question} style={styles.item}>
            <View style={styles.row}>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={`第 ${i + 1} 題已問過`} accessibilityState={{ checked: !!note?.asked, disabled: busy || notes === null }}
                disabled={busy || notes === null} onPress={() => toggleAsked(q.question)} hitSlop={10}
                style={[styles.check, note?.asked && styles.checkDone]}>
                {note?.asked ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
              </Pressable>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.question, note?.asked && styles.questionDone]}>{q.question}</Text>
                {q.source_text ? <Text style={styles.source}>來自職缺原文：「{q.source_text}」</Text> : null}
              </View>
            </View>

            {note?.answer && !isEditing ? (
              <View style={styles.answer}>
                <Ionicons name="chatbox-ellipses" size={15} color={colors.warning} />
                <Text style={styles.answerText}>雇主回答：{note.answer}</Text>
              </View>
            ) : null}

            {isEditing ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  accessibilityLabel={`第 ${i + 1} 題的回答`}
                  value={drafts[q.question] ?? ''}
                  onChangeText={(text) => setDrafts(d => ({ ...d, [q.question]: text }))}
                  placeholder="雇主怎麼回答？例如：試用期三個月，薪資不變"
                  placeholderTextColor="#829CB4"
                  multiline
                  maxLength={ANSWER_LIMIT}
                  editable={!busy}
                  style={styles.input}
                />
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveAnswer(q.question)} style={[styles.saveBtn, busy && { opacity: 0.55 }]}>
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>儲存回答</Text>}
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditing(null)} style={styles.linkBtn}>
                    <Text style={styles.linkText}>取消</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" disabled={busy || notes === null} onPress={() => startEditing(q.question)} style={styles.linkBtn}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={styles.linkText}>{note?.answer ? '修改雇主的回答' : '記下雇主的回答'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {orphaned.length > 0 ? (
        <View style={styles.orphaned}>
          <Text style={styles.orphanTitle}>先前題目的筆記</Text>
          <Text style={styles.muted}>報告更新後這些題目不在清單裡了，筆記仍保留在這裡。</Text>
          {orphaned.map(n => (
            <View key={n.question} style={{ gap: 2 }}>
              <Text style={styles.question}>{n.question}</Text>
              {n.answer ? <Text style={styles.answer}>{n.answer}</Text> : <Text style={styles.muted}>已問過</Text>}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  progress: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13 },
  item: { gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  question: { color: colors.text, fontWeight: '700', lineHeight: 22, fontSize: 15 },
  questionDone: { color: colors.textMuted },
  source: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  answer: { flexDirection: 'row', gap: 8, backgroundColor: colors.accentSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginLeft: 36 },
  answerText: { flex: 1, color: colors.textBody, fontSize: 13, lineHeight: 20 },
  input: { minHeight: 90, borderRadius: 16, padding: 12, backgroundColor: colors.surfaceMuted, color: colors.text, textAlignVertical: 'top', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 16, alignItems: 'center', marginLeft: 36 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40 },
  linkText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 14, minHeight: 40, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
  orphaned: { gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: 16, padding: 12 },
  orphanTitle: { color: colors.text, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18 }
});
