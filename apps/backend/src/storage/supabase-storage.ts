import { createClient } from '@supabase/supabase-js';

import { type ObjectStorage, StorageError } from './storage.js';

interface SupabaseStorageOptions {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

export function createSupabaseStorage({
  url,
  serviceRoleKey,
  bucket,
}: SupabaseStorageOptions): ObjectStorage {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const files = () => client.storage.from(bucket);

  return {
    async upload(path, body, contentType) {
      const { error } = await files().upload(path, body, { contentType, upsert: false });
      if (error) throw new StorageError('upload', error.message, { cause: error });
    },

    async createSignedUrl(path, expiresInSeconds) {
      const { data, error } = await files().createSignedUrl(path, expiresInSeconds);
      if (error) throw new StorageError('createSignedUrl', error.message, { cause: error });
      return data.signedUrl;
    },

    async remove(paths) {
      const { error } = await files().remove(paths);
      if (error) throw new StorageError('remove', error.message, { cause: error });
    },
  };
}
