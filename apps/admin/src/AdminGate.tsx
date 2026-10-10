import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';

import { ApiError } from '@/api/client';
import { useAdminSession } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { Splash } from '@/components/layout/Splash';
import { QueryError } from '@/components/ui/QueryError';
import { LoginPage } from '@/pages/LoginPage';
import { NotStaffPage } from '@/pages/NotStaffPage';
import { router } from '@/router';

/**
 * Chi può vedere il pannello, in tre passi: c'è una sessione? Il backend la
 * riconosce come staff? Solo allora si monta il router. Il ruolo lo decide il
 * backend a ogni richiesta: qui si sceglie solo cosa mostrare.
 */
export function AdminGate() {
  const { state } = useAuth();
  const queryClient = useQueryClient();

  // Uscendo non resta niente in memoria: il prossimo che entra parte da zero.
  useEffect(() => {
    if (state.status === 'signedOut') queryClient.clear();
  }, [queryClient, state.status]);

  if (state.status === 'loading') return <Splash />;
  if (state.status === 'signedOut') return <LoginPage />;
  return <StaffGate email={state.email} />;
}

function StaffGate({ email }: { email: string | null }) {
  const { signOut } = useAuth();
  const session = useAdminSession();

  if (session.isPending) return <Splash />;
  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 403) {
      return <NotStaffPage email={email} onSignOut={() => void signOut()} />;
    }
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-5">
        <div className="w-full max-w-md">
          <QueryError error={session.error} onRetry={() => void session.refetch()} />
        </div>
      </div>
    );
  }
  return <RouterProvider router={router} />;
}
