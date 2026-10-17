#!/usr/bin/env node
// GitHub 打包機用：沒有存好的發佈憑證時，用 App Store Connect API 金鑰臨時建立
// Apple Distribution 憑證與 App Store 描述檔；上傳後等 Apple 處理完再撤銷，不佔憑證名額。
// 打包專案是公開的，打包紀錄任何人都看得到，所以這裡不印出金鑰、信箱、名字或任何 ID。
//
//   node scripts/ci-signing.mjs key <dir>              把 API 金鑰寫成 <dir>/AuthKey.p8（給 xcodebuild 上傳用）
//   node scripts/ci-signing.mjs create <dir>           建立憑證與描述檔
//   node scripts/ci-signing.mjs finish <dir> <build>   等 Apple 處理完、交給內部測試，再撤銷憑證
//   node scripts/ci-signing.mjs cleanup <dir>          打包失敗時撤銷憑證（沒建立過就不做事）
//   node scripts/ci-signing.mjs list <dir>             列出帳號裡的發佈憑證（只印類型與日期）
import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE_ID = 'com.lumilab.jobcheck';
// ASC_API_BASE 只給測試用的假伺服器。
const API = process.env.ASC_API_BASE || 'https://api.appstoreconnect.apple.com/v1';
const [command, dir, buildNumber] = process.argv.slice(2);
const file = name => join(dir, name);
const statePath = () => file('asc-state.json');

// 丟出後由最外層印出並結束；不直接 process.exit，Windows 上網路連線未關時會當掉。
class Stop extends Error {}
function fail(message) {
  throw new Stop(message);
}
const warn = message => console.log('::warning::' + message);

// GitHub secret 可能是 .p8 原文，也可能是 Base64。
function keyText() {
  const raw = (process.env.APP_STORE_CONNECT_KEY || '').trim();
  if (!raw) fail('缺少 App Store Connect API 金鑰（APPLE_ASC_KEY_P8）');
  return raw.includes('BEGIN') ? raw.replace(/\\n/g, '\n') + '\n' : Buffer.from(raw, 'base64').toString('utf8');
}

const b64url = data => Buffer.from(data).toString('base64url');
let privateKey;
function token() {
  privateKey ||= createPrivateKey(keyText());
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: process.env.APP_STORE_CONNECT_KEY_ID, typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: process.env.APP_STORE_CONNECT_ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64url(sig)}`;
}

class ApiError extends Error {
  constructor(status, detail) { super(detail); this.status = status; }
}

async function api(method, path, body, attempt = 1) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    // 連線問題時重試查詢與刪除；建立類的請求不重試，避免重複建立憑證。
    if (method !== 'POST' && attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      return api(method, path, body, attempt + 1);
    }
    throw e;
  }
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* 非 JSON 錯誤頁 */ }
  if (!res.ok) {
    const e = json.errors?.[0];
    throw new ApiError(res.status, [e?.title, e?.detail].filter(Boolean).join('：') || `HTTP ${res.status}`);
  }
  return json;
}

function explain(e) {
  if (!(e instanceof ApiError)) return e.message;
  if (e.status === 401) return 'Apple 不接受這把 API 金鑰：Key ID、Issuer ID 或 .p8 內容不對，或金鑰已被撤銷。';
  if (e.status === 403) return 'API 金鑰權限不夠：建立發佈憑證需要「管理（Admin）」角色的金鑰。Apple 回覆：' + e.message;
  return `Apple 回覆 ${e.status}：${e.message}`;
}

const ref = (type, id) => ({ data: { type, id } });
const load = () => existsSync(statePath()) ? JSON.parse(readFileSync(statePath(), 'utf8')) : null;
const save = state => writeFileSync(statePath(), JSON.stringify(state));

function openssl(args, env = {}) {
  const bin = existsSync('/usr/bin/openssl') ? '/usr/bin/openssl' : 'openssl';
  const r = spawnSync(bin, args, { encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`openssl ${args[0]} 失敗：${(r.stderr || '').trim()}`);
}

async function create() {
  const ids = await api('GET', `/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=20`);
  let bundle = ids.data.find(b => b.attributes.identifier === BUNDLE_ID);
  if (!bundle) {
    bundle = (await api('POST', '/bundleIds', { data: { type: 'bundleIds',
      attributes: { identifier: BUNDLE_ID, name: 'Job Check', platform: 'IOS' } } })).data;
    console.log(`已註冊 App ID ${BUNDLE_ID}`);
  }
  const caps = await api('GET', `/bundleIds/${bundle.id}/bundleIdCapabilities`);
  if (!caps.data.some(c => c.attributes.capabilityType === 'APPLE_ID_AUTH')) {
    await api('POST', '/bundleIdCapabilities', { data: {
      type: 'bundleIdCapabilities',
      attributes: { capabilityType: 'APPLE_ID_AUTH', settings: [{ key: 'APPLE_ID_AUTH_APP_CONSENT', options: [{ key: 'PRIMARY_APP_CONSENT' }] }] },
      relationships: { bundleId: ref('bundleIds', bundle.id) }
    } });
    console.log('已開啟「使用 Apple 登入」功能');
  }

  // App Store Connect 的 App 只能在網頁上建立（Apple API 不提供）。
  const apps = await api('GET', `/apps?filter[bundleId]=${BUNDLE_ID}&limit=5`);
  const app = apps.data.find(a => a.attributes.bundleId === BUNDLE_ID);
  if (!app) fail(`App Store Connect 還沒有這個 App。請到 App Store Connect →「App」→「＋」→「新增 App」，套件 ID 選 ${BUNDLE_ID}，建立後重新執行。`);
  await ensureInternalGroup(app.id).catch(e => warn('TestFlight 內部測試群組沒有自動建立：' + explain(e)));

  writeFileSync(file('csr.cnf'), '[req]\nprompt = no\ndistinguished_name = dn\n[dn]\nCN = JobCheck CI Distribution\n');
  openssl(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-config', file('csr.cnf'), '-keyout', file('dist.key'), '-out', file('dist.csr')]);
  let cert;
  try {
    cert = (await api('POST', '/certificates', { data: { type: 'certificates', attributes: {
      certificateType: 'DISTRIBUTION', csrContent: readFileSync(file('dist.csr'), 'utf8') } } })).data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) await list().catch(() => {});
    if (e instanceof ApiError && e.status === 409) fail('發佈憑證已達上限。請到 developer.apple.com → Certificates 撤銷一張不用的 Distribution 憑證後重新執行。Apple 回覆：' + e.message);
    throw e;
  }
  const state = { appId: app.id, certId: cert.id };
  save(state);

  writeFileSync(file('dist.cer'), Buffer.from(cert.attributes.certificateContent, 'base64'));
  openssl(['x509', '-inform', 'DER', '-in', file('dist.cer'), '-out', file('dist.pem')]);
  const password = randomBytes(24).toString('hex');
  // 3DES／SHA1 格式，macOS 的 security 指令才讀得懂。
  openssl(['pkcs12', '-export', '-inkey', file('dist.key'), '-in', file('dist.pem'), '-out', file('certificate.p12'),
    '-name', 'JobCheck CI Distribution', '-passout', 'env:JOBCHECK_P12_PASS',
    '-keypbe', 'PBE-SHA1-3DES', '-certpbe', 'PBE-SHA1-3DES', '-macalg', 'sha1'], { JOBCHECK_P12_PASS: password });
  writeFileSync(file('p12-password'), password);

  const profile = (await api('POST', '/profiles', { data: {
    type: 'profiles',
    attributes: { name: `JobCheck CI ${Date.now()}`, profileType: 'IOS_APP_STORE' },
    relationships: { bundleId: ref('bundleIds', bundle.id), certificates: { data: [{ type: 'certificates', id: cert.id }] } }
  } })).data;
  save({ ...state, profileId: profile.id });
  writeFileSync(file('profile.mobileprovision'), Buffer.from(profile.attributes.profileContent, 'base64'));
  for (const f of ['csr.cnf', 'dist.csr', 'dist.pem', 'dist.cer', 'dist.key']) rmSync(file(f), { force: true });
  console.log('已建立這次打包用的臨時發佈憑證與 App Store 描述檔');
}

async function ensureInternalGroup(appId) {
  const groups = await api('GET', `/apps/${appId}/betaGroups?limit=50`);
  const internal = groups.data.filter(g => g.attributes.isInternalGroup);
  if (internal.length) return internal;
  const group = (await api('POST', '/betaGroups', { data: {
    type: 'betaGroups',
    attributes: { name: '內部測試', isInternalGroup: true, hasAccessToAllBuilds: true },
    relationships: { app: ref('apps', appId) }
  } })).data;
  console.log('已建立 TestFlight 內部測試群組「內部測試」');
  return [group];
}

// 內部測試群組還沒有人時，把 App Store Connect 團隊成員加進去（只印人數）。
async function giveToInternalTesters(appId, buildId) {
  for (const group of await ensureInternalGroup(appId)) {
    if (!group.attributes.hasAccessToAllBuilds) {
      await api('POST', `/betaGroups/${group.id}/relationships/builds`, { data: [{ type: 'builds', id: buildId }] });
    }
    const testers = await api('GET', `/betaGroups/${group.id}/betaTesters?limit=1`);
    if (testers.data.length) continue;
    const users = await api('GET', '/users?limit=10');
    let added = 0;
    for (const user of users.data) {
      const { username, firstName, lastName } = user.attributes;
      if (!username?.includes('@')) continue;
      await api('POST', '/betaTesters', { data: {
        type: 'betaTesters',
        attributes: { email: username, firstName, lastName },
        relationships: { betaGroups: { data: [{ type: 'betaGroups', id: group.id }] } }
      } }).then(() => added++, e => warn('有一位成員沒能加入內部測試：' + explain(e)));
    }
    console.log(`已把 ${added} 位 App Store Connect 團隊成員加入內部測試`);
  }
}

async function waitForBuild(appId) {
  const started = Date.now();
  for (;;) {
    const minutes = Math.round((Date.now() - started) / 60000);
    const builds = await api('GET', `/builds?filter[app]=${appId}&filter[version]=${buildNumber}&limit=1`);
    const build = builds.data[0];
    const state = build?.attributes.processingState;
    if (state === 'VALID') {
      console.log(`Apple 處理完成（${minutes} 分鐘），已出現在 TestFlight`);
      return build;
    }
    if (state === 'FAILED' || state === 'INVALID') fail(`Apple 處理這個版本失敗（${state}）。請到 App Store Connect → TestFlight 查看原因，Apple 也會寄信說明。`);
    if (minutes >= 45) return null;
    if (minutes % 5 === 0) console.log(`等 Apple 處理中（${build ? state : '還沒收到'}，${minutes} 分鐘）…`);
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}

// 列出帳號裡的發佈憑證（只印類型與日期，不印名字）。到期日減一年約等於建立日。
async function list() {
  const certs = (await api('GET', '/certificates?limit=200')).data
    .filter(c => /DISTRIBUTION/.test(c.attributes.certificateType));
  console.log(`發佈憑證共 ${certs.length} 張：`);
  certs.forEach((c, i) => console.log(`  ${i + 1}. ${c.attributes.certificateType}，到期 ${String(c.attributes.expirationDate).slice(0, 10)}`));
  return certs;
}

async function cleanup() {
  const state = load();
  if (!state) return;
  if (state.profileId) await api('DELETE', `/profiles/${state.profileId}`).catch(e => warn('臨時描述檔沒有刪除：' + explain(e)));
  if (state.certId) await api('DELETE', `/certificates/${state.certId}`).then(
    () => console.log('已撤銷這次打包用的臨時憑證'),
    e => warn('臨時憑證沒有撤銷，請到 developer.apple.com → Certificates 手動撤銷：' + explain(e)));
  rmSync(statePath(), { force: true });
}

async function finish() {
  const state = load();
  if (!state) return;
  const build = await waitForBuild(state.appId);
  if (!build) {
    // Apple 還沒處理完就先不撤銷，避免影響這個版本；憑證一年後自動失效。
    warn('等了 45 分鐘 Apple 還沒處理完。版本稍後會自己出現在 TestFlight；這次的臨時憑證沒有撤銷，名額不夠時再到 developer.apple.com 撤銷。');
    rmSync(statePath(), { force: true });
    return;
  }
  await giveToInternalTesters(state.appId, build.id).catch(e => warn('沒能自動交給內部測試，請到 TestFlight 頁面加入測試人員：' + explain(e)));
  await cleanup();
}

const commands = {
  key: async () => writeFileSync(file('AuthKey.p8'), keyText()),
  create, finish, cleanup, list
};
async function main() {
  if (!commands[command] || !dir) fail('用法：node scripts/ci-signing.mjs key|create|finish|cleanup|list <dir> [build]');
  if (command === 'finish' && !/^\d+$/.test(buildNumber || '')) fail('finish 需要建置號');
  await commands[command]();
}
await main().catch(e => {
  console.log('::error::' + (e instanceof Stop ? e.message : explain(e)).replace(/\n/g, '%0A'));
  process.exitCode = 1;
});
