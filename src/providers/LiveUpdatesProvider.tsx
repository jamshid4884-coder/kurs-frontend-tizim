import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { runtimeConfig } from "@/lib/runtime";
import { useAuthStore } from "@/store/auth-store";

type LiveStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

interface LiveEventPayload {
  type?: string;
  version?: number;
  scopes?: string[];
  sentAt?: string;
}

interface LiveUpdatesContextValue {
  status: LiveStatus;
  lastSyncAt: string | null;
}

const LiveUpdatesContext = createContext<LiveUpdatesContextValue>({
  status: "idle",
  lastSyncAt: null
});

const knownScopes = [
  "dashboard",
  "students",
  "teachers",
  "groups",
  "courses",
  "attendance",
  "payments",
  "notifications",
  "student-detail",
  "teacher-student"
] as const;

function buildLiveStreamUrl(token: string) {
  const url = new URL(`${runtimeConfig.apiBaseUrl}/live/stream`);
  url.searchParams.set("token", token);
  return url.toString();
}

function invalidateByScopes(queryClient: QueryClient, scopes?: string[]) {
  const values = scopes?.length ? scopes : [...knownScopes];

  values.forEach((scope) => {
    queryClient.invalidateQueries({ queryKey: [scope] });
  });
}

export function LiveUpdatesProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const pendingScopesRef = useRef<Set<string>>(new Set());
  const invalidateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearInvalidationTimer = () => {
      if (invalidateTimerRef.current) {
        window.clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = null;
      }
    };

    const flushInvalidations = () => {
      const scopes = Array.from(pendingScopesRef.current);
      pendingScopesRef.current.clear();
      invalidateTimerRef.current = null;

      if (scopes.length) {
        invalidateByScopes(queryClient, scopes);
      }
    };

    const scheduleInvalidation = (scopes?: string[]) => {
      const values = scopes?.length ? scopes : [...knownScopes];

      values.forEach((scope) => {
        pendingScopesRef.current.add(scope);
      });

      if (!invalidateTimerRef.current) {
        invalidateTimerRef.current = window.setTimeout(flushInvalidations, 450);
      }
    };

    if (runtimeConfig.useMockApi || !accessToken) {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }

      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }

      clearInvalidationTimer();
      pendingScopesRef.current.clear();
      setStatus("idle");
      setLastSyncAt(null);
      return;
    }

    let disposed = false;

    const clearReconnect = () => {
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      setStatus((current) => (current === "connected" ? "reconnecting" : "connecting"));
      clearReconnect();

      const source = new EventSource(buildLiveStreamUrl(accessToken));
      sourceRef.current = source;

      source.onopen = () => {
        if (disposed) {
          return;
        }

        setStatus("connected");
        setLastSyncAt(new Date().toISOString());
      };

      source.onmessage = (event) => {
        if (disposed) {
          return;
        }

        const payload = JSON.parse(event.data) as LiveEventPayload;
        setStatus("connected");
        setLastSyncAt(payload.sentAt ?? new Date().toISOString());
        scheduleInvalidation(payload.scopes);
      };

      source.onerror = () => {
        source.close();

        if (sourceRef.current === source) {
          sourceRef.current = null;
        }

        if (disposed) {
          return;
        }

        setStatus("reconnecting");
        clearReconnect();
        reconnectRef.current = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnect();

      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }

      clearInvalidationTimer();
      pendingScopesRef.current.clear();
    };
  }, [accessToken, queryClient]);

  const value = useMemo(
    () => ({
      status,
      lastSyncAt
    }),
    [lastSyncAt, status]
  );

  return <LiveUpdatesContext.Provider value={value}>{children}</LiveUpdatesContext.Provider>;
}

export function useLiveUpdates() {
  return useContext(LiveUpdatesContext);
}
