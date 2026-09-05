"use client";

import { isServer, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/lib/auth/session";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Half a minute is long enough that tab-switching doesn't refetch every
        // list, short enough that a punch or an approval shows up on the next
        // screen without a manual invalidate.
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}

// One client per server render, one memoised client in the browser. Sharing a
// module-level client across server renders would leak one user's data into
// another's HTML (docs: 01-app/02-guides/client-side-data-fetching/tanstack-query.md).
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SessionProvider>{children}</SessionProvider>
        <Toaster position="top-right" />
      </ThemeProvider>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
