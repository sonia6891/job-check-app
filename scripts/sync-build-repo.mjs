#!/usr/bin/env node
// 把打包 iPhone 版和 Android 版需要的檔案同步到公開的打包專案 sonia6891/job-check-app。
// 公開專案的 GitHub Actions 免費；後端（supabase/）、文件、測試與開發紀錄都留在這個私人專案。
// 只拿已提交的版本（HEAD），預覽用的暫時修改不會跑過去。
//
// 用法：node scripts/sync-build-repo.mjs [--build unsigned|testflight|android]
// android：打包已簽署的 AAB 放在 Actions 的附件，不會上傳到 Google Play。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_REPO = 'sonia6891/job-check-app';
const TARGET = join(ROOT, '..', 'job-check-app');
// 公開專案只放這些：App 畫面程式碼、圖示、打包腳本與 iOS／Android workflow。
const PUBLIC_PATHS = ['app', 'src', 'assets', 'public', 'plugins', 'app.json', 'package.json', 'tsconfig.json',
  'expo-env.d.ts', 'eas.json', '.gitignore', 'scripts/build-ios.sh', 'scripts/ci-signing.mjs', 'scripts/patch-native-modules.mjs', 'scripts/prepare-brand-assets.mjs',
  'scripts/verify-native-config.mjs', 'docs/ios-without-expo-account.md', '.github/workflows/ios-native.yml', '.github/workflows/apple-certificates.yml',
  'scripts/asc-status.mjs', '.github/workflows/asc-status.yml', 'scripts/build-android-aab.sh', '.github/workflows/android-release.yml', 'docs/android-play-release.md', 'scripts/asc-prepare-review.mjs', '.github/workflows/asc-prepare-review.yml', 'store/app-store-screenshots', 'store/listing-zh-Hant.json', 'scripts/sim-shots.sh', '.github/workflows/ios-sim-shots.yml', 'scripts/sim-duo.sh', '.github/workflows/ios-sim-duo.yml'];

const README = `# 職缺體檢 App（打包專案）

這裡只放「職缺體檢」App 的畫面程式碼與打包設定，用 GitHub Actions 打包 iPhone 版（上傳 TestFlight）和 Android 版（已簽署的 AAB）。
後端與開發工作在另一個專案進行，這裡的內容由同步腳本自動更新，請不要直接修改。

打包方式見 [docs/ios-without-expo-account.md](docs/ios-without-expo-account.md) 和 [docs/android-play-release.md](docs/android-play-release.md)。

未附授權條款，保留所有權利。
`;

const argv = process.argv.slice(2);
const buildIndex = argv.indexOf('--build');
const buildMode = buildIndex >= 0 ? argv[buildIndex + 1] : undefined;
if (buildMode && !['unsigned', 'testflight', 'android'].includes(buildMode)) fail('--build 只能是 unsigned、testflight 或 android');

function fail(message) {
  console.error('✗ ' + message);
  process.exit(1);
}

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, ...options });
  if (r.status !== 0) fail(`${cmd} ${args.slice(0, 3).join(' ')} 失敗：${String(r.stderr || r.error?.message || '').trim()}`);
  return r.stdout;
}
const text = (cmd, args, options) => String(run(cmd, args, options)).trim();
const git = (args, cwd = ROOT) => text('git', args, { cwd });

async function main() {
  const dirty = git(['status', '--porcelain', '--', ...PUBLIC_PATHS]);
  if (dirty) console.log('! 這些修改還沒提交，不會同步過去：\n' + dirty.split('\n').map(l => '  ' + l).join('\n'));
  const sha = git(['rev-parse', '--short', 'HEAD']);

  if (!existsSync(join(TARGET, '.git'))) {
    console.log(`▸ 下載公開專案到 ${TARGET}`);
    text('gh', ['repo', 'clone', BUILD_REPO, TARGET]);
  }
  for (const key of ['user.name', 'user.email']) {
    const value = spawnSync('git', ['config', '--local', key], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
    if (value) git(['config', key, value], TARGET);
  }

  // 整個換成私人專案 HEAD 的內容，被刪掉的檔案也會跟著刪。
  for (const name of readdirSync(TARGET)) if (name !== '.git') rmSync(join(TARGET, name), { recursive: true, force: true });
  const entries = git(['ls-tree', '-r', '-z', 'HEAD', '--', ...PUBLIC_PATHS]).split('\0').filter(Boolean);
  for (const entry of entries) {
    const [meta, path] = entry.split('\t');
    const [, type, blob] = meta.split(' ');
    if (type !== 'blob') continue;
    mkdirSync(dirname(join(TARGET, path)), { recursive: true });
    writeFileSync(join(TARGET, path), run('git', ['cat-file', 'blob', blob]));
  }
  writeFileSync(join(TARGET, 'README.md'), README);
  console.log(`▸ 已複製 ${entries.length} 個檔案（私人專案 ${sha}）`);

  git(['add', '-A'], TARGET);
  if (git(['status', '--porcelain'], TARGET)) {
    git(['commit', '-q', '-m', `同步 App 程式碼（${sha}）\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`], TARGET);
    git(['branch', '-M', 'main'], TARGET);
    git(['push', '-q', 'origin', 'HEAD:refs/heads/main'], TARGET);
    console.log(`▸ 已推上 https://github.com/${BUILD_REPO}`);
  } else console.log('▸ 公開專案已經是最新的');

  if (!buildMode) return;
  // 剛推上的 workflow 要等幾秒 GitHub 才認得。
  for (let i = 0; i < 6; i++) {
    const args = buildMode === 'android'
      ? ['workflow', 'run', 'android-release.yml', '-R', BUILD_REPO, '--ref', 'main']
      : ['workflow', 'run', 'ios-native.yml', '-R', BUILD_REPO, '--ref', 'main', '-f', `mode=${buildMode}`];
    const r = spawnSync('gh', args, { encoding: 'utf8' });
    if (r.status === 0) {
      console.log(`▸ 已開始 ${buildMode} 打包：https://github.com/${BUILD_REPO}/actions`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    if (i === 5) fail('沒能開始打包：' + r.stderr.trim());
  }
}

await main();
