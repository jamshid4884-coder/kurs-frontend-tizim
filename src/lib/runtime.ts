const rawUseMockApi = import.meta.env.VITE_USE_MOCK_API;
const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const productionApiBaseUrl = "https://kurs-boshqaruv-api.onrender.com/api";

function isPlaceholderApiUrl(value: string) {
  return /backend-url|your-backend|sizning-backend|example\.com/i.test(value);
}

function normalizeApiBaseUrl(value: string) {
  const trimmed = value.replace(/\/+$/, "");

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);

    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/api";
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

const resolvedApiBaseUrl = rawApiBaseUrl && !isPlaceholderApiUrl(rawApiBaseUrl)
  ? normalizeApiBaseUrl(rawApiBaseUrl)
  : import.meta.env.PROD
    ? productionApiBaseUrl
    : "http://localhost:8000/api";

export const runtimeConfig = {
  appName: import.meta.env.VITE_APP_NAME || "Kurs Boshqaruv",
  apiBaseUrl: resolvedApiBaseUrl,
  useMockApi: rawUseMockApi ? rawUseMockApi !== "false" : !resolvedApiBaseUrl,
  demoPassword: String(import.meta.env.VITE_DEMO_PASSWORD || "").trim()
};
