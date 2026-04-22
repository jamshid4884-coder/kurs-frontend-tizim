import { create } from "zustand";
import { persist } from "zustand/middleware";
import { runtimeConfig } from "@/lib/runtime";
import type { Role, SessionUser } from "@/types/domain";

type Theme = "light" | "dark";

interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  theme: Theme;
  commandPaletteOpen: boolean;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  signIn: (payload: { user: SessionUser; accessToken: string; refreshToken?: string | null }) => void;
  setUser: (user: SessionUser | null) => void;
  signOut: () => void;
  setTheme: (theme: Theme) => void;
  toggleCommandPalette: (open?: boolean) => void;
  toggleSidebar: (open?: boolean) => void;
  toggleSidebarCollapsed: (collapsed?: boolean) => void;
  switchRolePreview: (role: Role) => void;
}

const previewUsers: Record<Role, SessionUser> = {
  ADMIN: {
    id: "admin-1",
    fullName: "Admin Demo",
    role: "ADMIN",
    phone: "+998900000101",
    email: "jamshidjalolov6767@gmail.com"
  },
  TEACHER: {
    id: "teacher-1",
    profileId: "teacher-1",
    fullName: "Teacher Demo",
    role: "TEACHER",
    phone: "+998900000102",
    email: "teacher.demo@example.com"
  },
  STUDENT: {
    id: "student-1",
    profileId: "student-1",
    fullName: "Student Demo",
    role: "STUDENT",
    phone: "+998900000103",
    email: "student.demo@example.com"
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      theme: "light",
      commandPaletteOpen: false,
      sidebarOpen: false,
      sidebarCollapsed: false,
      signIn: ({ user, accessToken, refreshToken = null }) =>
        set({
          user,
          accessToken,
          refreshToken
        }),
      setUser: (user) => set({ user }),
      signOut: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null
        }),
      setTheme: (theme) => set({ theme }),
      toggleCommandPalette: (open) =>
        set((state) => ({
          commandPaletteOpen: open ?? !state.commandPaletteOpen
        })),
      toggleSidebar: (open) =>
        set((state) => ({
          sidebarOpen: open ?? !state.sidebarOpen
        })),
      toggleSidebarCollapsed: (collapsed) =>
        set((state) => ({
          sidebarCollapsed: collapsed ?? !state.sidebarCollapsed
        })),
      switchRolePreview: (role) =>
        set((state) =>
          runtimeConfig.useMockApi
            ? {
                user: previewUsers[role],
                accessToken: state.accessToken ?? "demo-access-token",
                refreshToken: null
              }
            : state
        )
    }),
    {
      name: "kurs-boshqaruv-auth"
    }
  )
);
