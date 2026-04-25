import { runtimeConfig } from "@/lib/runtime";
import { useAuthStore } from "@/store/auth-store";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 90000;

function toFriendlyMessage(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("timeout") ||
    normalized.includes("aborted") ||
    normalized.includes("the user aborted a request")
  ) {
    return "Server vaqtida javob bermadi. Render backend uyg'onayotgan bo'lishi mumkin, bir ozdan keyin qayta urinib ko'ring.";
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed")
  ) {
    return `Serverga ulanib bo'lmadi. Backendni yoqing yoki ${runtimeConfig.apiBaseUrl} manzilini tekshiring.`;
  }

  if (normalized.includes("invalid credentials")) {
    return "Telefon raqami, email yoki parol noto'g'ri.";
  }

  if (normalized.includes("not active")) {
    return "Hisob hali faollashtirilmagan.";
  }

  if (normalized.includes("already exists")) {
    return "Bu telefon yoki email bilan foydalanuvchi allaqachon mavjud.";
  }

  if (normalized.includes("refresh token")) {
    return "Sessiya muddati tugagan. Qaytadan kiring.";
  }

  if (normalized.includes("access token")) {
    return "Sessiya yaroqsiz bo'lib qoldi. Qaytadan kiring.";
  }

  if (normalized.includes("admin and parent accounts require a secure internal flow")) {
    return "Admin va ota-ona akkauntlari alohida xavfsiz oqim orqali yaratiladi.";
  }

  return message;
}

function normalizeErrorMessage(payload: unknown) {
  if (typeof payload === "string") {
    return payload;
  }

  if (Array.isArray((payload as { detail?: unknown[] } | null)?.detail)) {
    return (payload as { detail: unknown[] }).detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (typeof item === "object" && item && "msg" in item && typeof item.msg === "string") {
          return item.msg;
        }

        return "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (Array.isArray((payload as { message?: unknown[] } | null)?.message)) {
    return (payload as { message: unknown[] }).message
      .map((item) => String(item))
      .join(", ");
  }

  if (typeof (payload as { detail?: unknown } | null)?.detail === "string") {
    return (payload as { detail: string }).detail;
  }

  if (typeof (payload as { message?: unknown } | null)?.message === "string") {
    return (payload as { message: string }).message;
  }

  return "So'rov bajarilmadi.";
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Server bilan ulanishda xatolik yuz berdi.";
  return new ApiError(toFriendlyMessage(message), 0);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const externalSignal = init.signal;

  const abortFromExternalSignal = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(toFriendlyMessage("timeout"), 0);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const rawMessage = normalizeErrorMessage(payload);

    throw new ApiError(toFriendlyMessage(rawMessage), response.status);
  }

  return payload as T;
}

async function refreshSession() {
  const { refreshToken, signIn, signOut } = useAuthStore.getState();

  if (!refreshToken) {
    signOut();
    throw new ApiError("Sessiya muddati tugagan. Qaytadan kiring.", 401);
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(`${runtimeConfig.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken })
    });
  } catch (error) {
    throw toApiError(error);
  }

  const data = await parseResponse<{
    user: Record<string, unknown>;
    tokens: { accessToken: string; refreshToken: string };
  }>(response);

  signIn({
    user: {
      id: String(data.user.id),
      profileId: data.user.profileId ? String(data.user.profileId) : undefined,
      fullName: String(data.user.fullName),
      role: String(data.user.role) as import("@/types/domain").Role,
      phone: String(data.user.phone),
      email: data.user.email ? String(data.user.email) : undefined,
      avatar: data.user.avatar ? String(data.user.avatar) : undefined
    },
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken
  });

  return data.tokens.accessToken;
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    auth = true,
    retryOnUnauthorized = true,
    headers,
    body,
    ...rest
  } = options;

  const { accessToken, signOut } = useAuthStore.getState();
  const requestHeaders = new Headers(headers);

  if (body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth && accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(`${runtimeConfig.apiBaseUrl}${path}`, {
      ...rest,
      headers: requestHeaders,
      body
    });
  } catch (error) {
    throw toApiError(error);
  }

  if (response.status === 401 && auth && retryOnUnauthorized && !runtimeConfig.useMockApi) {
    try {
      const nextAccessToken = await refreshSession();
      return apiRequest<T>(path, {
        ...options,
        retryOnUnauthorized: false,
        headers: {
          ...(headers || {}),
          Authorization: `Bearer ${nextAccessToken}`
        }
      });
    } catch (error) {
      const apiError = toApiError(error);

      if (apiError.status !== 401) {
        throw apiError;
      }

      signOut();
      throw new ApiError("Sessiya muddati tugagan. Qaytadan kiring.", 401);
    }
  }

  return parseResponse<T>(response);
}

export { ApiError };
