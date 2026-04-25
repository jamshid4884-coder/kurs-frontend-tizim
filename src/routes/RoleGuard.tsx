import { Navigate, Outlet } from "react-router-dom";
import type { Role } from "@/types/domain";
import { useAuthStore } from "@/store/auth-store";

interface RoleGuardProps {
  allowedRoles: Role[];
}

export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const user = useAuthStore((state) => state.user);

  const homePath = user?.role === "SUPER_ADMIN" ? "/super-admin/dashboard" : user ? `/${user.role.toLowerCase()}/dashboard` : "/login";

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate replace to={homePath} />;
  }

  return <Outlet />;
}
