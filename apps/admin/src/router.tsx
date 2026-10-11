import { createBrowserRouter } from 'react-router';

import { useAdminSession } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';

/** La cornice con lo staff già riconosciuto da `AdminGate`. */
function Shell() {
  const { signOut } = useAuth();
  const { data: admin } = useAdminSession();
  if (!admin) return null;
  return <AppShell admin={admin} onSignOut={() => void signOut()} />;
}

/**
 * Gli indirizzi sono in italiano, come il resto: /viaggi/:id, /persone/:id.
 * Ogni pagina si scarica quando serve: il primo caricamento resta leggero.
 */
export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/pages/OverviewPage')).OverviewPage }) },
      { path: 'viaggi', lazy: async () => ({ Component: (await import('@/pages/TripsPage')).TripsPage }) },
      {
        path: 'viaggi/:tripId',
        lazy: async () => ({ Component: (await import('@/pages/TripDetailPage')).TripDetailPage }),
      },
      { path: 'persone', lazy: async () => ({ Component: (await import('@/pages/PeoplePage')).PeoplePage }) },
      {
        path: 'persone/:userId',
        lazy: async () => ({ Component: (await import('@/pages/PersonPage')).PersonPage }),
      },
      { path: 'uso', lazy: async () => ({ Component: (await import('@/pages/UsagePage')).UsagePage }) },
      {
        path: 'prestazioni',
        lazy: async () => ({ Component: (await import('@/pages/PerformancePage')).PerformancePage }),
      },
      { path: '*', lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }) },
    ],
  },
]);
