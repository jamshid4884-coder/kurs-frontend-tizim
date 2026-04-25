import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RoleGuard } from "@/routes/RoleGuard";
import {
  AboutPage,
  ContactPage,
  FeaturesPage,
  ForgotPasswordPage,
  LandingPage,
  LoginPage,
  NotFoundPage,
  ResetPasswordPage
} from "@/features/shared/public-pages";
import {
  AdminAttendancePage,
  AdminCoursesPage,
  AdminDashboardPage,
  AdminGroupsPage,
  AdminNotificationsPage,
  AdminPaymentsPage,
  AdminReportsPage,
  AdminSettingsPage,
  AdminStudentDetailPage,
  AdminStudentsPage,
  AdminTeachersPage
} from "@/features/admin/pages/admin-pages";
import {
  StudentAttendancePage,
  StudentDashboardPage,
  StudentGroupsPage,
  StudentPaymentsPage,
  StudentProfilePage,
  StudentSchedulePage
} from "@/features/student/pages/student-pages";
import {
  TeacherAttendancePage,
  TeacherDashboardPage,
  TeacherGroupsPage,
  TeacherNotificationsPage,
  TeacherProfilePage,
  TeacherStudentDetailPage
} from "@/features/teacher/pages/teacher-pages";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/about", element: <AboutPage /> },
  { path: "/features", element: <FeaturesPage /> },
  { path: "/contact", element: <ContactPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "/admin",
            element: <RoleGuard allowedRoles={["ADMIN"]} />,
            children: [
              { path: "dashboard", element: <AdminDashboardPage /> },
              { path: "students", element: <AdminStudentsPage /> },
              { path: "students/:id", element: <AdminStudentDetailPage /> },
              { path: "teachers", element: <AdminTeachersPage /> },
              { path: "groups", element: <AdminGroupsPage /> },
              { path: "courses", element: <AdminCoursesPage /> },
              { path: "attendance", element: <AdminAttendancePage /> },
              { path: "payments", element: <AdminPaymentsPage /> },
              { path: "reports", element: <AdminReportsPage /> },
              { path: "notifications", element: <AdminNotificationsPage /> },
              { path: "settings", element: <AdminSettingsPage /> }
            ]
          },
          {
            path: "/super-admin",
            element: <RoleGuard allowedRoles={["SUPER_ADMIN"]} />,
            children: [
              { path: "dashboard", element: <AdminDashboardPage /> },
              { path: "students", element: <AdminStudentsPage /> },
              { path: "students/:id", element: <AdminStudentDetailPage /> },
              { path: "teachers", element: <AdminTeachersPage /> },
              { path: "groups", element: <AdminGroupsPage /> },
              { path: "courses", element: <AdminCoursesPage /> },
              { path: "attendance", element: <AdminAttendancePage /> },
              { path: "payments", element: <AdminPaymentsPage /> },
              { path: "reports", element: <AdminReportsPage /> },
              { path: "notifications", element: <AdminNotificationsPage /> },
              { path: "settings", element: <AdminSettingsPage /> }
            ]
          },
          {
            path: "/teacher",
            element: <RoleGuard allowedRoles={["TEACHER"]} />,
            children: [
              { path: "dashboard", element: <TeacherDashboardPage /> },
              { path: "groups", element: <TeacherGroupsPage /> },
              { path: "attendance/workspace", element: <TeacherAttendancePage /> },
              { path: "attendance", element: <TeacherAttendancePage /> },
              { path: "students/:id", element: <TeacherStudentDetailPage /> },
              { path: "notifications", element: <TeacherNotificationsPage /> },
              { path: "profile", element: <TeacherProfilePage /> }
            ]
          },
          {
            path: "/student",
            element: <RoleGuard allowedRoles={["STUDENT"]} />,
            children: [
              { path: "dashboard", element: <StudentDashboardPage /> },
              { path: "groups", element: <StudentGroupsPage /> },
              { path: "attendance", element: <StudentAttendancePage /> },
              { path: "payments", element: <StudentPaymentsPage /> },
              { path: "schedule", element: <StudentSchedulePage /> },
              { path: "profile", element: <StudentProfilePage /> }
            ]
          }
        ]
      }
    ]
  },
  { path: "*", element: <NotFoundPage /> }
]);
