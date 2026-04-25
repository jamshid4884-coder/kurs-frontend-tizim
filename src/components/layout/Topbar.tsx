import { useState } from "react";
import { Bell, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { runtimeConfig } from "@/lib/runtime";
import { useLiveUpdates } from "@/providers/LiveUpdatesProvider";
import { authService } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";

const roleLabels = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  TEACHER: "O'qituvchi",
  STUDENT: "O'quvchi"
} as const;

function resolveAvatarUrl(avatar?: string) {
  if (!avatar) {
    return null;
  }

  if (avatar.startsWith("http://") || avatar.startsWith("https://") || avatar.startsWith("data:")) {
    return avatar;
  }

  return new URL(avatar, new URL(runtimeConfig.apiBaseUrl).origin).toString();
}

export function Topbar() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const user = useAuthStore((state) => state.user)!;
  const theme = useAuthStore((state) => state.theme);
  const setTheme = useAuthStore((state) => state.setTheme);
  const toggleCommandPalette = useAuthStore((state) => state.toggleCommandPalette);
  const switchRolePreview = useAuthStore((state) => state.switchRolePreview);
  const toggleSidebar = useAuthStore((state) => state.toggleSidebar);
  const signOut = useAuthStore((state) => state.signOut);
  const { status: liveStatus, lastSyncAt } = useLiveUpdates();
  const avatarUrl = resolveAvatarUrl(user.avatar);

  const liveMeta =
    liveStatus === "connected"
      ? { label: "Jonli", tone: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" }
      : liveStatus === "reconnecting" || liveStatus === "connecting"
        ? { label: "Ulanmoqda", tone: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" }
        : { label: "Offline", tone: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" };

  const handleSignOut = async () => {
    try {
      await authService.logout();
    } catch {
      toast.error("Sessiyani yopishda xatolik bo'ldi.");
    } finally {
      signOut();
    }
  };

  return (
    <>
      <div className="topbar-shell sticky top-4 z-30">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => toggleSidebar(true)}
              className="utility-chip h-14 w-14 shrink-0 justify-center px-0 lg:hidden"
              aria-label="Menyuni ochish"
            >
              <Menu size={20} />
            </button>
            <button
              type="button"
              onClick={() => toggleCommandPalette(true)}
              className="flex h-14 min-w-0 w-full max-w-[440px] items-center gap-3 rounded-[20px] border border-border/80 bg-white/95 px-4 text-left shadow-sm transition hover:border-primary/20 hover:bg-slate-50 dark:bg-slate-950/95 sm:w-[360px] xl:w-[420px]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                <Search size={17} />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-600 dark:text-slate-300">Qidiruv, buyruq yoki sahifa nomi</span>
              <span className="shrink-0 rounded-xl border border-border/80 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                Ctrl+K
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:gap-3 2xl:justify-end">
            {runtimeConfig.useMockApi ? (
              <div className="min-w-[220px] max-w-[260px] flex-1 sm:flex-none">
                <select
                  value={user.role}
                  onChange={(event) => switchRolePreview(event.target.value as import("@/types/domain").Role)}
                  className="h-14 w-full rounded-[20px] border border-border/80 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="SUPER_ADMIN">Super admin ko'rinishi</option>
                  <option value="ADMIN">Admin ko'rinishi</option>
                  <option value="TEACHER">O'qituvchi ko'rinishi</option>
                  <option value="STUDENT">O'quvchi ko'rinishi</option>
                </select>
              </div>
            ) : null}
            {!runtimeConfig.useMockApi ? (
              <div className="hidden items-center gap-3 rounded-[20px] border border-border/80 bg-white px-4 py-3 text-sm shadow-sm dark:bg-slate-950 lg:flex">
                <span className={`h-2.5 w-2.5 rounded-full ${liveMeta.tone}`} />
                <div className="min-w-0">
                  <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${liveMeta.text}`}>{liveMeta.label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {lastSyncAt ? new Intl.DateTimeFormat("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lastSyncAt)) : "Signal kutilmoqda"}
                  </div>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="utility-chip h-14 w-14 shrink-0 justify-center px-0"
              aria-label="Bildirishnomalar"
            >
              <Bell size={17} />
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="utility-chip h-14 w-14 shrink-0 justify-center px-0"
              aria-label="Temani o'zgartirish"
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <div className="flex min-w-[236px] flex-1 items-center gap-3 rounded-[22px] border border-border/80 bg-white px-3.5 py-2.5 shadow-sm dark:bg-slate-950 sm:flex-none">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.fullName} className="h-12 w-12 shrink-0 rounded-[18px] object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-primary text-sm font-bold text-white">
                  {user.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user.fullName}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{roleLabels[user.role]}</div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-slate-500 transition hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-900"
                aria-label="Chiqish"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Tizimdan chiqilsinmi?"
        description="Joriy sessiya yopiladi. Qayta kirish uchun login sahifasiga o'tasiz."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void handleSignOut();
        }}
      />
    </>
  );
}
