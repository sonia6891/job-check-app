// 把「職缺體檢」1.0.0 在 App Store Connect 上送審前要的東西補齊（不會送審）：
//   1. 選好 TestFlight 建置（BUILD_NUMBER）；
//   2. 審查聯絡人和版權從「喵的，又要上班了」複製過來（同一位開發者，版權寫本名；聯絡人的值不印出來）；
//   3. 上傳 store/app-store-screenshots 的 6.9 吋、6.3 吋預覽圖到繁體中文；
//   4. 兩個訂閱各上傳一張審查截圖（store/app-store-screenshots/訂閱審查用-Pro方案.png）；
//   5. 副標題、宣傳文字、描述照 store/listing-zh-Hant.json 更新。
// APPLY=1 才會寫入；沒設時只列出會做什麼。已經有的東西跳過，可以重跑。
// REPLACE_SCREENSHOTS=1：先刪掉已上傳的預覽圖再重傳（換新版宣傳圖時用）。
// FIX_STUCK=1：只重傳 Apple 還沒處理完（卡住）的預覽圖。
// SUBMIT=1（要和 APPLY=1 一起）：最後把訂閱和這個版本送審。
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE_ID = 'com.lumilab.jobcheck';
const MEOW_APP_ID = '6817588985';
const VERSION = '1.0.0';
const BUILD_NUMBER = process.env.BUILD_NUMBER || '';
const APPLY = process.env.APPLY === '1';
const REPLACE_SCREENSHOTS = process.env.REPLACE_SCREENSHOTS === '1';
const FIX_STUCK = process.env.FIX_STUCK === '1';
const SUBMIT = APPLY && process.env.SUBMIT === '1';
const LISTING = JSON.parse(readFileSync('store/listing-zh-Hant.json', 'utf8'));
const SHOTS = 'store/app-store-screenshots';
// 1320×2868 放 6.9 吋（API 名稱沿用 APP_IPHONE_67），1206×2622 放 6.3 吋（APP_IPHONE_61），2064×2752 放 iPad 13 吋。
// iPhone Duo 內外螢幕共用一組 APP_IPHONE_DUO（1398×2034、2007×2853），同組檔名不能重複。
const SCREENSHOT_SETS = [
  [['6.9吋'], 'APP_IPHONE_67'],
  [['6.3吋'], 'APP_IPHONE_61'],
  [['iPad13吋'], 'APP_IPAD_PRO_3GEN_129'],
  [['iPhoneDuo外螢幕', 'iPhoneDuo內螢幕'], 'APP_IPHONE_DUO'],
];
const SUBSCRIPTION_SHOT = join(SHOTS, '訂閱審查用-Pro方案.png');

if (!/^\d+$/.test(BUILD_NUMBER)) throw new Error('BUILD_NUMBER is required');

const rawKey = process.env.APP_STORE_CONNECT_KEY || '';
const pem = rawKey.includes('BEGIN') ? rawKey : Buffer.from(rawKey, 'base64').toString('utf8');
const key = createPrivateKey(pem.replace(/\\n/g, '\n'));
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const body = enc({ alg: 'ES256', kid: process.env.APP_STORE_CONNECT_KEY_ID, typ: 'JWT' }) + '.' +
    enc({ iss: process.env.APP_STORE_CONNECT_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' });
  return body + '.' + sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
async function api(method, path, body) {
  const res = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000)
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(data.errors?.map(({ code, detail }) => ({ code, detail })))}`);
  return data;
}
const get = (path) => api('GET', path);
const log = (label, value) => console.log(label, JSON.stringify(value));

// Apple 的上傳流程：建資源 → 依 uploadOperations 分段 PUT → 標記 uploaded 並附 MD5。
async function upload(type, attributes, relationships, file) {
  const bytes = readFileSync(file);
  const created = (await api('POST', `/v1/${type}`, { data: { type, attributes: { ...attributes, fileName: file.split(/[\\/]/).pop(), fileSize: bytes.length }, relationships } })).data;
  for (const op of created.attributes.uploadOperations) {
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length), signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`upload ${file} part ${op.offset} ${res.status}`);
  }
  await api('PATCH', `/v1/${type}/${created.id}`, { data: { type, id: created.id, attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') } } });
  return created.id;
}

const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data[0];
const version = (await get(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${VERSION}`)).data[0];
if (!version) throw new Error('Version 1.0.0 missing');
if (!['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(version.attributes.appStoreState)) throw new Error('Version is not editable: ' + version.attributes.appStoreState);

// 1. 建置
const build = (await get(`/v1/builds?filter[app]=${app.id}&filter[version]=${BUILD_NUMBER}`)).data[0];
if (!build || build.attributes.processingState !== 'VALID') throw new Error('Build not valid: ' + BUILD_NUMBER);
const current = (await get(`/v1/appStoreVersions/${version.id}/build`)).data;
log('BUILD', { want: BUILD_NUMBER, current: current?.attributes.version ?? null, usesNonExemptEncryption: build.attributes.usesNonExemptEncryption });
if (APPLY && current?.id !== build.id) await api('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: 'builds', id: build.id } });
if (APPLY && build.attributes.usesNonExemptEncryption == null) {
  // App 只用系統的 HTTPS，沒有自己的加密。
  await api('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
}

// 2. 審查聯絡人
const CONTACT = ['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone'];
const meowVersions = (await get(`/v1/apps/${MEOW_APP_ID}/appStoreVersions?filter[platform]=IOS&limit=5`)).data;
let source = null;
for (const v of meowVersions) {
  const d = (await get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`)).data;
  if (d && CONTACT.every((k) => d.attributes[k])) { source = d.attributes; break; }
}
if (!source) throw new Error('No complete review contact on the meow app');

const copyright = meowVersions.map((v) => v.attributes.copyright).find(Boolean);
if (!copyright) throw new Error('No copyright on the meow app');
log('COPYRIGHT', { current: version.attributes.copyright, want: copyright });
if (APPLY && version.attributes.copyright !== copyright) {
  await api('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id, attributes: { copyright } } });
}
const detail = (await get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
const contact = Object.fromEntries(CONTACT.map((k) => [k, source[k]]));
log('REVIEW_CONTACT', { hasDetail: !!detail, alreadyComplete: !!detail && CONTACT.every((k) => detail.attributes[k]) });
if (APPLY) {
  const attributes = { ...contact, notes: LISTING.reviewNotes, demoAccountRequired: false };
  if (detail) await api('PATCH', `/v1/appStoreReviewDetails/${detail.id}`, { data: { type: 'appStoreReviewDetails', id: detail.id, attributes } });
  else await api('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } });
}

// 3. 預覽圖
const loc = (await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === 'zh-Hant');
if (!loc) throw new Error('zh-Hant localization missing');
const sets = (await get(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit=50`)).data;
for (const [folders, displayType] of SCREENSHOT_SETS) {
  const files = folders.flatMap((folder) => readdirSync(join(SHOTS, folder)).filter((f) => f.endsWith('.png')).sort().map((f) => join(SHOTS, folder, f)));
  let set = sets.find((s) => s.attributes.screenshotDisplayType === displayType);
  // 每張已上傳的圖：檔名和 Apple 處理狀態。卡在 UPLOAD_COMPLETE 很久的（Apple 沒處理完）視同沒傳。
  let uploaded = set ? (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data : [];
  log('SCREENSHOTS', { displayType, files: files.length, have: uploaded.map((i) => [i.attributes.fileName, i.attributes.assetDeliveryState?.state]), replace: REPLACE_SCREENSHOTS, fixStuck: FIX_STUCK });
  if (!APPLY) continue;
  for (const item of uploaded) {
    const stuck = item.attributes.assetDeliveryState?.state !== 'COMPLETE';
    if (REPLACE_SCREENSHOTS || (FIX_STUCK && stuck)) await api('DELETE', `/v1/appScreenshots/${item.id}`);
  }
  if (!set) set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: displayType }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } })).data;
  uploaded = (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
  const byName = new Map(uploaded.map((i) => [i.attributes.fileName, i.id]));
  for (const f of files) {
    const name = f.split(/[\/]/).pop();
    if (byName.has(name)) continue;
    byName.set(name, await upload('appScreenshots', {}, { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } }, f));
    console.log('UPLOADED', f, statSync(f).size);
  }
  // 重傳的會排到最後，照檔名 1～5 排回來。
  const order = files.map((f) => byName.get(f.split(/[\/]/).pop())).filter(Boolean);
  await api('PATCH', `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, { data: order.map((id) => ({ type: 'appScreenshots', id })) });
}

// 5. 商店文字
log('LISTING', { subtitle: LISTING.subtitle, promotionalText: LISTING.promotionalText.length, description: LISTING.description.length });
if (APPLY) {
  await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, { data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { description: LISTING.description, promotionalText: LISTING.promotionalText } } });
  const infos = (await get(`/v1/apps/${app.id}/appInfos`)).data;
  const info = infos.find((i) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'WAITING_FOR_REVIEW'].includes(i.attributes.appStoreState ?? i.attributes.state)) || infos[0];
  const infoLoc = (await get(`/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find((l) => l.attributes.locale === 'zh-Hant');
  if (!infoLoc) throw new Error('zh-Hant app info localization missing');
  await api('PATCH', `/v1/appInfoLocalizations/${infoLoc.id}`, { data: { type: 'appInfoLocalizations', id: infoLoc.id, attributes: { subtitle: LISTING.subtitle } } });
}

// 4. 訂閱審查截圖
const groups = (await get(`/v1/apps/${app.id}/subscriptionGroups`)).data;
let unapprovedSubscriptions = 0;
for (const g of groups) {
  for (const s of (await get(`/v1/subscriptionGroups/${g.id}/subscriptions`)).data) {
    if (s.attributes.state !== 'APPROVED') unapprovedSubscriptions += 1;
    let shot = null;
    try { shot = (await get(`/v1/subscriptions/${s.id}/appStoreReviewScreenshot`)).data; } catch { /* 沒有 */ }
    const locales = (await get(`/v1/subscriptions/${s.id}/subscriptionLocalizations`)).data;
    log('SUBSCRIPTION', { productId: s.attributes.productId, state: s.attributes.state, reviewScreenshot: !!shot, locales: locales.map((l) => ({ locale: l.attributes.locale, name: l.attributes.name, description: l.attributes.description })) });
    if (APPLY && !shot) await upload('subscriptionAppStoreReviewScreenshots', {}, { subscription: { data: { type: 'subscriptions', id: s.id } } }, SUBSCRIPTION_SHOT);
  }
}
// 6. 送審：第一次的訂閱 API 不能單獨送（409），要先在 App Store Connect 網頁的訂閱頁按「新增以供審查」
//    放進提交草稿，訂閱群組頁也要按一次（群組要一起送）；這裡把 1.0.0 加進同一份草稿再送出。
//    2026-10-28 職缺體檢 1.0.0 就是這樣在網頁上送出的（4 個項目：版本、兩個訂閱、訂閱群組）。
//    App Review 退件後，同一份提交會停在 UNRESOLVED_ISSUES：把被退的項目標成已解決，再送出同一份（Apple 的重送流程）。
const open = (await get(`/v1/apps/${app.id}/reviewSubmissions?filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES`)).data;
const openItems = open[0] ? (await get(`/v1/reviewSubmissions/${open[0].id}/items?include=appStoreVersion&limit=100`)).data : [];
log('REVIEW_SUBMISSION', { state: open[0]?.attributes.state ?? null, items: openItems.map((i) => ({ state: i.attributes.state, version: i.relationships?.appStoreVersion?.data?.id ?? null })) });
if (SUBMIT) {
  // 訂閱還沒通過時，版本、每個訂閱、訂閱群組都要在同一份草稿，少一項就不送。
  const hasVersion = openItems.some((i) => i.relationships?.appStoreVersion?.data?.id === version.id);
  const total = openItems.length + (hasVersion ? 0 : 1);
  const need = unapprovedSubscriptions ? unapprovedSubscriptions + 2 : 1;
  if (total < need) throw new Error(`Draft incomplete: ${total} of ${need} items (version, subscriptions, group)`);
  const submission = open[0] || (await api('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: app.id } } } } })).data;
  const items = openItems;
  if (!items.some((i) => i.relationships?.appStoreVersion?.data?.id === version.id)) await api('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } });
  for (const item of items.filter((i) => i.attributes.state === 'REJECTED')) {
    await api('PATCH', `/v1/reviewSubmissionItems/${item.id}`, { data: { type: 'reviewSubmissionItems', id: item.id, attributes: { resolved: true } } });
    log('RESOLVED_ITEM', item.id);
  }
  const done = (await api('PATCH', `/v1/reviewSubmissions/${submission.id}`, { data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } } })).data;
  log('SUBMITTED', { submission: done.id, state: done.attributes.state });
}
console.log(APPLY ? 'APPLIED' : 'DRY_RUN (set APPLY=1 to write)');
