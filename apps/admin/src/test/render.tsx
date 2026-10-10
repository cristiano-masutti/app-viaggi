import type { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ApiProvider } from '@/api/ApiProvider';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';

/** Gli stessi provider di `main.tsx`, con Supabase finto e nessun tentativo ripetuto. */
export function renderWithProviders(ui: ReactNode, supabase: SupabaseClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider client={supabase}>
        <ApiProvider baseUrl="https://api.test">
          <ToastProvider>{ui}</ToastProvider>
        </ApiProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
