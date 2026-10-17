export type InterviewNote = { question: string; asked: boolean; answer: string | null };

export const ANSWER_LIMIT = 2000;

/**
 * 依題目文字把筆記對到目前的面試必問；對不到的（報告更新後題目換了）另外列出，不默默消失。
 */
export function matchNotes(questions: readonly string[], notes: readonly InterviewNote[]) {
  const byQuestion = new Map(notes.map(n => [n.question, n]));
  const current = new Set(questions);
  return {
    byQuestion,
    orphaned: notes.filter(n => !current.has(n.question) && (n.asked || (n.answer ?? '').trim()))
  };
}

/** 存檔前整理回答：去掉頭尾空白，空字串存成 null，超過上限截斷。 */
export function cleanAnswer(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.length > ANSWER_LIMIT ? trimmed.slice(0, ANSWER_LIMIT) : trimmed;
}

export function askedCount(questions: readonly string[], byQuestion: ReadonlyMap<string, InterviewNote>): number {
  return questions.filter(q => byQuestion.get(q)?.asked).length;
}
