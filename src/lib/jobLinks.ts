// 從貼上的文字找出求職網站的職缺網址（104 App 分享出來的是「我在104工作快找上發現了…https://…」）。
// 支援的網站和後端 import-job-url 的 ALLOWED_HOSTS 相同，tests/job-links.test.mjs 會比對。

export const JOB_SITE_HOSTS = [
  '104.com.tw', '1111.com.tw', '518.com.tw', 'cake.me', 'yourator.co', 'yes123.com.tw', 'cakeresume.com',
  'meet.jobs', 'chickpt.com.tw', 'chickpt.com', 'taiwanjobs.gov.tw', 'job.taiwanjobs.gov.tw',
  'indeed.com', 'indeed.com.tw', 'linkedin.com', 'linkedin.cn'
];

const SITE_NAMES: Array<[string, string]> = [
  ['104.com.tw', '104'], ['1111.com.tw', '1111'], ['518.com.tw', '518'], ['yes123.com.tw', 'yes123'],
  ['cake.me', 'Cake'], ['cakeresume.com', 'Cake'], ['yourator.co', 'Yourator'], ['chickpt.com', '小雞上工'],
  ['chickpt.com.tw', '小雞上工'], ['taiwanjobs.gov.tw', '台灣就業通'], ['indeed.com', 'Indeed'], ['linkedin.com', 'LinkedIn']
];

function onHost(host: string, site: string) {
  return host === site || host.endsWith('.' + site);
}

/** 文字裡第一個支援網站的網址（補上 https、去掉黏在後面的標點）；只有網域、沒有路徑的不算。 */
export function findJobUrl(text: string): string | null {
  const normalized = text.normalize('NFKC');
  // 網址只取到第一個非 ASCII 字或逗號、括號為止（全形「，」經過 NFKC 會變成半形逗號）。
  const candidates = normalized.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?\/[^\s<>"'(),\u0080-\uffff]*/gi) || [];
  for (const raw of candidates) {
    const trimmed = raw.replace(/[.,;:!?~]+$/, '');
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed.replace(/^http:/i, 'https:') : 'https://' + trimmed);
    } catch {
      continue;
    }
    const host = url.hostname.toLowerCase();
    if (url.pathname.length <= 1 || !JOB_SITE_HOSTS.some((site) => onHost(host, site))) continue;
    return url.toString();
  }
  return null;
}

/** 網址屬於哪個求職網站（顯示用）。 */
export function jobSiteName(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SITE_NAMES.find(([site]) => onHost(host, site))?.[1] ?? '求職網站';
  } catch {
    return '求職網站';
  }
}

/**
 * 拿掉網址後，剩下的文字是不是只有分享用的一兩句話（沒有薪資、工作內容）。
 * 是的話只能靠網址讀職缺；不是的話，網址讀不到時還可以用貼上的文字體檢。
 */
export function isShareOnlyText(text: string) {
  const rest = text.normalize('NFKC').replace(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}\/\S*/gi, '').replace(/\s+/g, '');
  if (rest.length < 80) return true;
  const salary = /薪|待遇|時薪|月薪|日薪/.test(rest);
  const content = /工作內容|職務|上班|工作時間|工作地點|地點|休假/.test(rest);
  return !(salary && content);
}
