import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Dove Supabase tiene la sessione: nel portachiavi del sistema (Keychain /
 * Keystore), non in un file in chiaro.
 *
 * SecureStore non garantisce valori oltre ~2 KB e una sessione Supabase li
 * supera, quindi il valore si spezza in blocchi `<chiave>.<n>` e `<chiave>.count`
 * ne ricorda il numero. Su web SecureStore non esiste: si lascia a Supabase il
 * suo `localStorage` di default.
 */
const CHUNK_SIZE = 1800;

const chunkKey = (key: string, index: number) => `${key}.${index}`;
const countKey = (key: string) => `${key}.count`;

async function chunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const count = Number(raw);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

export const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await chunkCount(key);
    if (count === 0) return null;

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
    );
    // Un blocco mancante (scrittura interrotta) vale come nessuna sessione:
    // meglio rifare il login che usare un token troncato.
    return chunks.some((chunk) => chunk === null) ? null : chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = await chunkCount(key);
    const chunks = Array.from({ length: Math.max(1, Math.ceil(value.length / CHUNK_SIZE)) }, (_, index) =>
      value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );

    for (const [index, chunk] of chunks.entries()) await SecureStore.setItemAsync(chunkKey(key, index), chunk);
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    // Una sessione più corta della precedente non lascia blocchi vecchi in giro.
    for (let index = chunks.length; index < previous; index += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, index));
    }
  },

  async removeItem(key: string): Promise<void> {
    const count = await chunkCount(key);
    await SecureStore.deleteItemAsync(countKey(key));
    for (let index = 0; index < count; index += 1) await SecureStore.deleteItemAsync(chunkKey(key, index));
  },
};

/** `undefined` su web: Supabase userà `localStorage`. */
export const sessionStorage = Platform.OS === 'web' ? undefined : chunkedSecureStorage;
