import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useEffect, useMemo } from "react";
import { Toaster } from "sonner";
import { runtimeConfig } from "@/lib/runtime";
import { LiveUpdatesProvider } from "@/providers/LiveUpdatesProvider";
import { authService } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";

export function AppProviders({ children }: PropsWithChildren) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: runtimeConfig.useMockApi ? Infinity : 60000,
            gcTime: runtimeConfig.useMockApi ? Infinity : 300000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchInterval: false,
            refetchIntervalInBackground: false,
            retry: runtimeConfig.useMockApi ? 0 : 1
          }
        }
      }),
    []
  );
  const theme = useAuthStore((state) => state.theme);
  const setTheme = useAuthStore((state) => state.setTheme);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const setUser = useAuthStore((state) => state.setUser);
  const signIn = useAuthStore((state) => state.signIn);
  const signOut = useAuthStore((state) => state.signOut);

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (runtimeConfig.useMockApi) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        if (accessToken) {
          const user = await authService.me();
          if (!cancelled) {
            setUser(user);
          }
          return;
        }

        if (refreshToken) {
          const session = await authService.refresh(refreshToken);
          if (!cancelled) {
            signIn(session);
          }
        }
      } catch {
        if (!cancelled) {
          signOut();
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshToken, setUser, signIn, signOut]);

  return (
    <QueryClientProvider client={queryClient}>
      <LiveUpdatesProvider>{children}</LiveUpdatesProvider>
      <Toaster richColors position="top-right" theme={theme} expand />
    </QueryClientProvider>
  );
}
