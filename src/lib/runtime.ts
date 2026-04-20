const rawUseMockApi = import.meta.env.VITE_USE_MOCK_API;
const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();

export const runtimeConfig = {
  appName: import.meta.env.VITE_APP_NAME || "Kurs Boshqaruv",
  apiBaseUrl: rawApiBaseUrl || "http://localhost:4000/api",
  useMockApi: rawUseMockApi ? rawUseMockApi !== "false" : !rawApiBaseUrl,
  demoPassword: String(import.meta.env.VITE_DEMO_PASSWORD || "").trim()
};
