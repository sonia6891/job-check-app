/**
 * 截圖辨識出來的文字，最上面常是手機狀態列（時間、訊號、電量）和瀏覽器網址列、按鈕。
 * 不先拿掉的話，「10:57」會被當成職稱、「4G 89」會被當成公司名稱。
 * 只看開頭幾行、遇到第一行像內容的就停；只用在截圖辨識結果，不用在使用者貼上的文字。
 * 後端 supabase/functions/parse-job/rules.ts 有同樣的規則（測試會比對兩邊結果一致）。
 */
const CJK = /[㐀-鿿]/g;

function isScreenChromeLine(line: string) {
  const t = line.trim();
  if (!t) return true;
  if (/^(?:上午|下午)?\s?\d{1,2}:\d{2}(?:\s?[AaPp][Mm])?$/.test(t)) return true;
  if ((t.match(CJK) || []).length >= 2) return false;
  if (/(?:^|[^A-Za-z])(?:4G|5G|5GE|LTE|3G|SOS)(?:$|[^A-Za-z])/i.test(t) && t.length <= 20) return true;
  if (/^(?:https?:\/\/)?(?:[\w-]+\.)+(?:com|tw|net|org|io|jobs)(?:\.tw)?(?:\/\S*)?$/i.test(t)) return true;
  if (!/[A-Za-z]{3,}/.test(t) && t.length <= 12) return true;
  return false;
}

export function stripScreenChrome(text: string) {
  const lines = text.split('\n');
  let start = 0;
  while (start < lines.length && start < 8 && isScreenChromeLine(lines[start])) start++;
  return lines.slice(start).join('\n').trim();
}
