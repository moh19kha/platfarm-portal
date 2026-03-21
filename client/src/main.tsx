import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";
import { toast } from "sonner";

/** Returns true if the error is a transient sandbox wake-up or network blip */
function isTransientError(msg: string): boolean {
  return (
    msg.includes('socket hang up') ||
    msg.includes('ECONNRESET') ||
    msg.includes("Unexpected token '<'") ||
    msg.includes('is not valid JSON') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError')
  );
}

let _wakeUpToastShown = false;
function showWakeUpToast() {
  if (_wakeUpToastShown) return;
  _wakeUpToastShown = true;
  toast.loading('Server is waking up, retrying…', { id: 'server-wakeup', duration: 10000 });
  setTimeout(() => { _wakeUpToastShown = false; toast.dismiss('server-wakeup'); }, 12000);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const msg = error instanceof TRPCClientError ? error.message : String(error);
        // Always retry transient errors up to 4 times
        if (isTransientError(msg)) return failureCount < 4;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 15000),
      staleTime: 5 * 60 * 1000, // 5 minutes — avoid re-fetching on every navigation
      refetchOnWindowFocus: false, // Don't refetch when tab regains focus
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = '/login';
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    // Only log non-transient errors (sandbox wake-up / network blips are retried automatically)
    const msg = error instanceof TRPCClientError ? error.message : '';
    if (isTransientError(msg)) {
      showWakeUpToast();
    } else {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
