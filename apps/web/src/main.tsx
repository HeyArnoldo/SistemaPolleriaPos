import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { queryPersister, shouldPersistQuery } from '@/lib/query-persister';
import { router } from '@/router';
import { Toaster } from '@/components/ui/sonner';
import { OfflineAuthProvider } from '@/contexts/offline-auth-context';
import './index.css';

const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: SEVEN_DAYS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && shouldPersistQuery(query.queryKey),
        },
      }}
    >
      <OfflineAuthProvider>
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
        <Toaster richColors />
      </OfflineAuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
