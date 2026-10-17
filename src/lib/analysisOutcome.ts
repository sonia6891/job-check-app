import type { AnalysisRunResult } from '@/src/types';

export type AnalysisOutcome =
  | { ready: true; status: 'completed' | 'partial' }
  | { ready: false; message: string };

/**
 * No response body means the request never got an answer (offline, dropped, client timeout).
 * The server may still be running the analysis, so the app should check the run before failing.
 */
export function isConnectionFailure(error: unknown): boolean {
  const e = error as { payload?: unknown } | null | undefined;
  return !e || !e.payload;
}

export type RecoveredRunState = 'completed' | 'partial' | 'failed' | 'pending';

/**
 * Only a run newer than the one that existed before this attempt counts,
 * compared by id so device clock skew cannot pick up an old result.
 */
export function recoveredRunState(
  run: { id?: string | null; status?: string | null } | null | undefined,
  baselineRunId: string | null
): RecoveredRunState {
  if (!run?.id || run.id === baselineRunId) return 'pending';
  if (run.status === 'completed' || run.status === 'partial' || run.status === 'failed') return run.status;
  return 'pending';
}

/** A partial analysis is readable only when build-job-report actually succeeded. */
export function classifyAnalysisOutcome(result: AnalysisRunResult, expectedJobId: string): AnalysisOutcome {
  if (result.status !== 'completed' && result.status !== 'partial') {
    return { ready: false, message: '分析尚未完成，請稍後重試。' };
  }
  if (result.report_error || !result.report) {
    return { ready: false, message: '職缺已保存，但報告尚未產生成功。請重新體檢。' };
  }
  if (result.report.job?.id !== expectedJobId || !result.report.company || !result.report.salary || !result.report.official_records) {
    return { ready: false, message: '收到的體檢報告資料不完整，請重新體檢。' };
  }
  return { ready: true, status: result.status };
}
