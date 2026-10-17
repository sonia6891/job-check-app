import { supabase } from './supabase';
import { normalizeFunctionError } from './functionErrors';
import type { AnalysisRunResult, EmployerCandidate, JobParseResult, JobReport } from '@/src/types';

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw await normalizeFunctionError(error);
  if (data?.error) {
    throw await normalizeFunctionError({ message: String(data.error), payload: data });
  }
  return data as T;
}

export const api = {
  parseTextJob: (text: string, jobPostId?: string | null, fileMeta?: { fileId?: string; engine?: string; language?: string; confidence?: number }, sourceUrl?: string | null) =>
    invoke<JobParseResult>('parse-job', {
      text,
      source_type: jobPostId ? 'image' : sourceUrl ? 'url' : 'text',
      source_url: sourceUrl ?? null,
      job_post_id: jobPostId ?? null,
      file_id: fileMeta?.fileId ?? null,
      ocr_engine: fileMeta?.engine ?? null,
      ocr_language: fileMeta?.language ?? null,
      ocr_confidence: fileMeta?.confidence ?? null,
      save: true
    }),

  runAnalysis: (jobPostId: string) =>
    invoke<AnalysisRunResult>('run-job-analysis', { job_post_id: jobPostId }),

  buildReport: (jobPostId: string) =>
    invoke<JobReport>('build-job-report', { job_post_id: jobPostId }),

  listEmployerCandidates: (jobPostId: string) =>
    invoke<{
      status: string;
      candidates?: EmployerCandidate[];
      reason?: string | null;
      external_lookup?: { ok: boolean; errors: string[] };
    }>('resolve-company', { job_post_id: jobPostId, list_candidates: true }),

  selectEmployer: (jobPostId: string, candidate: Pick<EmployerCandidate, 'tax_id' | 'entity_type'>) =>
    invoke<{ status: string; match_method?: string; company?: EmployerCandidate | null }>('resolve-company', {
      job_post_id: jobPostId,
      selected_tax_id: candidate.tax_id,
      selected_entity_type: candidate.entity_type
    }),

  compareJobs: (jobPostIds: string[]) =>
    invoke<{ jobs: unknown[]; note: string }>('compare-jobs', { job_post_ids: jobPostIds }),

  importJobUrl: (url: string) =>
    invoke<{
      status: 'parsed' | 'manual_text_required';
      source_url: string;
      job_id?: string | null;
      parsed?: unknown;
      reason?: string;
      extracted_preview?: string;
    }>('import-job-url', { url }),

  deleteAccount: () =>
    invoke<{ status: 'deleted' }>('delete-account', { confirm: 'DELETE' }),

  appHealth: () =>
    invoke<any>('app-health', {}),

  createAccountTransfer: () =>
    invoke<{ status: string; transfer_token: string | null; expires_at?: string }>('create-account-transfer', {}),

  redeemAccountTransfer: (transferToken: string) =>
    invoke<{ status: string; jobs_moved?: number; plan_moved?: boolean; files_moved?: number; files_missing_or_expired?: number }>('redeem-account-transfer', { transfer_token: transferToken }),

  prepareUpload: (mimeType: string, filename?: string | null, keepOriginal = false) =>
    invoke<{ job_post_id: string; file_id: string; bucket: string; storage_path: string; next_action: string }>('prepare-job-upload', {
      mime_type: mimeType,
      original_filename: filename ?? null,
      keep_original: keepOriginal
    })
};
