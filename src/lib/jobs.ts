import { supabase } from './supabase';

const UPLOAD_BUCKET = 'job-uploads';

/**
 * Delete a job owned by the current account.
 * The database deletion cascades to analyses and saved/progress rows.
 * Free analysis usage is not refunded.
 */
export async function deleteJob(jobPostId: string) {
  if (!jobPostId) throw new Error('缺少職缺識別碼。');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('登入狀態已失效，無法刪除職缺。');

  const { data: job, error: ownerError } = await supabase.from('job_posts')
    .select('id').eq('id', jobPostId).eq('user_id', user.id).maybeSingle();
  if (ownerError) throw ownerError;
  if (!job) throw new Error('找不到這份職缺，或目前帳號無權刪除。');

  const { data: files, error: filesError } = await supabase
    .from('job_files')
    .select('storage_path,storage_deleted_at')
    .eq('job_post_id', jobPostId)
    .eq('user_id', user.id);
  if (filesError) throw filesError;

  const paths = [...new Set((files ?? [])
    .filter(file => file.storage_path && !file.storage_deleted_at)
    .map(file => String(file.storage_path)))];
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(UPLOAD_BUCKET).remove(paths);
    if (storageError) throw storageError;
  }

  const { data: deleted, error: deleteError } = await supabase.from('job_posts')
    .delete().eq('id', jobPostId).eq('user_id', user.id)
    .select('id').maybeSingle();
  if (deleteError) throw deleteError;
  if (!deleted) throw new Error('職缺沒有成功刪除，請重新整理後再試。');
}
