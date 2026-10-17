import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

/**
 * Pro 訂閱（RevenueCat）。月費 NT$60、年費 NT$590，商品在 App Store Connect 建立，
 * RevenueCat 的 entitlement「pro」對應這兩個商品。公開 SDK 金鑰放在建置環境變數（不是秘密）。
 * 購買後 RevenueCat 會呼叫 Supabase 的 revenuecat-webhook 更新 profiles.plan，後端額度以那邊為準。
 */
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';
const PRO_ENTITLEMENT = process.env.EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID || 'pro';

let configured = false;
let currentAppUserId: string | null = null;

function platformKey() {
  if (Platform.OS === 'ios') return IOS_KEY;
  if (Platform.OS === 'android') return ANDROID_KEY;
  return '';
}

function isPro(info: CustomerInfo | null | undefined) {
  return Boolean(info?.entitlements.active?.[PRO_ENTITLEMENT]);
}

export const billingConfigured = Boolean(platformKey());

export const billing = {
  entitlementId: PRO_ENTITLEMENT,

  async configure(appUserId: string) {
    const apiKey = platformKey();
    if (!apiKey) return { configured: false as const };

    if (!configured) {
      if (__DEV__) void Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey, appUserID: appUserId });
      configured = true;
      currentAppUserId = appUserId;
      return { configured: true as const };
    }

    if (currentAppUserId !== appUserId) {
      await Purchases.logIn(appUserId);
      currentAppUserId = appUserId;
    }
    return { configured: true as const };
  },

  async identify(appUserId: string) {
    const result = await this.configure(appUserId);
    if (!result.configured) return null;
    return Purchases.getCustomerInfo();
  },

  async logOut() {
    if (!configured) return;
    try {
      await Purchases.logOut();
      currentAppUserId = null;
    } catch {
      // 匿名身分登出會丟錯，不影響切換帳號。
    }
  },

  async getStatus() {
    if (!configured) return { configured: false as const, isPro: false, customerInfo: null };
    const customerInfo = await Purchases.getCustomerInfo();
    return { configured: true as const, isPro: isPro(customerInfo), customerInfo };
  },

  async getProPackages(): Promise<PurchasesPackage[]> {
    if (!configured) return [];
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  },

  async purchase(pkg: PurchasesPackage) {
    if (!configured) throw new Error('購買功能還沒設定好。');
    const result = await Purchases.purchasePackage(pkg);
    return { ...result, isPro: isPro(result.customerInfo) };
  },

  async restore() {
    if (!configured) throw new Error('購買功能還沒設定好。');
    const customerInfo = await Purchases.restorePurchases();
    return { customerInfo, isPro: isPro(customerInfo) };
  }
};
