// 唯讀：列出 App Store Connect 上「職缺體檢」送審前還缺什麼（版本狀態、建置、截圖、審查資訊、訂閱審查截圖）。
// 只發 GET，不改任何東西。用 GitHub Actions 的 App Store Connect API 金鑰執行（.github/workflows/asc-status.yml）。
import { createPrivateKey, sign } from 'node:crypto';

const BUNDLE_ID = 'com.lumilab.jobcheck';
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

async function get(path) {
  const res = await fetch('https://api.appstoreconnect.apple.com' + path, { headers: { Authorization: 'Bearer ' + jwt() }, signal: AbortSignal.timeout(30000) });
  const data = await res.json();
  if (!res.ok) throw new Error(path + ' ' + JSON.stringify(data.errors?.map(({ code, detail }) => ({ code, detail }))));
  return data;
}

const out = (label, value) => console.log(label, JSON.stringify(value));

const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data[0];
if (!app) throw new Error('App not found');
out('APP', { id: app.id, name: app.attributes.name, primaryLocale: app.attributes.primaryLocale });

const versions = (await get(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data;
for (const v of versions) {
  const build = (await get(`/v1/appStoreVersions/${v.id}/build`)).data;
  const review = (await get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`)).data;
  const locales = (await get(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`)).data;
  const shots = {};
  for (const l of locales) {
    const sets = (await get(`/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots&limit=50`)).data;
    shots[l.attributes.locale] = Object.fromEntries(sets.map((s) => [s.attributes.screenshotDisplayType, s.relationships?.appScreenshots?.data?.length ?? 0]));
  }
  out('VERSION', {
    id: v.id, version: v.attributes.versionString, state: v.attributes.appStoreState, releaseType: v.attributes.releaseType,
    build: build ? { version: build.attributes.version, state: build.attributes.processingState } : null,
    reviewContact: review ? ['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone'].every((k) => !!review.attributes[k]) : false,
    reviewNotes: review?.attributes.notes ? review.attributes.notes.slice(0, 80) : null,
    demoAccountRequired: review?.attributes.demoAccountRequired ?? null,
    locales: locales.map((l) => ({ locale: l.attributes.locale, description: !!l.attributes.description, keywords: !!l.attributes.keywords, supportUrl: !!l.attributes.supportUrl, privacy: !!l.attributes.privacyPolicyUrl })),
    screenshots: shots
  });
}

const builds = (await get(`/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5`)).data;
out('BUILDS', builds.map((b) => ({ version: b.attributes.version, state: b.attributes.processingState, uploaded: b.attributes.uploadedDate })));

const groups = (await get(`/v1/apps/${app.id}/subscriptionGroups?include=subscriptions`)).data;
for (const g of groups) {
  const subs = (await get(`/v1/subscriptionGroups/${g.id}/subscriptions`)).data;
  for (const s of subs) {
    let screenshot = null;
    try { screenshot = (await get(`/v1/subscriptions/${s.id}/appStoreReviewScreenshot`)).data; } catch { /* 沒有就是 null */ }
    out('SUBSCRIPTION', { productId: s.attributes.productId, state: s.attributes.state, reviewScreenshot: screenshot ? screenshot.attributes.assetDeliveryState?.state ?? 'present' : null });
  }
}

const submissions = (await get(`/v1/apps/${app.id}/reviewSubmissions?limit=10`)).data;
out('SUBMISSIONS', submissions.map((s) => ({ id: s.id, state: s.attributes.state, submitted: s.attributes.submittedDate })));
