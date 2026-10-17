import { Platform } from 'react-native';
import { transferExpired } from './accountTransferStatus';

const KEY = 'jobcheck.pending_guest_transfer.v1';
export type PendingGuestTransfer = {
  token: string;
  targetUserId: string;
  expiresAt: string;
};

export type PendingTransferValidation =
  | { status: 'valid'; value: PendingGuestTransfer }
  | { status: 'empty' | 'expired' | 'invalid' | 'wrong_account' };

/** Pure, side-effect free validation. A token may only be reused for its originally bound account. */
export function validatePendingTransfer(
  candidate: unknown, targetUserId: string, now: number
): PendingTransferValidation {
  if (candidate === null || candidate === undefined) return { status: 'empty' };
  if (typeof candidate !== 'object' || Array.isArray(candidate)) return { status: 'invalid' };
  const input = candidate as Record<string, unknown>;
  if (typeof input.token !== 'string' || !/^[a-f0-9]{64}$/i.test(input.token)
    || typeof input.targetUserId !== 'string' || !input.targetUserId
    || typeof input.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(input.expiresAt))) {
    return { status: 'invalid' };
  }
  if (transferExpired(input.expiresAt, now)) return { status: 'expired' };
  if (input.targetUserId !== targetUserId) return { status: 'wrong_account' };
  return {
    status: 'valid',
    value: { token: input.token, targetUserId: input.targetUserId, expiresAt: input.expiresAt }
  };
}

/**
 * Native-only encrypted cache for a very short-lived one-time credential.
 * Web deliberately never stores this credential in localStorage or AsyncStorage.
 */
export const transferVault = {
  supported: Platform.OS === 'ios' || Platform.OS === 'android',

  async write(value: PendingGuestTransfer): Promise<boolean> {
    if (!this.supported) return false;
    const checked = validatePendingTransfer(value, value.targetUserId, Date.now());
    if (checked.status !== 'valid') return false;
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(KEY, JSON.stringify(value));
    return true;
  },

  async read(targetUserId: string): Promise<PendingTransferValidation> {
    if (!this.supported) return { status: 'empty' };
    const SecureStore = await import('expo-secure-store');
    const data = await SecureStore.getItemAsync(KEY);
    if (!data) return { status: 'empty' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      await this.clear();
      return { status: 'invalid' };
    }
    const state = validatePendingTransfer(parsed, targetUserId, Date.now());
    if (state.status !== 'valid') await this.clear();
    return state;
  },

  async clear(): Promise<void> {
    if (this.supported) {
      const SecureStore = await import('expo-secure-store');
      await SecureStore.deleteItemAsync(KEY);
    }
  }
};
