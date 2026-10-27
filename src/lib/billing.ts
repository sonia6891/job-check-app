import { Platform } from 'react-native';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase
} from 'expo-iap';
import { api } from './api';

/**
 * Pro 訂閱（月費 NT$60、年費 NT$590），和「喵的又要上班了」一樣直接用 Apple StoreKit 2，不經過 RevenueCat。
 * 買完把 Apple 簽章的交易（JWS）送到後端 verify-app-store-transaction 驗證並寫進 profiles.plan，
 * 後端確認後才 finishTransaction；續訂、到期、退款由 Apple 直接通知後端 app-store-notifications。
 * 購買時帶 appAccountToken（Supabase 使用者 ID），Apple 的通知才知道是哪個帳號。
 */
export const PRODUCT_IDS = { MONTHLY: 'jobcheck_pro_monthly', ANNUAL: 'jobcheck_pro_yearly' } as const;
export type ProPlanType = keyof typeof PRODUCT_IDS;
export type ProPackage = { type: ProPlanType; sku: string; priceString: string; price: number | null };

const SKUS: string[] = Object.values(PRODUCT_IDS);

export const billingConfigured = Platform.OS === 'ios';

let connected: Promise<boolean> | null = null;
let currentUserId: string | null = null;
// 正在購買的商品：購買結果從 listener 回來後交給等著的 purchase()。
const waiting = new Map<string, { resolve: (isPro: boolean) => void; reject: (e: unknown) => void }>();

/** 交給後端驗證；後端確認了才結束交易，失敗的話 StoreKit 下次啟動會再送一次。 */
async function verifyAndFinish(purchase: Purchase, restore = false) {
  if (!purchase.purchaseToken || !SKUS.includes(purchase.productId)) return false;
  const result = await api.verifyAppStoreTransaction(purchase.purchaseToken, restore);
  await finishTransaction({ purchase, isConsumable: false });
  return result.plan === 'pro';
}

function connect() {
  if (!connected) {
    connected = (async () => {
      await initConnection();
      // 購買、續訂、家長同意後才完成的購買、上次沒處理完的交易，都從這裡進來。
      purchaseUpdatedListener(purchase => {
        const pending = waiting.get(purchase.productId);
        void verifyAndFinish(purchase).then(
          isPro => { waiting.delete(purchase.productId); pending?.resolve(isPro); },
          // Apple 已經扣款了，只是後端還沒確認；交易沒結束，下次啟動或按恢復購買會再送。
          error => {
            waiting.delete(purchase.productId);
            console.warn('verify-app-store-transaction', error);
            pending?.reject(new Error('付款已完成，正在確認訂閱。請稍後再打開 App，或在方案頁按「恢復購買」。'));
          }
        );
      });
      purchaseErrorListener(error => {
        const key = error.productId && waiting.has(error.productId) ? error.productId : [...waiting.keys()][0];
        const pending = key ? waiting.get(key) : undefined;
        if (!pending || !key) return;
        waiting.delete(key);
        pending.reject(error.code === ErrorCode.UserCancelled ? { userCancelled: true } : new Error(error.message || '購買沒有完成。'));
      });
      return true;
    })().catch(error => { connected = null; throw error; });
  }
  return connected;
}

/** 把這個 Apple ID 目前有效的 Pro 交易送給後端，記到目前登入的帳號。 */
async function syncToCurrentAccount(restore: boolean) {
  await connect();
  const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  let isPro = false;
  let failure: unknown = null;
  for (const purchase of purchases) {
    if (!SKUS.includes(purchase.productId)) continue;
    try {
      if (await verifyAndFinish(purchase, restore)) isPro = true;
    } catch (error) {
      failure = error;
    }
  }
  if (!isPro && failure) throw failure;
  return isPro;
}

export const billing = {
  async configure(appUserId: string) {
    if (!billingConfigured) return { configured: false as const };
    currentUserId = appUserId;
    await connect();
    return { configured: true as const };
  },

  async identify(appUserId: string) {
    const result = await this.configure(appUserId);
    return result.configured ? true : null;
  },

  async logOut() {
    currentUserId = null;
  },

  /** 這個 Apple ID 有沒有有效的 Pro（不經後端，只問 StoreKit）。 */
  async getStatus() {
    if (!billingConfigured) return { configured: false as const, isPro: false };
    await connect();
    const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    return { configured: true as const, isPro: purchases.some(p => SKUS.includes(p.productId)) };
  },

  async getProPackages(): Promise<ProPackage[]> {
    if (!billingConfigured) return [];
    await connect();
    const products = (await fetchProducts({ skus: SKUS, type: 'subs' })) ?? [];
    return (Object.keys(PRODUCT_IDS) as ProPlanType[]).flatMap(type => {
      const product = products.find(p => p.id === PRODUCT_IDS[type]);
      return product ? [{ type, sku: product.id, priceString: product.displayPrice, price: product.price ?? null }] : [];
    });
  },

  async purchase(pkg: ProPackage) {
    if (!billingConfigured || !currentUserId) throw new Error('購買功能還沒設定好。');
    await connect();
    const done = new Promise<boolean>((resolve, reject) => waiting.set(pkg.sku, { resolve, reject }));
    try {
      await requestPurchase({ request: { apple: { sku: pkg.sku, appAccountToken: currentUserId } }, type: 'subs' });
    } catch (error: any) {
      waiting.delete(pkg.sku);
      if (error?.code === ErrorCode.UserCancelled) throw { userCancelled: true };
      throw error;
    }
    return { isPro: await done };
  },

  // 訪客買了 Pro 再登入正式帳號時，把訂閱移到新帳號，之後的續訂才會記在新帳號。
  async syncPurchases() {
    if (!billingConfigured) return;
    await syncToCurrentAccount(false);
  },

  async restore() {
    if (!billingConfigured) throw new Error('購買功能還沒設定好。');
    return { isPro: await syncToCurrentAccount(true) };
  }
};
