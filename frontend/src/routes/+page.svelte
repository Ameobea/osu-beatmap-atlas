<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import Map from '../components/Map.svelte';

  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 60 * 1000, refetchIntervalInBackground: false } },
  });
</script>

<QueryClientProvider client={queryClient}>
  <Map />
</QueryClientProvider>
