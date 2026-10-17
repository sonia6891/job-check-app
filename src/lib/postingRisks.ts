/**
 * 職缺原文裡常見的求職詐騙與違法條件字眼。只做提醒，不判定公司違法或詐騙。
 *
 * - 要求先付費、交出帳戶：165 反詐騙宣導的求職詐騙特徵（求職不需要先付錢，也不需要交出帳戶）。
 * - 不保勞健保：受僱者應由雇主投保健保、提繳勞退；5 人以上單位須投保勞保。
 * - 扣薪罰款：勞動基準法第 26 條，雇主不得預扣工資作為違約金或賠償費用。
 */
export type PostingRiskKind = 'account_handover' | 'upfront_payment' | 'no_insurance' | 'wage_deduction';
export type PostingRiskHint = { kind: PostingRiskKind; severity: 'high' | 'caution'; source: string };

const severity: Record<PostingRiskKind, 'high' | 'caution'> = {
  account_handover: 'high',
  upfront_payment: 'high',
  no_insurance: 'caution',
  wage_deduction: 'caution'
};

// 片段只取同一句，避免跨句誤配。
const S = '[^，。,.;；\\n]';
const rules: Array<[PostingRiskKind, RegExp]> = [
  ['account_handover', new RegExp(`(?:提供|交付|寄送|借用|租借|出租|收購|購買|交出)${S}{0,6}(?:存摺|提款卡|金融卡|銀行帳戶|帳戶|網銀|帳號密碼)|收簿|租簿|買簿`)],
  ['upfront_payment', new RegExp(`保證金|押金|訓練費|教材費|代辦費|入會費|介紹費|報名費|(?:先|預)(?:繳|付)${S}{0,6}(?:費|錢|元)`)],
  ['no_insurance', new RegExp(`(?:不|無|免|未)(?:保|加保|投保)${S}{0,3}(?:勞健保|勞保|健保)|(?:勞健保|勞保|健保)${S}{0,4}(?:不保|自理|自行投保|不投保)|領現${S}{0,2}不保`)],
  ['wage_deduction', new RegExp(`(?:遲到|早退|請假|離職|曠職|損壞|打破)${S}{0,6}(?:扣薪|扣錢|扣款|扣工資|罰款|罰錢)|違約金|罰金`)]
];

// 「免押金」「不需保證金」「無須繳費」這類否定說法不算。
const NEGATION = /(?:免|不需|無需|無須|不用|不收|沒有|無)\s*$/;

function firstMatch(text: string, re: RegExp): string | null {
  const global = new RegExp(re.source, 'g');
  for (const m of text.matchAll(global)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 3), m.index ?? 0);
    if (NEGATION.test(before)) continue;
    return m[0];
  }
  return null;
}

/** 傳入職缺原文（可多段），回傳每一類最先出現的一處。 */
export function checkPostingRisks(...texts: Array<string | null | undefined>): PostingRiskHint[] {
  const text = texts.filter(Boolean).join('\n').normalize('NFKC');
  if (!text.trim()) return [];
  const hints: PostingRiskHint[] = [];
  for (const [kind, re] of rules) {
    const source = firstMatch(text, re);
    if (source) hints.push({ kind, severity: severity[kind], source });
  }
  return hints;
}
