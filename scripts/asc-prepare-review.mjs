// 把「職缺體檢」1.0.0 在 App Store Connect 上送審前要的東西補齊（不會送審）：
//   1. 選好 TestFlight 建置（BUILD_NUMBER）；
//   2. 審查聯絡人從「喵的，又要上班了」複製過來（同一位開發者，值不印出來）；版權寫開發者本名的英文（和 App Store 上的開發者名稱同一個拼法）；
//   3. 上傳 store/app-store-screenshots 的 6.9 吋、6.3 吋預覽圖到繁體中文；
//   4. 兩個訂閱各上傳一張審查截圖（store/app-store-screenshots/訂閱審查用-Pro方案.png）。
// APPLY=1 才會寫入；沒設時只列出會做什麼。已經有的東西跳過，可以重跑。
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE_ID = 'com.lumilab.jobcheck';
const MEOW_APP_ID = '6817588985';
const VERSION = '1.0.0';
const BUILD_NUMBER = process.env.BUILD_NUMBER || '';
const APPLY = process.env.APPLY === '1';
const SHOTS = 'store/app-store-screenshots';
// 1320×2868 放 6.9 吋（API 名稱沿用 APP_IPHONE_67），1206×2622 放 6.3 吋（APP_IPHONE_61）。
const SCREENSHOT_SETS = [['6.9吋', 'APP_IPHONE_67'], ['6.3吋', 'APP_IPHONE_61']];
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

const copyright = '2026 Wang Pei Syuan';
log('COPYRIGHT', { current: version.attributes.copyright, want: copyright });
if (APPLY && version.attributes.copyright !== copyright) {
  await api('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id, attributes: { copyright } } });
}
const detail = (await get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
const contact = Object.fromEntries(CONTACT.map((k) => [k, source[k]]));
log('REVIEW_CONTACT', { hasDetail: !!detail, alreadyComplete: !!detail && CONTACT.every((k) => detail.attributes[k]) });
if (APPLY) {
  if (detail) await api('PATCH', `/v1/appStoreReviewDetails/${detail.id}`, { data: { type: 'appStoreReviewDetails', id: detail.id, attributes: contact } });
  else await api('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes: { ...contact, demoAccountRequired: false }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } });
}

// 3. 預覽圖
const loc = (await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === 'zh-Hant');
if (!loc) throw new Error('zh-Hant localization missing');
const sets = (await get(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit=50`)).data;
for (const [folder, displayType] of SCREENSHOT_SETS) {
  const files = readdirSync(join(SHOTS, folder)).filter((f) => f.endsWith('.png')).sort().map((f) => join(SHOTS, folder, f));
  let set = sets.find((s) => s.attributes.screenshotDisplayType === displayType);
  const have = set?.relationships?.appScreenshots?.data?.length ?? 0;
  log('SCREENSHOTS', { displayType, files: files.length, have });
  if (!APPLY || have >= files.length) continue;
  if (!set) set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: displayType }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } })).data;
  for (const f of files.slice(have)) {
    await upload('appScreenshots', {}, { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } }, f);
    console.log('UPLOADED', f, statSync(f).size);
  }
}

// 4. 訂閱審查截圖
const groups = (await get(`/v1/apps/${app.id}/subscriptionGroups`)).data;
for (const g of groups) {
  for (const s of (await get(`/v1/subscriptionGroups/${g.id}/subscriptions`)).data) {
    let shot = null;
    try { shot = (await get(`/v1/subscriptions/${s.id}/appStoreReviewScreenshot`)).data; } catch { /* 沒有 */ }
    const locales = (await get(`/v1/subscriptions/${s.id}/subscriptionLocalizations`)).data;
    log('SUBSCRIPTION', { productId: s.attributes.productId, state: s.attributes.state, reviewScreenshot: !!shot, locales: locales.map((l) => ({ locale: l.attributes.locale, name: l.attributes.name, description: l.attributes.description })) });
    if (APPLY && !shot) await upload('subscriptionAppStoreReviewScreenshots', {}, { subscription: { data: { type: 'subscriptions', id: s.id } } }, SUBSCRIPTION_SHOT);
  }
}
console.log(APPLY ? 'APPLIED' : 'DRY_RUN (set APPLY=1 to write)');
