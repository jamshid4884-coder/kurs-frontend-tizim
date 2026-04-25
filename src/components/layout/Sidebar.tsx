import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  ClipboardList,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Layers3,
  NotebookPen,
  Settings,
  Users
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import type { Role } from "@/types/domain";
import { cn } from "@/lib/cn";
import brandLogo from "@/rasmlar/kurs boshqaruv new.png";

const navByRole: Record<Role, Array<{ label: string; caption: string; href: string; icon: LucideIcon }>> = {
  SUPER_ADMIN: [
    { label: "Dashboard", caption: "Platform nazorati", href: "/super-admin/dashboard", icon: LayoutDashboard },
    { label: "O'quvchilar", caption: "Barcha markazlar", href: "/super-admin/students", icon: Users },
    { label: "O'qituvchilar", caption: "Teacher directory", href: "/super-admin/teachers", icon: GraduationCap },
    { label: "Guruhlar", caption: "Akademik oqim", href: "/super-admin/groups", icon: Layers3 },
    { label: "Kurslar", caption: "Dasturlar", href: "/super-admin/courses", icon: BookOpen },
    { label: "Davomat", caption: "Platform nazorati", href: "/super-admin/attendance", icon: ClipboardList },
    { label: "To'lovlar", caption: "Moliya holati", href: "/super-admin/payments", icon: CreditCard },
    { label: "Hisobotlar", caption: "Tahlil va eksport", href: "/super-admin/reports", icon: NotebookPen },
    { label: "Xabarlar", caption: "Telegram markazi", href: "/super-admin/notifications", icon: Bell },
    { label: "Sozlamalar", caption: "Platform boshqaruvi", href: "/super-admin/settings", icon: Settings }
  ],
  ADMIN: [
    { label: "Dashboard", caption: "Umumiy nazorat", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "O'quvchilar", caption: "Student bazasi", href: "/admin/students", icon: Users },
    { label: "O'qituvchilar", caption: "Teacher directory", href: "/admin/teachers", icon: GraduationCap },
    { label: "Guruhlar", caption: "Akademik oqim", href: "/admin/groups", icon: Layers3 },
    { label: "Kurslar", caption: "Dasturlar", href: "/admin/courses", icon: BookOpen },
    { label: "Davomat", caption: "Kundalik nazorat", href: "/admin/attendance", icon: ClipboardList },
    { label: "To'lovlar", caption: "Moliya holati", href: "/admin/payments", icon: CreditCard },
    { label: "Hisobotlar", caption: "Tahlil va eksport", href: "/admin/reports", icon: NotebookPen },
    { label: "Xabarlar", caption: "Telegram markazi", href: "/admin/notifications", icon: Bell },
    { label: "Sozlamalar", caption: "Tizim boshqaruvi", href: "/admin/settings", icon: Settings }
  ],
  TEACHER: [
    { label: "Dashboard", caption: "Kunlik nazorat", href: "/teacher/dashboard", icon: LayoutDashboard },
    { label: "Guruhlar", caption: "Dars guruhlari", href: "/teacher/groups", icon: Layers3 },
    { label: "Davomat", caption: "Ishchi sahifa", href: "/teacher/attendance", icon: ClipboardList },
    { label: "Xabarlar", caption: "Ota-ona bilan aloqa", href: "/teacher/notifications", icon: Bell },
    { label: "Profil", caption: "Akkaunt sozlamasi", href: "/teacher/profile", icon: Users }
  ],
  STUDENT: [
    { label: "Dashboard", caption: "Shaxsiy nazorat", href: "/student/dashboard", icon: LayoutDashboard },
    { label: "Guruhlarim", caption: "Biriktirilgan guruhlar", href: "/student/groups", icon: Layers3 },
    { label: "Davomat", caption: "Qatnashish tarixi", href: "/student/attendance", icon: ClipboardList },
    { label: "To'lovlar", caption: "Moliyaviy holat", href: "/student/payments", icon: CreditCard },
    { label: "Jadval", caption: "Dars tartibi", href: "/student/schedule", icon: BookOpen },
    { label: "Profil", caption: "Shaxsiy ma'lumot", href: "/student/profile", icon: Users }
  ]
};

export function Sidebar() {
  const user = useAuthStore((state) => state.user)!;
  const sidebarOpen = useAuthStore((state) => state.sidebarOpen);
  const toggleSidebar = useAuthStore((state) => state.toggleSidebar);
  const items = navByRole[user.role];

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/30 opacity-0 backdrop-blur-sm transition md:hidden",
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none"
        )}
        onClick={() => toggleSidebar(false)}
      />
      <aside
        className={cn(
          "sidebar-shell p-4 sm:p-5",
          sidebarOpen ? "translate-x-0" : "-translate-x-[110%] lg:translate-x-0"
        )}
      >
        <div className="relative z-[1] flex h-full flex-col">
          <div className="group mx-auto mt-1 flex h-[84px] w-[84px] items-center justify-center rounded-full border border-white/70 bg-white/88 p-1.5 shadow-[0_12px_24px_rgba(8,25,80,0.08)] backdrop-blur transition-all duration-300 hover:border-primary/25 hover:shadow-[0_16px_30px_rgba(59,91,219,0.16)] dark:border-slate-800 dark:bg-slate-950/78">
            <div className="h-full w-full overflow-hidden rounded-full ring-1 ring-primary/10">
              <img
                src={brandLogo}
                alt="Kurs Boshqaruv"
                className="h-full w-full rounded-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>

          <nav className="mt-4 flex-1 space-y-1.5 pr-1 lg:overflow-visible">
            {items.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => toggleSidebar(false)}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-sm transition-all duration-200",
                    isActive
                      ? "bg-primary text-white shadow-[0_10px_18px_rgba(59,91,219,0.18)]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] transition-colors",
                        isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300"
                      )}
                    >
                      <item.icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1 truncate font-medium">{item.label}</div>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
