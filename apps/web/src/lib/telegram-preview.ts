import type { TelegramBotSettings } from "@/types/domain";

export const telegramImagePresets = [
  {
    id: "builtin://parent-welcome-premium",
    label: "Premium welcome",
    description: "Yangi ota-ona paneli uchun premium banner"
  },
  {
    id: "builtin://parent-alert-premium",
    label: "Premium ogohlantirish",
    description: "Davomat, vazifa va to'lov uchun premium banner"
  }
] as const;

export const telegramKeyboardButtons = [
  ["📚 Guruh va kurs", "🗓 Dars jadvali"],
  ["📝 Vazifa va baho", "💳 To'lov"],
  ["📊 Davomat", "✨ Yangilash"]
] as const;

const previewContext = {
  parent: "Dilafruz Xasanova",
  student: "Muhammadali Xasanov",
  group: "IELTS-710",
  course: "IELTS intensiv",
  schedule: "Se, Pa, Sha | 18:30",
  teacher: "Teacher Demo",
  room: "C3 xona",
  template: "🔴 Darsga kelmadi",
  monthly_fee: "1 100 000 so'm"
};

export function resolveTelegramMediaUrl(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("builtin://")) {
    return `/telegram-assets/${normalized.replace("builtin://", "")}.png`;
  }

  return normalized;
}

export function renderTelegramTemplate(
  template?: string | null,
  overrides: Partial<typeof previewContext> = {}
) {
  const source = String(template || "").trim();
  if (!source) {
    return "Shablon matni shu yerda ko'rinadi.";
  }

  const context = { ...previewContext, ...overrides };
  return source.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    if (key in context) {
      return String(context[key as keyof typeof context]);
    }

    return `{${key}}`;
  });
}

export function selectTelegramTemplate(
  settings: TelegramBotSettings | undefined,
  notificationTemplate: string
) {
  if (!settings) {
    return "";
  }

  if (notificationTemplate.toLowerCase().includes("to'lov")) {
    return settings.paymentTemplate;
  }

  if (notificationTemplate.toLowerCase().includes("uy vazifasi")) {
    return settings.homeworkTemplate;
  }

  return settings.attendanceTemplate;
}

export const telegramPlaceholderHints = [
  "{parent}",
  "{student}",
  "{group}",
  "{course}",
  "{schedule}",
  "{teacher}",
  "{room}",
  "{template}",
  "{monthly_fee}"
] as const;
