/**
 * App 裡用到的政府資料與官方原始來源。Google Play「誤導聲明」政策要求：
 * 提供政府資訊時要附原始來源連結，並聲明不代表政府機關。
 * 商店說明（store/google-play、store/listing-zh-Hant.json）與網站支援頁的【資料來源】段落要和這裡一致。
 *
 * 網址對應程式實際用到的資料（2026-10-30 逐一開啟確認）：
 * - 違規紀錄：get_government_dataset_configs 的 6 個勞動部資料集（sync-labor-violations、fetch-official-records）
 * - 公司登記：resolve-company 的經濟部 API（公司 6BBA2268…，對應「公司登記關鍵字查詢」；商業 A1B4CBFF…）
 * - 職類薪資：internal.salary_benchmarks 的「勞動部職類別薪資調查」（data.gov.tw 41685～41700、6648）
 * - 最低工資：src/lib/minimumWage.ts 的費率表
 */
import { MINIMUM_WAGE_SOURCE_URL } from './minimumWage';

export { MINIMUM_WAGE_SOURCE_URL };
export type SourceLink = { label: string; url: string };
export type GovernmentSource = { name: string; agency: string; usedFor: string; url: string; links?: readonly SourceLink[] };

/** 勞動部勞動力發展署「1955 勞工諮詢申訴專線」介紹頁。 */
export const HOTLINE_1955_SOURCE_URL = 'https://www.wda.gov.tw/News_Content.aspx?n=277&s=18960';
/** 內政部警政署 165 全民防騙網。 */
export const HOTLINE_165_SOURCE_URL = 'https://165.npa.gov.tw/';
/** 經濟部商工登記公示資料查詢服務（使用者自己查公司登記）。 */
export const COMPANY_REGISTRY_LOOKUP_URL = 'https://findbiz.nat.gov.tw/';

export const GOVERNMENT_SOURCES: readonly GovernmentSource[] = [
  {
    name: '違反勞動法令事業單位（雇主）查詢系統',
    agency: '勞動部',
    usedFor: '公司被公布的違反勞動法令紀錄',
    url: 'https://announcement.mol.gov.tw/',
    links: [
      { label: '勞動基準法', url: 'https://data.gov.tw/dataset/109896' },
      { label: '性別平等工作法', url: 'https://data.gov.tw/dataset/109897' },
      { label: '就業服務法', url: 'https://data.gov.tw/dataset/110908' },
      { label: '勞工退休金條例', url: 'https://data.gov.tw/dataset/109898' },
      { label: '職業安全衛生法', url: 'https://data.gov.tw/dataset/155978' },
      { label: '勞工職業災害保險及保護法', url: 'https://data.gov.tw/dataset/156800' }
    ]
  },
  {
    name: '公司登記關鍵字查詢（開放資料）',
    agency: '經濟部商業發展署',
    usedFor: '公司的登記名稱、統一編號、設立日期、地址',
    url: 'https://data.gcis.nat.gov.tw/od/detail?oid=311892F7-9BA6-4DDB-B5F6-AE1EF24FDD6A',
    links: [
      { label: '商工行政資料開放平臺（商業登記資料）', url: 'https://data.gcis.nat.gov.tw/' },
      { label: '商工登記公示資料查詢服務', url: COMPANY_REGISTRY_LOOKUP_URL }
    ]
  },
  {
    name: '職類別薪資調查',
    agency: '勞動部',
    usedFor: '各產業、職類的官方平均薪資（參考基準）',
    url: 'https://www.mol.gov.tw/1607/1632/1633/90814/',
    links: [{ label: '政府資料開放平臺：按職類別分薪資資料集（例：製造業）', url: 'https://data.gov.tw/dataset/41685' }]
  },
  {
    name: '最低工資（原基本工資）公告',
    agency: '勞動部',
    usedFor: '每月與每小時最低工資金額',
    url: MINIMUM_WAGE_SOURCE_URL
  },
  {
    name: '1955 勞工諮詢申訴專線',
    agency: '勞動部勞動力發展署',
    usedFor: '工具頁的 1955 專線',
    url: HOTLINE_1955_SOURCE_URL
  },
  {
    name: '165 全民防騙網',
    agency: '內政部警政署',
    usedFor: '工具頁與詐騙警訊的 165 反詐騙專線',
    url: HOTLINE_165_SOURCE_URL
  }
];

export const NOT_GOVERNMENT_DISCLAIMER =
  '職缺體檢由民間獨立開發，與勞動部、經濟部、內政部或任何政府機關沒有關聯，也不代表任何政府機關提供服務。' +
  'App 中的政府資訊都取自上列政府公開資料，可能有更新時間差，請以原始來源為準。';
