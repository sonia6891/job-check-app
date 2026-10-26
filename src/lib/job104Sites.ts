// 各求職網站專用的讀取方式（純函式，不碰網路，方便測試）。

/**
 * 104 的職缺頁是前端框架做的，直接抓網頁只拿到「需要 JavaScript」的空殼（2026-10 實測），
 * 網址匯入一直失敗。職缺頁自己是向 /job/ajax/content/{職缺代碼} 拿資料，Referer 要是該職缺頁。
 * 分享連結長這樣：https://www.104.com.tw/job/8abc1?jobsource=ios_share、https://m.104.com.tw/job/8abc1
 */
export function job104Id(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host !== "104.com.tw" && !host.endsWith(".104.com.tw")) return null;
  const m = url.pathname.match(/^\/job\/([A-Za-z0-9]{3,20})\/?$/);
  return m ? m[1] : null;
}

export function job104ApiUrl(id: string) {
  return "https://www.104.com.tw/job/ajax/content/" + encodeURIComponent(id);
}

export function job104PageUrl(id: string) {
  return "https://www.104.com.tw/job/" + encodeURIComponent(id);
}

const str = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r\n/g, "\n").trim();
};

/** 陣列裡可能是字串或 { description } 物件。 */
function listText(value: unknown) {
  if (!Array.isArray(value)) return str(value);
  return value
    .map((item) => typeof item === "object" && item !== null ? str((item as any).description ?? (item as any).name) : str(item))
    .filter(Boolean)
    .join("、");
}

const JOB_TYPES: Record<string, string> = { "1": "全職", "2": "兼職", "3": "高階", "4": "全職／兼職" };

/**
 * 把 104 職缺資料整理成和職缺頁一樣的「欄位：內容」文字，parse-job 的規則就讀得到。
 * 公司名稱用 header.custName（104 刊登時填的公司名稱，多半是登記名稱），另外回傳給呼叫端明確指定。
 * 欄位缺了就略過；職稱、公司和工作內容都沒有時回 null，交給一般網頁讀取。
 */
export function jobTextFrom104(payload: any) {
  const data = payload?.data ?? payload;
  if (!data || typeof data !== "object") return null;
  const header = data.header ?? {};
  const detail = data.jobDetail ?? {};
  const condition = data.condition ?? {};
  const welfare = data.welfare ?? {};

  const title = str(header.jobName);
  const company = str(header.custName);
  const description = str(detail.jobDescription);
  if (!title && !company && !description) return null;

  const address = [str(detail.addressRegion), str(detail.addressDetail)].filter(Boolean).join("");
  const jobType = JOB_TYPES[str(detail.jobType)] || "";
  const lines = [
    title ? "職缺名稱：" + title : null,
    company ? "公司名稱：" + company : null,
    str(detail.salary) ? "薪資：" + str(detail.salary) : null,
    address ? "工作地點：" + address : null,
    str(detail.workPeriod) ? "工作時間：" + str(detail.workPeriod) : null,
    str(detail.vacationPolicy) ? "休假制度：" + str(detail.vacationPolicy) : null,
    jobType ? "工作性質：" + jobType : null,
    str(detail.needEmp) ? "需求人數：" + str(detail.needEmp) : null,
    listText(detail.jobCategory) ? "職務類別：" + listText(detail.jobCategory) : null,
    str(condition.workExp) ? "經驗要求：" + str(condition.workExp) : null,
    str(condition.edu) ? "學歷要求：" + str(condition.edu) : null,
    description ? "工作內容：\n" + description : null,
    str(condition.other) ? "其他條件：\n" + str(condition.other) : null,
    listText(welfare.legalTag) ? "法定項目：" + listText(welfare.legalTag) : null,
    str(welfare.welfare) ? "福利制度：\n" + str(welfare.welfare) : null
  ].filter(Boolean);

  return { text: lines.join("\n"), company: company || null, title: title || null };
}
