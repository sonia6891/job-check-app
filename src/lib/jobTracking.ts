import { supabase } from './supabase';

export type TrackingResult = { created: boolean };

/** Ensure the signed-in user has a progress row, without changing a bookmark,
 * existing application status or notes. Never silently add a favorite.
 */
export async function ensureTrackedJob(jobId: string): Promise<TrackingResult> {
  if (!jobId) throw new Error('缺少職缺識別碼。');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('登入狀態已失效，請重新登入。');
  const userId = user.id;
  const { data: job, error: jobError } = await supabase.from('job_posts')
    .select('id').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw new Error('這份職缺不屬於目前帳號，無法加入追蹤。');

  const findExisting = () => supabase.from('saved_jobs')
    .select('id').eq('job_post_id', jobId).eq('user_id', userId).maybeSingle();
  const { data: existing, error: lookupError } = await findExisting();
  if (lookupError) throw lookupError;
  if (existing) return { created: false };

  const { data: inserted, error: insertError } = await supabase.from('saved_jobs')
    .insert({ user_id: userId, job_post_id: jobId, favorite: false, status: 'saved' })
    .select('id').maybeSingle();
  if (insertError) {
    // A concurrent bookmark/track action may have inserted the same row.
    // Confirm that a row now exists before treating the operation as successful.
    const { data: concurrent, error: checkError } = await findExisting();
    if (!checkError && concurrent) return { created: false };
    throw insertError;
  }
  if (!inserted) throw new Error('追蹤紀錄沒有建立成功，請稍後再試。');
  return { created: true };
}
