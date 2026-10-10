import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';

import { useAuth } from '@/auth/AuthProvider';

import { type ApiClient, createApiClient } from './client';
import { uploadDocument } from './documents';

interface ApiContextValue {
  client: ApiClient;
  upload: (tripId: string, file: File, title: string) => Promise<string>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

/** Il client dell'API con il token della sessione; un 401 chiude la sessione e svuota la cache. */
export function ApiProvider({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  const { getAccessToken, signOut } = useAuth();
  const queryClient = useQueryClient();

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl,
        getAccessToken,
        onUnauthorized: () => {
          queryClient.clear();
          void signOut();
        },
      }),
    [baseUrl, getAccessToken, queryClient, signOut],
  );
  const upload = useCallback(
    (tripId: string, file: File, title: string) =>
      uploadDocument({ baseUrl, getAccessToken }, tripId, file, title),
    [baseUrl, getAccessToken],
  );
  const value = useMemo(() => ({ client, upload }), [client, upload]);

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

function useApiContext(): ApiContextValue {
  const value = useContext(ApiContext);
  if (!value) throw new Error('useApi va usato dentro <ApiProvider />');
  return value;
}

export const useApi = () => useApiContext().client;

/** Carica un file fra i documenti di un viaggio; restituisce l'id da collegare allo slot. */
export const useUploader = () => useApiContext().upload;
