import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiTimingMiddleware } from '@/telemetry/apiTiming';
import type { PanelTelemetry } from '@/telemetry/PanelTelemetry';

import { type ApiClient, createApiClient } from './client';
import { uploadDocument } from './documents';

interface ApiContextValue {
  client: ApiClient;
  upload: (tripId: string, file: File, title: string) => Promise<string>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

/** Il client dell'API con il token della sessione; un 401 chiude la sessione e svuota la cache. */
export function ApiProvider({
  baseUrl,
  telemetry,
  children,
}: {
  baseUrl: string;
  /** Le misure del pannello: i tempi delle chiamate e l'invio dei lotti. */
  telemetry?: PanelTelemetry;
  children: ReactNode;
}) {
  const { getAccessToken, signOut } = useAuth();
  const queryClient = useQueryClient();

  const onUnauthorized = useCallback(() => {
    queryClient.clear();
    void signOut();
  }, [queryClient, signOut]);

  const client = useMemo(() => {
    const api = createApiClient({ baseUrl, getAccessToken, onUnauthorized });
    if (telemetry) api.use(apiTimingMiddleware(telemetry));
    return api;
  }, [baseUrl, getAccessToken, onUnauthorized, telemetry]);

  useEffect(() => {
    if (!telemetry) return;
    telemetry.connect(async (batch) => {
      // Senza sessione non si manda: un 401 qui chiuderebbe la pagina di login.
      if (!(await getAccessToken())) return 'failed';
      const { response } = await client.POST('/api/telemetry', { body: batch, keepalive: true });
      if (response.ok) return 'ok';
      return response.status >= 400 && response.status < 500 && ![401, 408, 429].includes(response.status)
        ? 'rejected'
        : 'failed';
    });
    return () => telemetry.connect(null);
  }, [client, getAccessToken, telemetry]);
  // Anche l'upload multipart, fuori dal client tipizzato, chiude la sessione su un 401.
  const upload = useCallback(
    (tripId: string, file: File, title: string) =>
      uploadDocument({ baseUrl, getAccessToken, onUnauthorized }, tripId, file, title),
    [baseUrl, getAccessToken, onUnauthorized],
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
