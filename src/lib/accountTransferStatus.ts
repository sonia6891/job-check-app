export type TransferNotice = {
  status: 'none' | 'pending' | 'completed' | 'partial' | 'expired';
  message: string;
};
export type RedeemResult = {
  status: string;
  jobs_moved?: number;
  files_missing_or_expired?: number;
  files_moved?: number;
};

/** Server may migrate DB rows but not all images; don't claim unconditional success. */
export function describeTransferResult(data: RedeemResult): TransferNotice {
  if (data.status !== 'completed') {
    return { status: 'pending', message: '帳號已登入，但訪客資料尚未確認轉移完成。請重試。' };
  }
  const skipped = Number(data.files_missing_or_expired || 0);
  if (skipped > 0) {
    return {
      status: 'partial',
      message: `職缺紀錄已轉移，但有 ${skipped} 張原始圖片未成功搬移或已過期。請檢查報告內容。`
    };
  }
  return {
    status: 'completed',
    message: '訪客職缺與收藏的資料轉移已由伺服器確認。'
  };
}

export function transferExpired(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  return Number.isFinite(time) && nowMs >= time;
}
