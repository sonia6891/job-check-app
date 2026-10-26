/**
 * 截圖裡的公司名稱，在手機上先找好、明確交給後端。
 * 2026-10-27 實機：104 App 職缺頁的「GIS-KY(6456)業成集團_英特盛科技股份有限」＋下一行「公司」，
 * 線上 parse-job 認不出斷成兩行的名稱，還可能把下一行旁邊的 Logo 字「GiS」當成公司。
 */

const SUFFIXES = ['股份有限公司', '有限公司', '無限公司', '兩合公司', '企業社', '商行', '工作室', '商號', '行號'];
const LEGAL_NAME = /(.{0,70}?(?:股份有限公司|有限公司|無限公司|兩合公司|企業社|商行|工作室|商號|行號))/;
const CJK = /[㐀-鿿]/g;
// 列表箭頭、圖示被辨識成的符號。
const TRAILING_MARKS = /[\s>›〉》»|｜]+$/;
// 這些欄位裡的公司名稱不是雇主（地址、聯絡方式、版權宣告）。
const NOT_EMPLOYER_LINE = /^(?:聯絡人|聯絡電話|電話|傳真|地址|公司地址|工作地點|上班地點|資本額|員工數|產業|官網|公司網址|網址|©|版權|copyright)/i;
// 求職網站自己的公司名稱（頁尾、浮水印），不是刊登職缺的雇主。
const PLATFORMS = /一零四資訊科技|全球華人股份有限公司|大中華人力資源/;

/**
 * 公司字尾被折到下一行時接回去：「…股份有限」＋「公司」、「…英特盛科技」＋「股份有限公司」。
 * 只在下一行除了字尾剩下的部分以外沒有別的字（最多一個箭頭符號）時才接，避免把兩行不相干的字黏在一起。
 */
export function joinWrappedCompanyLines(text: string) {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const next = (lines[i + 1] ?? '').trim().replace(TRAILING_MARKS, '');
    let joined: string | null = null;
    if (next && (line.match(CJK) || []).length >= 2 && !LEGAL_NAME.test(line)) {
      for (const suffix of SUFFIXES) {
        for (let k = 0; k < suffix.length; k++) {
          // 整個字尾都在下一行時，上一行要以中文字結尾（「月薪 32000」＋「有限公司」不接）。
          if (k === 0 && !/[㐀-鿿]$/.test(line)) continue;
          if (line.endsWith(suffix.slice(0, k)) && next === suffix.slice(k)) {
            joined = line + suffix.slice(k);
            break;
          }
        }
        if (joined) break;
      }
    }
    if (joined) {
      out.push(joined);
      i++;
    } else {
      out.push(lines[i]);
    }
  }
  return out.join('\n');
}

/** 截圖上方最先出現的登記名稱（「○○股份有限公司」「○○商行」…）；找不到回 null。 */
export function companyFromScreenshot(text: string): string | null {
  const lines = joinWrappedCompanyLines(text).split('\n').slice(0, 40);
  for (const raw of lines) {
    const line = raw.normalize('NFKC').replace(/^[•·▪▸▶*\-\s]+/, '').replace(/^(?:公司名稱|企業名稱|雇主名稱|徵才公司|刊登公司|招募公司)[：:\s]*/, '').trim();
    if (!line || NOT_EMPLOYER_LINE.test(line) || PLATFORMS.test(line)) continue;
    const m = line.match(LEGAL_NAME);
    if (!m) continue;
    const name = m[1].trim();
    const core = SUFFIXES.reduce((s, suffix) => s.endsWith(suffix) ? s.slice(0, -suffix.length) : s, name);
    if ((core.match(CJK) || []).length + (core.match(/[A-Za-z0-9]/g) || []).length < 2) continue;
    return name;
  }
  return null;
}
