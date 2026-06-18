import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Keep cached data long enough that the persisted catalog can be restored
      // and used offline before a refetch (7 days).
      gcTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
    },
  },
});
