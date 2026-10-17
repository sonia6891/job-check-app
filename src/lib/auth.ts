import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { api } from './api';
import { prefs } from './prefs';
import { describeTransferResult, transferExpired, type TransferNotice } from './accountTransferStatus';
import { transferVault, type PendingGuestTransfer } from './transferVault';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Linking.createURL('auth/callback');
let pendingGuestTransfer: PendingGuestTransfer | null = null;
// Opaque transfer tokens are kept ONLY in memory. Never log or persist them as plaintext.
let transferNotice: TransferNotice = { status: 'none', message: '' };

async function restorePendingTransfer(): Promise<TransferNotice> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return transferNotice;
  if (pendingGuestTransfer) return transferNotice;
  try {
    const saved = await transferVault.read(data.user.id);
    if (saved.status === 'valid') {
      pendingGuestTransfer = saved.value;
      transferNotice = {
        status: 'pending',
        message: '已找到尚在期限內的訪客轉移驗證，請按「重試轉移訪客資料」。'
      };
    } else if (saved.status === 'expired') {
      transferNotice = { status: 'expired', message: '訪客轉移驗證已到期。請勿再次切換帳號，聯絡客服協助確認舊資料。' };
    } else if (saved.status === 'wrong_account') {
      transferNotice = { status: 'expired', message: '此轉移驗證屬於其他登入帳號，為安全起見已作廢。' };
    } else if (saved.status === 'invalid') {
      transferNotice = { status: 'expired', message: '裝置上的轉移驗證已無法安全使用，請聯絡客服。' };
    }
  } catch {
    transferNotice = { status: 'pending', message: '無法讀取裝置上的加密轉移驗證。請檢查裝置安全設定後重試，勿先登出。' };
  }
  return transferNotice;
}

async function redeemPendingGuestTransfer() {
  const pending = pendingGuestTransfer;
  if (!pending) return transferNotice;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous || data.user.id !== pending.targetUserId) {
    throw new Error('帳號身分已改變，不能將訪客資料轉移到其他帳號。');
  }
  if (transferExpired(pending.expiresAt, Date.now())) {
    pendingGuestTransfer = null;
    await transferVault.clear().catch(() => {});
    transferNotice = { status: 'expired', message: '訪客資料轉移驗證已超過有效期限，請聯絡客服協助檢查原訪客資料。' };
    throw new Error(transferNotice.message);
  }
  const result = await api.redeemAccountTransfer(pending.token);
  const notice = describeTransferResult(result);
  transferNotice = notice;
  if (notice.status === 'completed' || notice.status === 'partial') {
    pendingGuestTransfer = null;
    await transferVault.clear().catch(() => {});
  }
  return notice;
}

function getParam(url: string, key: string) {
  try {
    const parsed = new URL(url);
    const direct = parsed.searchParams.get(key);
    if (direct) return direct;
    const hash = parsed.hash.replace(/^#/, '');
    return new URLSearchParams(hash).get(key);
  } catch {
    return null;
  }
}

async function createSessionFromUrl(url: string) {
  const code = getParam(url, 'code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  const accessToken = getParam(url, 'access_token');
  const refreshToken = getParam(url, 'refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) throw error;
    return data.session;
  }

  throw new Error('登入完成，但沒有收到可建立 Session 的憑證。');
}

async function issueGuestTransferToken(): Promise<{ token: string; expiresAt: string | null } | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error('登入前無法確認訪客身分，請稍後重試。');
  if (!data.user?.is_anonymous) return null;
  // Never silently skip transfer token creation; otherwise OAuth discards the guest session.
  const result = await api.createAccountTransfer();
  if (result.status !== 'created' || !result.transfer_token) {
    throw new Error('無法準備訪客資料轉移，已暫停登入以避免遺失分析紀錄。');
  }
  return { token: result.transfer_token, expiresAt: result.expires_at || null };
}

async function finishPermanentSignIn(transfer: { token: string; expiresAt: string | null } | null) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error('登入後找不到 Session。');

  if (transfer) {
    pendingGuestTransfer = { token: transfer.token, targetUserId: session.user.id, expiresAt: transfer.expiresAt || '' };
    transferNotice = { status: 'pending', message: '已登入正式帳號，但訪客資料轉移尚未完成。請在此畫面重新確認。' };
    try {
      // The one-time token is encrypted on device only after binding it to the new account.
      const savedSecurely = transfer.expiresAt
        ? await transferVault.write(pendingGuestTransfer)
        : false;
      if (!savedSecurely) {
        transferNotice = {
          status: 'pending',
          message: '此環境未提供短效憑證的原生加密保存，請在本次開啟期間完成轉移。'
        };
      }
    } catch {
      transferNotice = { status: 'pending', message: '裝置安全儲存暫不可用，請在本次開啟期間重試轉移，避免關閉 App。' };
    }
    try {
      await redeemPendingGuestTransfer();
    } catch {
      // Keep the short-lived credential in memory and encrypted native storage when available.
      // Never log or expose the bearer token.
    }
  } else {
    transferNotice = { status: 'none', message: '' };
  }
  return session;
}

export const authActions = {
  redirectTo,

  getGuestTransferNotice(): TransferNotice {
    return transferNotice;
  },

  async restoreGuestTransfer(): Promise<TransferNotice> {
    return restorePendingTransfer();
  },

  async retryGuestTransfer(): Promise<TransferNotice> {
    await restorePendingTransfer();
    if (!pendingGuestTransfer) {
      throw new Error('目前沒有可重試的訪客資料轉移驗證。');
    }
    try { return await redeemPendingGuestTransfer(); }
    catch (e) {
      if (transferNotice.status !== 'expired') {
        transferNotice = { status: 'pending', message: '資料轉移尚未成功，請保持登入狀態並在期限內重試。' };
      }
      throw e;
    }
  },

  async signInWithGoogle() {
    const transferToken = await issueGuestTransferToken();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });
    if (error) throw error;
    if (!data.url) throw new Error('Google 登入網址建立失敗。');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      throw new Error(result.type === 'cancel' ? '已取消 Google 登入。' : 'Google 登入未完成。');
    }

    await createSessionFromUrl(result.url);
    return finishPermanentSignIn(transferToken);
  },

  async signInWithApple() {
    if (Platform.OS !== 'ios') throw new Error('Apple 原生登入目前只在 iOS 顯示。');
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) throw new Error('此裝置目前無法使用 Apple 登入。');

    const transferToken = await issueGuestTransferToken();
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL
      ],
      nonce: hashedNonce
    });

    if (!credential.identityToken) throw new Error('Apple 沒有回傳 identity token。');

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
      access_token: credential.authorizationCode ?? undefined
    });
    if (error) throw error;

    const fullName = [
      credential.fullName?.givenName,
      credential.fullName?.middleName,
      credential.fullName?.familyName
    ].filter(Boolean).join(' ');

    if (fullName) {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from('profiles').update({ display_name: fullName }).eq('id', data.user.id);
      }
    }

    return finishPermanentSignIn(transferToken);
  },

  /** 刪除帳號與所有資料，之後換成全新的訪客身分；本機草稿也一併清除。 */
  async deleteAccount() {
    await api.deleteAccount();
    pendingGuestTransfer = null;
    transferNotice = { status: 'none', message: '' };
    await transferVault.clear().catch(() => {});
    await prefs.setDraft({ text: '', sourceUrl: null });
    // 帳號已刪除，只清本機 Session，不再呼叫伺服器登出。
    await supabase.auth.signOut({ scope: 'local' });
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.session;
  },

  async signOutToGuest() {
    await restorePendingTransfer();
    if (pendingGuestTransfer || transferNotice.status === 'expired') {
      throw new Error('訪客資料轉移尚未安全完成。請先重試或聯絡客服，避免紀錄遺失。');
    }
    await supabase.auth.signOut();
    await transferVault.clear().catch(() => {});
    transferNotice = { status: 'none', message: '' };
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.session;
  }
};
