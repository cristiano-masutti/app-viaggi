import './styles.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AdminGate } from '@/AdminGate';
import { ApiProvider } from '@/api/ApiProvider';
import { ApiError } from '@/api/client';
import { AuthProvider } from '@/auth/AuthProvider';
import { createSupabase } from '@/auth/supabase';
import { ToastProvider } from '@/components/ui/Toast';
import { config } from '@/config';
import { MissingConfigPage } from '@/pages/MissingConfigPage';
import { PanelTelemetry, startPanelTelemetry } from '@/telemetry';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un 4xx non migliora riprovando; la rete che va e viene sì.
      retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 2,
    },
  },
});

const root = createRoot(document.getElementById('root')!);

if (!config) {
  root.render(<MissingConfigPage />);
} else {
  const supabase = createSupabase(config);
  const telemetry = new PanelTelemetry();
  startPanelTelemetry(telemetry);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={supabase}>
          <ApiProvider baseUrl={config.apiUrl} telemetry={telemetry}>
            <ToastProvider>
              <AdminGate />
            </ToastProvider>
          </ApiProvider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
