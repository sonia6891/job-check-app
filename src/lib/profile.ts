import { supabase } from '@/src/lib/supabase';

/** 正式帳號的名字和頭像（profiles.display_name、profiles.avatar_path；頭像檔在私有的 avatars bucket）。 */
const AVATAR_BUCKET = 'avatars';
const AVATAR_SIZE = 256;
export const NAME_MAX = 30;

/** 私有 bucket 的頭像要簽一個暫時網址才能顯示。 */
export async function avatarUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/** Apple 只在第一次登入給名字；Google、LINE 的名字和大頭貼在 user_metadata。 */
export function providerProfile(metadata: Record<string, any> | undefined) {
  const name = String(metadata?.full_name || metadata?.name || '').trim();
  const picture = String(metadata?.avatar_url || metadata?.picture || '').trim();
  return { name: name || null, picture: /^https:\/\//.test(picture) ? picture : null };
}

export async function updateDisplayName(userId: string, name: string) {
  const trimmed = name.trim().slice(0, NAME_MAX);
  if (!trimmed) throw new Error('名字不能空白。');
  const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', userId);
  if (error) throw new Error('名字沒有存成功，請稍後再試。');
  return trimmed;
}

/** 縮成 256×256 的 JPEG 上傳，換掉舊的那張。 */
export async function uploadAvatar(userId: string, uri: string, previousPath: string | null | undefined) {
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const context = ImageManipulator.manipulate(uri).resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const rendered = await context.renderAsync();
  let saved;
  try {
    saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  } finally {
    rendered.release();
    context.release();
  }
  const bytes = await (await fetch(saved.uri)).arrayBuffer();
  // 每次換新檔名，不會讀到快取裡的舊頭像。
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const uploaded = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (uploaded.error) throw new Error('頭像沒有上傳成功，請稍後再試。');
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]).catch(() => {});
    throw new Error('頭像沒有存成功，請稍後再試。');
  }
  if (previousPath && previousPath !== path) await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]).catch(() => {});
  return path;
}
