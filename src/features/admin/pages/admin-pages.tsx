import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, FileText, GripVertical, MoveLeft, MoveRight, Plus, QrCode, Send, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { mockApi } from "@/services/mock-api";
import { AdminCredentialsModal } from "@/components/common/AdminCredentialsModal";
import { AppModal } from "@/components/common/AppModal";
import { AttendanceNotes } from "@/components/common/AttendanceNotes";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { FilterChips } from "@/components/common/FilterChips";
import { NotificationModal } from "@/components/common/NotificationModal";
import { PaymentReceiptModal } from "@/components/common/PaymentReceiptModal";
import { SearchFilterBar } from "@/components/common/SearchFilterBar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TelegramShareModal } from "@/components/common/TelegramShareModal";
import { ChartCard } from "@/components/charts/ChartCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { FilterBar } from "@/components/sections/FilterBar";
import { InfoPanel } from "@/components/sections/InfoPanel";
import { PageHeader as SharedPageHeader } from "@/components/sections/PageHeader";
import { SidePanel } from "@/components/sections/SidePanel";
import { SummaryStrip } from "@/components/sections/SummaryStrip";
import { TimelineList } from "@/components/sections/TimelineList";
import { AttendanceTable } from "@/components/tables/AttendanceTable";
import { DataTable } from "@/components/tables/DataTable";
import { PaymentTable } from "@/components/tables/PaymentTable";
import { cn } from "@/lib/cn";
import { getTodayIso } from "@/lib/date";
import {
  renderTelegramTemplate,
  resolveTelegramMediaUrl,
  telegramImagePresets,
  telegramKeyboardButtons,
  telegramPlaceholderHints
} from "@/lib/telegram-preview";
import { useLiveUpdates } from "@/providers/LiveUpdatesProvider";
import type { AccountCreateResponse, AccountCredentials, AttendanceEntry, PaymentEntry, PaymentReceipt, RecordPaymentResponse, StudentSummary } from "@/types/domain";

type StudentFilter = "all" | "paid" | "attention" | "lowAttendance" | "telegramMissing";
type AttendanceFilter = "all" | "today" | "present" | "absent" | "late" | "attention";
type PaymentFilter = "all" | "paid" | "partial" | "unpaid" | "overdue";
type GroupFilter = "all" | "risk" | "stable";
type NotificationFilter = "all" | "today" | "sent";
type GroupActionIntent =
  | {
      mode: "assign";
      studentId: string;
      studentName: string;
      fromGroup: string;
      toGroup: string;
    }
  | {
      mode: "remove";
      studentId: string;
      studentName: string;
      fromGroup: string;
    };

type AdminCredentialModalState = {
  title: string;
  description: string;
  credentials: AccountCredentials;
} | null;

const TODAY = getTodayIso();
const defaultCourseOptions = ["Ingliz tili asoslari", "Matematika tezkor kursi", "IELTS intensiv"];
const groupScheduleOptions = ["Du, Cho, Ju - 17:00", "Se, Pa, Sha - 15:30", "Se, Pa, Sha - 18:30"] as const;

function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <SharedPageHeader
      eyebrow="Admin boshqaruvi"
      title={title}
      description={description}
      action={actions}
      metaTitle="Akademiya nazorati"
      metaDescription="O'quvchi, guruh, moliya va kundalik nazorat bitta professional ish maydonida."
      breadcrumbs={["Boshqaruv", "Admin", title]}
    />
  );
}

function slugifyWordFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "hisobot";
}

function escapeWordHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildWordExportHtml(title: string, contentHtml: string) {
  const exportedAt = new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(new Date());

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <title>${escapeWordHtml(title)}</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; padding: 28px; }
      h1, h2, h3, h4, h5, h6 { color: #0f172a; margin: 0 0 10px; }
      h1 { font-size: 28px; margin-bottom: 8px; }
      p { margin: 0 0 10px; line-height: 1.55; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; }
      th { background: #e2e8f0; font-weight: 700; }
      ul, ol { margin: 10px 0 14px 22px; }
      .word-export-meta { margin-bottom: 18px; color: #475569; font-size: 12px; }
      .word-export-content > * { margin-bottom: 14px; }
      .word-export-content div { line-height: 1.5; }
      .word-export-content a { color: #0f172a; text-decoration: none; }
      .word-export-content svg, .word-export-content button, .word-export-content input, .word-export-content select, .word-export-content textarea { display: none !important; }
    </style>
  </head>
  <body>
    <h1>${escapeWordHtml(title)}</h1>
    <div class="word-export-meta">Eksport qilingan vaqt: ${escapeWordHtml(exportedAt)}</div>
    <div class="word-export-content">${contentHtml}</div>
  </body>
</html>`;
}

function formatPaymentStatusForExport(status: StudentSummary["paymentStatus"]) {
  const labels: Record<StudentSummary["paymentStatus"], string> = {
    paid: "To'langan",
    unpaid: "To'lanmagan",
    partial: "Qisman to'langan",
    overdue: "Muddati o'tgan"
  };

  return labels[status];
}

function buildStudentExportTable(students: StudentSummary[]) {
  const rows = students.length
    ? students
        .map(
          (student, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeWordHtml(student.fullName)}</td>
              <td>${escapeWordHtml(student.group)}</td>
              <td>${escapeWordHtml(student.course)}</td>
              <td>${escapeWordHtml(student.monthlyFee)}</td>
              <td>${escapeWordHtml(formatPaymentStatusForExport(student.paymentStatus))}</td>
            </tr>`
        )
        .join("")
    : `<tr><td colspan="6">Ma'lumot topilmadi.</td></tr>`;

  return `
    <h2>O'quvchilar ro'yxati</h2>
    <table>
      <thead>
        <tr>
          <th>T/r</th>
          <th>O'quvchi</th>
          <th>Guruh</th>
          <th>Kurs</th>
          <th>1 oylik to'lov</th>
          <th>To'lov holati</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function exportSectionToWord(event: ReactMouseEvent<HTMLButtonElement>, title: string, students?: StudentSummary[]) {
  const section = event.currentTarget.closest("section");

  if (!section) {
    toast.error("Eksport uchun sahifa topilmadi.");
    return;
  }

  const clone = section.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button, input, select, textarea, [role='dialog'], script, style").forEach((element) => element.remove());

  const contentHtml = students ? `${clone.innerHTML}${buildStudentExportTable(students)}` : clone.innerHTML;
  const html = buildWordExportHtml(title, contentHtml);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugifyWordFileName(title)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast.success("Word fayli yuklandi.");
}

function ExportButtons({ title, students }: { title: string; students?: StudentSummary[] }) {
  return (
    <>
      <Button variant="secondary" onClick={() => window.print()}>
        <Download size={16} className="mr-2" />
        Chop etish
      </Button>
      <Button variant="secondary" onClick={(event) => exportSectionToWord(event, title, students)}>
        <FileText size={16} className="mr-2" />
        Wordga eksport
      </Button>
    </>
  );
}

function formatNoteTag(tag: string) {
  const labels: Record<string, string> = {
    LATE: "Kechikdi",
    ABSENT: "Kelmadi",
    EXCUSED: "Sababli kelmadi",
    NOT_PREPARED: "Tayyor emas",
    HOMEWORK_NOT_DONE: "Uy vazifasi qilinmagan",
    GOOD_ACTIVITY: "Faolligi yaxshi",
    LOW_DISCIPLINE: "Intizomi past",
    EXCELLENT_PARTICIPATION: "A'lo qatnashdi",
    PARENT_CALL_REQUIRED: "Ota-ona bilan gaplashish kerak"
  };

  return labels[tag] ?? tag;
}

function matchesStudentFilter(student: StudentSummary, filter: StudentFilter) {
  if (filter === "paid") {
    return student.paymentStatus === "paid";
  }

  if (filter === "attention") {
    return student.paymentStatus !== "paid";
  }

  if (filter === "lowAttendance") {
    return student.attendancePercent < 80;
  }

  if (filter === "telegramMissing") {
    return student.parentTelegramStatus === "missing";
  }

  return true;
}

function matchesAttendanceFilter(item: AttendanceEntry, filter: AttendanceFilter) {
  if (filter === "today") {
    return item.date === TODAY;
  }

  if (filter === "present") {
    return item.status === "present";
  }

  if (filter === "absent") {
    return item.status === "absent";
  }

  if (filter === "late") {
    return item.status === "late";
  }

  if (filter === "attention") {
    return item.status === "not_prepared" || item.status === "homework_not_done";
  }

  return true;
}

function matchesPaymentFilter(item: PaymentEntry, filter: PaymentFilter) {
  if (filter === "all") {
    return true;
  }

  return item.status === filter;
}

function formatPaymentMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-");

  if (!year || !month) {
    return monthValue;
  }

  const label = new Intl.DateTimeFormat("uz-UZ", { year: "numeric", month: "long" }).format(new Date(`${monthValue}-01T12:00:00`));
  return label.replace(/\s+/g, " ");
}

function parseMoneyValue(value?: string | null) {
  return Number(String(value ?? "").replace(/[^\d]/g, "")) || 0;
}

function getPaymentStatusPreview(expectedAmount: number, paidAmount: number, dueDate: string): PaymentEntry["status"] {
  if (expectedAmount <= 0) {
    return paidAmount > 0 ? "paid" : "unpaid";
  }

  if (expectedAmount > 0 && paidAmount >= expectedAmount) {
    return "paid";
  }

  if (paidAmount > 0) {
    return "partial";
  }

  if (dueDate && dueDate < TODAY) {
    return "overdue";
  }

  return "unpaid";
}

function getPaymentStatusNotePreview(expectedAmount: number, paidAmount: number, dueDate: string) {
  const status = getPaymentStatusPreview(expectedAmount, paidAmount, dueDate);

  if (status === "paid") {
    return "To'liq to'langan";
  }

  if (status === "partial") {
    return expectedAmount > 0 && paidAmount * 2 === expectedAmount ? "Yarim to'langan" : "Qisman to'langan";
  }

  if (status === "overdue") {
    return "To'lanmagan, muddati o'tgan";
  }

  return "To'lanmagan";
}

type LiveConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

function TelegramLiveBadge({
  connectionStatus,
  liveStatus
}: {
  connectionStatus: StudentSummary["parentTelegramStatus"];
  liveStatus: LiveConnectionStatus;
}) {
  const isConnected = connectionStatus === "connected";
  const isLive = liveStatus === "connected";
  const isConnecting = liveStatus === "connecting" || liveStatus === "reconnecting";
  const streamLabel = isLive ? "Jonli" : isConnecting ? "Ulanmoqda" : "Offline";

  return (
    <div className="flex min-w-[150px] flex-col gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em]",
          isConnected
            ? "border border-emerald-200 bg-emerald-500/12 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300"
            : "border border-rose-200 bg-rose-500/12 text-rose-700 dark:border-rose-900/60 dark:text-rose-300"
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", isConnected ? "bg-emerald-500" : "bg-rose-500")} />
        {isConnected ? "Telegram ulangan" : "Telegram ulanmagan"}
      </span>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
          isLive
            ? "bg-sky-500/12 text-sky-700 dark:text-sky-300"
            : isConnecting
              ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
              : "bg-slate-500/12 text-slate-600 dark:text-slate-300"
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", isLive ? "animate-pulse bg-sky-500" : isConnecting ? "bg-amber-500" : "bg-slate-400")} />
        {streamLabel}
      </span>
    </div>
  );
}

export function AdminDashboardPage() {
  const { data } = useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: () => mockApi.getDashboardMetrics("ADMIN")
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: mockApi.getStudents
  });
  const { data: attendance } = useQuery({
    queryKey: ["attendance"],
    queryFn: mockApi.getAttendance
  });
  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: mockApi.getPayments
  });
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: mockApi.getNotifications
  });

  const absentToday = (attendance ?? []).filter((item) => item.date === TODAY && item.status === "absent").length;
  const attentionToday = (attendance ?? []).filter(
    (item) => item.date === TODAY && (item.status === "not_prepared" || item.status === "homework_not_done")
  ).length;
  const unpaidStudents = (students ?? []).filter((item) => item.paymentStatus !== "paid").length;
  const riskStudents = (students ?? []).filter((item) => item.paymentStatus !== "paid" || item.attendancePercent < 80);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Admin boshqaruv paneli"
        description="Markaz bo'yicha umumiy nazorat, to'lov va davomatdagi xavfli holatlar hamda kunlik tezkor qarorlar uchun bosh sahifa."
        actions={<ExportButtons title="Admin boshqaruv paneli" students={students ?? []} />}
      />
      <SummaryStrip>
        {data?.metrics.map((metric) => <StatsCard key={metric.label} {...metric} />)}
      </SummaryStrip>
      <div className="dashboard-main-grid">
        <div className="space-y-6">
          <ChartCard
            title="Davomat dinamikasi"
            description="So'nggi dars kunlari bo'yicha markazning umumiy qatnashish foizi."
            data={data?.chart ?? []}
          />
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <InfoPanel title="Xavfli o'quvchilar" description="Davomat yoki to'lov bo'yicha e'tibor talab qilayotgan ro'yxat.">
              <div className="space-y-3">
                {riskStudents.slice(0, 5).map((student) => (
                  <Link
                    key={student.id}
                    to={`/admin/students/${student.id}`}
                    className="flex items-center justify-between rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 transition hover:border-primary/30 dark:bg-slate-900/70"
                  >
                    <div>
                      <div className="font-medium">{student.fullName}</div>
                      <div className="text-sm text-slate-500">
                        Davomat: {student.attendancePercent}% | To'lov: {student.paymentStatus === "paid" ? "To'langan" : "Nazorat kerak"}
                      </div>
                    </div>
                    <StatusBadge status={student.paymentStatus} />
                  </Link>
                ))}
              </div>
            </InfoPanel>
            <InfoPanel title="So'nggi to'lov holati" description="Oxirgi moliyaviy yozuvlar va ularning statusi.">
              <div className="space-y-3">
                {(payments ?? []).slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">
                    <div>
                      <div className="font-medium">{payment.studentName}</div>
                      <div className="text-sm text-slate-500">
                        {payment.month} | {payment.amount}
                      </div>
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                ))}
              </div>
            </InfoPanel>
          </div>
        </div>
        <SidePanel title="Tezkor nazorat" description="Bugungi muhim signal va qisqa yo'llar.">
          <div className="space-y-3">
            {[
              {
                title: "Bugun kelmaganlar",
                description: `${absentToday} nafar o'quvchi bugun darsga kelmagan`,
                href: "/admin/attendance"
              },
              {
                title: "Bugun ogohlantirishlar",
                description: `${attentionToday} ta tayyor emas yoki vazifa qilmagan holat bor`,
                href: "/admin/attendance"
              },
              {
                title: "To'lov qilmaganlar",
                description: `${unpaidStudents} nafar o'quvchida qarzdorlik yoki ochiq to'lov bor`,
                href: "/admin/payments"
              },
              {
                title: "Telegram tarixi",
                description: `${notifications?.length ?? 0} ta xabar logda saqlangan`,
                href: "/admin/notifications"
              }
            ].map((item) => (
              <Link
                key={item.title}
                to={item.href}
                className="block rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-4 transition hover:border-primary/30 dark:bg-slate-900/70"
              >
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</div>
              </Link>
            ))}
          </div>
          <div className="rounded-[24px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent activity</div>
            <div className="mt-3">
              <TimelineList
                items={(notifications ?? []).slice(0, 4).map((item) => ({
                  id: item.id,
                  title: item.studentName,
                  description: item.template,
                  meta: item.sentAt,
                  tone: item.status === "failed" ? "danger" : "success"
                }))}
              />
            </div>
          </div>
        </SidePanel>
      </div>
    </section>
  );
}

export function AdminStudentsPage() {
  const queryClient = useQueryClient();
  const { status: liveStatus } = useLiveUpdates();
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StudentFilter>("all");
  const [studentFullName, setStudentFullName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentParentName, setStudentParentName] = useState("");
  const [studentParentPhone, setStudentParentPhone] = useState("");
  const [studentCourse, setStudentCourse] = useState("");
  const [studentTelegramHandle, setStudentTelegramHandle] = useState("");
  const [createdStudentAccount, setCreatedStudentAccount] = useState<(AccountCreateResponse & { studentId?: string }) | null>(null);
  const [selectedStudentCredentials, setSelectedStudentCredentials] = useState<AdminCredentialModalState>(null);
  const [selectedNotificationStudent, setSelectedNotificationStudent] = useState<StudentSummary | null>(null);
  const [selectedShareStudent, setSelectedShareStudent] = useState<StudentSummary | null>(null);
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: mockApi.getCourses
  });
  const { data } = useQuery({
    queryKey: ["students"],
    queryFn: mockApi.getStudents
  });
  const courseOptions = courses?.map((item) => item.title) ?? defaultCourseOptions;

  const filtered = useMemo(
    () =>
      (data ?? []).filter((item) => {
        const haystack = [item.fullName, item.group, item.course, item.parentName, item.parentPhone].join(" ").toLowerCase();
        return haystack.includes(search.toLowerCase()) && matchesStudentFilter(item, filter);
      }),
    [data, filter, search]
  );

  const students = data ?? [];
  const createStudentMutation = useMutation({
    mutationFn: mockApi.createStudent,
    onMutate: async () => {
      setCreatedStudentAccount(null);
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["student-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "teacher"] })
      ]);
      await queryClient.refetchQueries({ queryKey: ["students"], type: "active" });

      setIsStudentModalOpen(false);
      setCreatedStudentAccount(response);
      setSearch("");
      setFilter("all");
      setStudentFullName("");
      setStudentPhone("");
      setStudentEmail("");
      setStudentPassword("");
      setStudentParentName("");
      setStudentParentPhone("");
      setStudentCourse("");
      setStudentTelegramHandle("");
      toast.success(response.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const canCreateStudent = Boolean(
    studentFullName.trim() &&
      studentPhone.trim() &&
      studentPassword.trim() &&
      studentParentName.trim() &&
      studentParentPhone.trim()
  );

  return (
    <section className="space-y-6">
      <PageHeader
        title="O'quvchilar boshqaruvi"
        description="Qidirish, filtrlash va o'quvchi to'lovi, davomat hamda ota-ona aloqasini bir joyda ko'rish."
        actions={
          <Button onClick={() => setIsStudentModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Yangi o'quvchi
          </Button>
        }
      />
      <SummaryStrip>
        <StatsCard label="Jami o'quvchilar" value={String(students.length)} change="Faol ro'yxat" tone="primary" />
        <StatsCard
          label="To'lov qilganlar"
          value={String(students.filter((item) => item.paymentStatus === "paid").length)}
          change="To'liq yopilgan"
          tone="success"
        />
        <StatsCard
          label="Nazorat kerak"
          value={String(students.filter((item) => item.paymentStatus !== "paid").length)}
          change="Qarzdor yoki qisman"
          tone="warning"
        />
        <StatsCard
          label="Telegram ulanmagan"
          value={String(students.filter((item) => item.parentTelegramStatus === "missing").length)}
          change="Ulash tavsiya etiladi"
          tone="danger"
        />
      </SummaryStrip>
      <FilterBar
        aside={
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Barchasi", count: students.length },
              { value: "paid", label: "To'laganlar", count: students.filter((item) => item.paymentStatus === "paid").length, tone: "success" },
              { value: "attention", label: "Qarzdorlar", count: students.filter((item) => item.paymentStatus !== "paid").length, tone: "danger" },
              { value: "lowAttendance", label: "Davomati past", count: students.filter((item) => item.attendancePercent < 80).length, tone: "warning" },
              { value: "telegramMissing", label: "Telegram ulanmagan", count: students.filter((item) => item.parentTelegramStatus === "missing").length }
            ]}
          />
        }
      >
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder="O'quvchi, guruh, kurs yoki ota-ona bo'yicha qidiring..."
          quickFilterLabel="Faqat qarzdorlar"
          onQuickFilter={() => setFilter("attention")}
        />
      </FilterBar>
      <DataTable
        rows={filtered}
        emptyTitle="Mos o'quvchi topilmadi"
        emptyDescription="Qidiruv yoki filter shartlarini yengillashtirib qayta urinib ko'ring."
        columns={[
          {
            key: "student",
            header: "O'quvchi",
            render: (row) => (
              <div>
                <Link to={`/admin/students/${row.id}`} className="font-semibold hover:text-primary">
                  {row.fullName}
                </Link>
                <div className="text-xs text-slate-500">{row.phone}</div>
              </div>
            )
          },
          {
            key: "group",
            header: "Guruh / Kurs",
            render: (row) => (
              <div>
                <div>{row.group}</div>
                <div className="text-xs text-slate-500">{row.course}</div>
                <div className="text-xs text-slate-400">{row.schedule ?? "Jadval biriktirilmagan"}</div>
              </div>
            )
          },
          {
            key: "parent",
            header: "Ota-ona",
            render: (row) => (
              <div>
                <div>{row.parentName}</div>
                <div className="text-xs text-slate-500">{row.parentPhone}</div>
              </div>
            )
          },
          {
            key: "telegram",
            header: "Telegram holati",
            render: (row) => <TelegramLiveBadge connectionStatus={row.parentTelegramStatus} liveStatus={liveStatus} />
          },
          { key: "attendance", header: "Davomat", render: (row) => `${row.attendancePercent}%` },
          { key: "payment", header: "To'lov", render: (row) => <StatusBadge status={row.paymentStatus} /> },
          {
            key: "share",
            header: "Ulash",
            render: (row) => (
              row.parentTelegramConnectUrl ? (
                <div className="flex min-w-[160px] flex-col gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(row.parentTelegramConnectUrl ?? "");
                      toast.success("Telegram ulash linki nusxalandi.");
                    }}
                  >
                    <Copy size={14} />
                    Ulash linki
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedShareStudent(row)}>
                    <QrCode size={14} />
                    QR code
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/80 px-3 py-3 text-xs text-slate-500">
                  Bot linki tayyor emas
                </div>
              )
            )
          },
          {
            key: "notify",
            header: "Xabar",
            render: (row) => (
              row.parentTelegramStatus === "connected" ? (
                <Button variant="secondary" size="sm" onClick={() => setSelectedNotificationStudent(row)}>
                  Telegramga yozish
                </Button>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-300">Avval ulang</span>
              )
            )
          },
          {
            key: "credentials",
            header: "Login",
            render: (row) =>
              row.accountCredentials ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setSelectedStudentCredentials({
                      title: `${row.fullName} login ma'lumoti`,
                      description: "Bu ma'lumot faqat admin uchun ko'rinadi.",
                      credentials: row.accountCredentials!,
                    })
                  }
                >
                  Loginni ko'rish
                </Button>
              ) : (
                <span className="text-xs text-slate-400">Hali berilmagan</span>
              )
          },
          {
            key: "note",
            header: "So'nggi izoh",
            render: (row) => <div className="max-w-xs text-xs text-slate-500">{row.lastTeacherNote}</div>
          }
        ]}
      />
      <AppModal
        open={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        title="Yangi o'quvchi qo'shish"
        description="Admin shu yerda akkaunt ochadi. Login va parol keyin alohida xavfsiz oynada ko'rinadi."
        eyebrow="Student onboarding"
        size="xl"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setIsStudentModalOpen(false)} className="w-full sm:w-auto">
              Bekor qilish
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!canCreateStudent || createStudentMutation.isPending}
              loading={createStudentMutation.isPending}
              onClick={() =>
                createStudentMutation.mutate({
                  fullName: studentFullName,
                  phone: studentPhone,
                  email: studentEmail || undefined,
                  password: studentPassword,
                  parentName: studentParentName,
                  parentPhone: studentParentPhone,
                  course: studentCourse || undefined,
                  parentTelegramHandle: studentTelegramHandle || undefined
                })
              }
            >
              {createStudentMutation.isPending ? "Qo'shilmoqda..." : "O'quvchini qo'shish"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="field-grid">
            <label>
              <span className="field-label">To'liq ism</span>
              <input value={studentFullName} onChange={(event) => setStudentFullName(event.target.value)} className="field-control" placeholder="Masalan: Aziza Karimova" />
            </label>
            <label>
              <span className="field-label">Telefon</span>
              <input value={studentPhone} onChange={(event) => setStudentPhone(event.target.value)} className="field-control" placeholder="+99890..." />
            </label>
            <label>
              <span className="field-label">Email</span>
              <input value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} className="field-control" placeholder="ixtiyoriy" />
            </label>
            <label>
              <span className="field-label">Login paroli</span>
              <input value={studentPassword} onChange={(event) => setStudentPassword(event.target.value)} className="field-control" placeholder="Kamida 6 ta belgi" />
            </label>
            <label>
              <span className="field-label">Ota-ona ismi</span>
              <input value={studentParentName} onChange={(event) => setStudentParentName(event.target.value)} className="field-control" placeholder="Masalan: Nilufar Karimova" />
            </label>
            <label>
              <span className="field-label">Ota-ona telefoni</span>
              <input value={studentParentPhone} onChange={(event) => setStudentParentPhone(event.target.value)} className="field-control" placeholder="+99890..." />
            </label>
            <label>
              <span className="field-label">Kurs</span>
              <select value={studentCourse} onChange={(event) => setStudentCourse(event.target.value)} className="field-control">
                <option value="">Keyin biriktiriladi</option>
                {courseOptions.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Telegram handle</span>
              <input value={studentTelegramHandle} onChange={(event) => setStudentTelegramHandle(event.target.value)} className="field-control" placeholder="@otaona_ixtiyoriy" />
            </label>
          </div>
        </div>
      </AppModal>
      {createdStudentAccount ? (
        <AdminCredentialsModal
          open={Boolean(createdStudentAccount)}
          onClose={() => setCreatedStudentAccount(null)}
          title="O'quvchi login ma'lumoti"
          description="Login va parolni admin foydalanuvchiga yuboradi yoki qo'lda beradi."
          loginIdentifier={createdStudentAccount.loginIdentifier}
          password={createdStudentAccount.password}
        />
      ) : null}
      {selectedStudentCredentials ? (
        <AdminCredentialsModal
          open={Boolean(selectedStudentCredentials)}
          onClose={() => setSelectedStudentCredentials(null)}
          title={selectedStudentCredentials.title}
          description={selectedStudentCredentials.description}
          loginIdentifier={selectedStudentCredentials.credentials.loginIdentifier}
          password={selectedStudentCredentials.credentials.password}
        />
      ) : null}
      {selectedNotificationStudent ? (
        <NotificationModal
          open={Boolean(selectedNotificationStudent)}
          studentId={selectedNotificationStudent.id}
          studentName={selectedNotificationStudent.fullName}
          onClose={() => setSelectedNotificationStudent(null)}
        />
      ) : null}
      {selectedShareStudent ? (
        <TelegramShareModal
          open={Boolean(selectedShareStudent)}
          studentName={selectedShareStudent.fullName}
          parentName={selectedShareStudent.parentName}
          connectUrl={selectedShareStudent.parentTelegramConnectUrl}
          onClose={() => setSelectedShareStudent(null)}
        />
      ) : null}
    </section>
  );
}

export function AdminStudentDetailPage() {
  const { id = "student-1" } = useParams();
  const queryClient = useQueryClient();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["student-detail", id],
    queryFn: () => mockApi.getStudentDetail(id)
  });
  const quickNotifyMutation = useMutation({
    mutationFn: (template: string) =>
      mockApi.sendNotification({
        studentId: id,
        studentName: data?.fullName,
        template
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
      toast.success("Telegram xabari yuborildi.");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const attendancePercent = data?.attendanceTimeline.length
    ? Math.round(
        (data.attendanceTimeline.filter((item) => item.status !== "absent").length / data.attendanceTimeline.length) * 100
      )
    : 0;
  const openPayments = (data?.payments ?? []).filter((item) => item.status !== "paid").length;
  const canSendTelegram = data?.parentTelegramStatus === "connected";

  if (!data) {
    return <EmptyState title="O'quvchi topilmadi" description="So'ralgan o'quvchi ma'lumotlarini yuklab bo'lmadi." />;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={data.fullName}
        description={`${data.group} - ${data.course}`}
        actions={
          <div className="flex flex-wrap gap-3">
            {data.accountCredentials ? (
              <Button variant="secondary" onClick={() => setCredentialOpen(true)}>
                Login ma'lumoti
              </Button>
            ) : null}
            <Button variant="secondary" disabled={!canSendTelegram || quickNotifyMutation.isPending} loading={quickNotifyMutation.isPending} onClick={() => quickNotifyMutation.mutate("Davomat - Kelmadi")}>
              Kelmagan
            </Button>
            <Button variant="secondary" disabled={!canSendTelegram || quickNotifyMutation.isPending} loading={quickNotifyMutation.isPending} onClick={() => quickNotifyMutation.mutate("Uy vazifasi - Bajarilmagan")}>
              Uy vazifasi
            </Button>
            <Button variant="secondary" disabled={!canSendTelegram || quickNotifyMutation.isPending} loading={quickNotifyMutation.isPending} onClick={() => quickNotifyMutation.mutate("To'lov - Qilinmagan")}>
              To'lov
            </Button>
            <Button disabled={!canSendTelegram} onClick={() => setNotificationOpen(true)}>
              <Send size={16} className="mr-2" />
              Boshqa xabar
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard label="Davomat foizi" value={`${attendancePercent}%`} change="So'nggi tarix asosida" tone="primary" />
        <StatsCard label="Ochiq to'lovlar" value={String(openPayments)} change="To'liq yopilmagan oylar" tone="warning" />
        <StatsCard label="Uy vazifalari" value={String(data.homework.length)} change="Faol topshiriqlar" tone="success" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">O'quvchi telefoni</div>
              <div className="mt-1 font-medium">{data.phone}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Ota-ona</div>
              <div className="mt-1 font-medium">{data.parentName}</div>
              <div className="text-sm text-slate-500">{data.parentPhone}</div>
              <div className="mt-2">
                <StatusBadge status={data.parentTelegramStatus} />
              </div>
              {!canSendTelegram ? <div className="mt-2 text-sm text-amber-600 dark:text-amber-300">Avval ota-onani Telegram botga ulang.</div> : null}
              {data.parentTelegramConnectUrl ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(data.parentTelegramConnectUrl ?? "");
                      toast.success("Botga ulash linki nusxalandi.");
                    }}
                  >
                    Telegram linkini nusxalash
                  </Button>
                  <Button variant="secondary" onClick={() => window.open(data.parentTelegramConnectUrl ?? "", "_blank", "noopener,noreferrer")}>
                    Botni ochish
                  </Button>
                </div>
              ) : null}
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">O'qituvchi</div>
              <div className="mt-1 font-medium">{data.teacherName ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Jadval</div>
              <div className="mt-1 font-medium">{data.schedule ?? "-"}</div>
              <div className="text-sm text-slate-500">{data.room ?? "-"}</div>
            </div>
          </div>
          <div>
            <div className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-400">Davomat tarixi</div>
            <div className="space-y-3">
              {data.attendanceTimeline.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.date}</div>
                      <div className="mt-2">
                        <AttendanceNotes
                          comment={item.comment}
                          homeworkComment={item.homeworkComment}
                          dailyGradeComment={item.dailyGradeComment}
                          emptyLabel="Oddiy dars kuni"
                          compact
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <StatusBadge status={item.status} />
                      {typeof item.dailyGrade === "number" ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                            item.dailyGrade >= 5
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : item.dailyGrade >= 4
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                          }`}
                        >
                          Kunlik baho: {item.dailyGrade}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <div className="space-y-6">
          <PaymentTable rows={data.payments} />
          <Card className="space-y-4">
            <h3 className="font-display text-xl font-bold">O'qituvchi izohlari</h3>
            {data.notes.map((note) => (
              <div key={note.id} className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{formatNoteTag(note.tag)}</div>
                  <div className="text-xs text-slate-400">{note.date}</div>
                </div>
                <div className="mt-2 text-sm text-slate-500">{note.comment}</div>
              </div>
            ))}
          </Card>
          <Card className="space-y-4">
            <h3 className="font-display text-xl font-bold">Uy vazifalari</h3>
            {data.homework.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border bg-white/70 px-4 py-3 dark:bg-slate-900/50">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-slate-500">Topshirish muddati: {item.dueDate}</div>
                </div>
                <StatusBadge status={item.status === "submitted" ? "submitted" : "pending"} />
              </div>
            ))}
          </Card>
        </div>
      </div>
      <NotificationModal open={notificationOpen} studentId={data.id} studentName={data.fullName} onClose={() => setNotificationOpen(false)} />
      {data.accountCredentials ? (
        <AdminCredentialsModal
          open={credentialOpen}
          onClose={() => setCredentialOpen(false)}
          title={`${data.fullName} login ma'lumoti`}
          description="Bu ma'lumot faqat admin uchun ko'rinadi."
          loginIdentifier={data.accountCredentials.loginIdentifier}
          password={data.accountCredentials.password}
        />
      ) : null}
    </section>
  );
}

export function AdminTeachersPage() {
  const queryClient = useQueryClient();
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [teacherFullName, setTeacherFullName] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherSpecialization, setTeacherSpecialization] = useState("");
  const [createdTeacherAccount, setCreatedTeacherAccount] = useState<(AccountCreateResponse & { teacherId?: string }) | null>(null);
  const [selectedTeacherCredentials, setSelectedTeacherCredentials] = useState<AdminCredentialModalState>(null);
  const { data } = useQuery({
    queryKey: ["teachers"],
    queryFn: mockApi.getTeachers
  });

  const teachers = data ?? [];
  const createTeacherMutation = useMutation({
    mutationFn: mockApi.createTeacher,
    onMutate: async () => {
      setCreatedTeacherAccount(null);
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teachers"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] })
      ]);

      setIsTeacherModalOpen(false);
      setCreatedTeacherAccount(response);
      setTeacherFullName("");
      setTeacherPhone("");
      setTeacherEmail("");
      setTeacherPassword("");
      setTeacherSpecialization("");
      toast.success(response.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const canCreateTeacher = Boolean(teacherFullName.trim() && teacherPhone.trim() && teacherPassword.trim());

  return (
    <section className="space-y-6">
      <PageHeader
        title="O'qituvchilar boshqaruvi"
        description="Guruh biriktirish, yuklama va natijalarni umumiy ko'rinishda boshqarish."
        actions={
          <Button onClick={() => setIsTeacherModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Yangi o'qituvchi
          </Button>
        }
      />
      <SummaryStrip>
        <StatsCard label="Jami o'qituvchilar" value={String(teachers.length)} change="Faol ro'yxat" tone="primary" />
        <StatsCard
          label="Faol o'qituvchilar"
          value={String(teachers.filter((item) => item.status === "active").length)}
          change="Darsda ishlayapti"
          tone="success"
        />
        <StatsCard
          label="Boshqarilayotgan o'quvchilar"
          value={String(teachers.reduce((sum, item) => sum + item.studentCount, 0))}
          change="Barcha guruhlar bo'yicha"
          tone="warning"
        />
      </SummaryStrip>
      <DataTable
        rows={teachers}
        columns={[
          { key: "teacher", header: "O'qituvchi", render: (row) => row.fullName },
          { key: "specialization", header: "Yo'nalishi", render: (row) => row.specialization },
          { key: "groups", header: "Guruhlari", render: (row) => row.groups.join(", ") },
          { key: "students", header: "O'quvchilar", render: (row) => row.studentCount },
          {
            key: "credentials",
            header: "Login",
            render: (row) =>
              row.accountCredentials ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setSelectedTeacherCredentials({
                      title: `${row.fullName} login ma'lumoti`,
                      description: "Bu ma'lumot faqat admin uchun ko'rinadi.",
                      credentials: row.accountCredentials!,
                    })
                  }
                >
                  Loginni ko'rish
                </Button>
              ) : (
                <span className="text-xs text-slate-400">Hali berilmagan</span>
              )
          },
          {
            key: "status",
            header: "Holati",
            render: (row) => <StatusBadge status={row.status === "active" ? "connected" : "missing"} />
          }
        ]}
      />
      <AppModal
        open={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        title="Yangi o'qituvchi qo'shish"
        description="O'qituvchi akkaunti shu modal orqali yaratiladi. Login va parol admin uchun alohida oynada ochiladi."
        eyebrow="Teacher onboarding"
        size="xl"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setIsTeacherModalOpen(false)} className="w-full sm:w-auto">
              Bekor qilish
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!canCreateTeacher || createTeacherMutation.isPending}
              loading={createTeacherMutation.isPending}
              onClick={() =>
                createTeacherMutation.mutate({
                  fullName: teacherFullName,
                  phone: teacherPhone,
                  email: teacherEmail || undefined,
                  password: teacherPassword,
                  specialization: teacherSpecialization || undefined
                })
              }
            >
              {createTeacherMutation.isPending ? "Qo'shilmoqda..." : "O'qituvchini qo'shish"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="field-grid">
            <label>
              <span className="field-label">To'liq ism</span>
              <input value={teacherFullName} onChange={(event) => setTeacherFullName(event.target.value)} className="field-control" placeholder="Masalan: Dilorom Saidova" />
            </label>
            <label>
              <span className="field-label">Telefon</span>
              <input value={teacherPhone} onChange={(event) => setTeacherPhone(event.target.value)} className="field-control" placeholder="+99890..." />
            </label>
            <label>
              <span className="field-label">Email</span>
              <input value={teacherEmail} onChange={(event) => setTeacherEmail(event.target.value)} className="field-control" placeholder="ixtiyoriy" />
            </label>
            <label>
              <span className="field-label">Parol</span>
              <input value={teacherPassword} onChange={(event) => setTeacherPassword(event.target.value)} className="field-control" placeholder="Kamida 6 ta belgi" />
            </label>
            <label className="md:col-span-2">
              <span className="field-label">Yo'nalishi</span>
              <input value={teacherSpecialization} onChange={(event) => setTeacherSpecialization(event.target.value)} className="field-control" placeholder="IELTS / Matematika / ..." />
            </label>
          </div>
        </div>
      </AppModal>
      {createdTeacherAccount ? (
        <AdminCredentialsModal
          open={Boolean(createdTeacherAccount)}
          onClose={() => setCreatedTeacherAccount(null)}
          title="O'qituvchi login ma'lumoti"
          description="Bu ma'lumotni admin saqlab qoladi va o'qituvchiga beradi."
          loginIdentifier={createdTeacherAccount.loginIdentifier}
          password={createdTeacherAccount.password}
        />
      ) : null}
      {selectedTeacherCredentials ? (
        <AdminCredentialsModal
          open={Boolean(selectedTeacherCredentials)}
          onClose={() => setSelectedTeacherCredentials(null)}
          title={selectedTeacherCredentials.title}
          description={selectedTeacherCredentials.description}
          loginIdentifier={selectedTeacherCredentials.credentials.loginIdentifier}
          password={selectedTeacherCredentials.credentials.password}
        />
      ) : null}
    </section>
  );
}

export function AdminGroupsPage() {
  const queryClient = useQueryClient();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<GroupFilter>("all");
  const [selectedManageGroupId, setSelectedManageGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCourse, setNewGroupCourse] = useState("Ingliz tili asoslari");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [newRoom, setNewRoom] = useState("D1 xona");
  const [newSchedule, setNewSchedule] = useState("Du, Cho, Ju - 17:00");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<"assign" | "remove" | null>(null);
  const [leftDropActive, setLeftDropActive] = useState(false);
  const [rightDropActive, setRightDropActive] = useState(false);
  const [pendingGroupAction, setPendingGroupAction] = useState<GroupActionIntent | null>(null);
  const lastConfirmedGroupAction = useRef<GroupActionIntent | null>(null);
  const { data } = useQuery({
    queryKey: ["groups"],
    queryFn: mockApi.getGroups
  });
  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: mockApi.getTeachers
  });
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: mockApi.getCourses
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: mockApi.getStudents
  });

  const groups = data ?? [];
  const teacherList = teachers ?? [];
  const studentList = students ?? [];
  const courseOptions = courses?.map((item) => item.title) ?? defaultCourseOptions;
  const filtered = groups.filter((group) => {
    const matchesSearch = [group.name, group.course, group.teacher, group.room].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ? true : filter === "risk" ? group.unpaidStudents > 0 : group.unpaidStudents === 0;

    return matchesSearch && matchesFilter;
  });
  const selectedManageGroup = groups.find((group) => group.id === selectedManageGroupId) ?? groups[0];
  const selectedManageGroupStudents = useMemo(
    () => studentList.filter((student) => student.group === selectedManageGroup?.name),
    [selectedManageGroup?.name, studentList]
  );
  const availableStudents = useMemo(
    () =>
      studentList.filter((student) => {
        const matchesSearch = [student.fullName, student.group, student.course].join(" ").toLowerCase().includes(assignmentSearch.toLowerCase());
        return student.group !== selectedManageGroup?.name && matchesSearch;
      }),
    [assignmentSearch, selectedManageGroup?.name, studentList]
  );

  useEffect(() => {
    if (!selectedManageGroupId && groups.length) {
      setSelectedManageGroupId(groups[0].id);
    }
  }, [groups, selectedManageGroupId]);

  useEffect(() => {
    if (!newTeacherId && teacherList.length) {
      setNewTeacherId(teacherList[0].id);
    }
  }, [newTeacherId, teacherList]);

  useEffect(() => {
    if (!courseOptions.length) {
      return;
    }

    if (!courseOptions.includes(newGroupCourse)) {
      setNewGroupCourse(courseOptions[0]);
    }
  }, [courseOptions, newGroupCourse]);

  const createGroupMutation = useMutation({
    mutationFn: mockApi.createGroup,
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "teacher"] })
      ]);

      toast.success(response.message);
      setIsGroupModalOpen(false);
      setSelectedManageGroupId(response.groupId);
      setNewGroupName("");
      setNewGroupCourse(courseOptions[0] ?? defaultCourseOptions[0]);
      setNewRoom("D1 xona");
      setNewSchedule("Du, Cho, Ju - 17:00");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const canCreateGroup = Boolean(newGroupName.trim() && newTeacherId);

  const resetDragState = () => {
    setDraggedStudentId(null);
    setDragMode(null);
    setLeftDropActive(false);
    setRightDropActive(false);
  };

  const invalidateGroupManagementQueries = async () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["groups"] }),
      queryClient.invalidateQueries({ queryKey: ["students"] }),
      queryClient.invalidateQueries({ queryKey: ["student-detail"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "teacher"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "student"] })
    ]);

  const undoGroupAction = async (action: GroupActionIntent) => {
    if (action.mode === "assign") {
      if (action.fromGroup === "Biriktirilmagan") {
        await mockApi.unassignStudentFromGroup({
          studentId: action.studentId
        });
      } else {
        const previousGroup = groups.find((item) => item.name === action.fromGroup);

        if (!previousGroup) {
          throw new Error("Oldingi guruh topilmadi.");
        }

        await mockApi.assignStudentToGroup({
          studentId: action.studentId,
          groupId: previousGroup.id
        });
      }
    } else {
      const previousGroup = groups.find((item) => item.name === action.fromGroup);

      if (!previousGroup) {
        throw new Error("Oldingi guruh topilmadi.");
      }

      await mockApi.assignStudentToGroup({
        studentId: action.studentId,
        groupId: previousGroup.id
      });
    }

    await invalidateGroupManagementQueries();
    toast.success("Amal bekor qilindi.");
  };

  const showUndoToast = (message: string, action: GroupActionIntent) => {
    toast.success(message, {
      duration: 7000,
      action: {
        label: "Bekor qilish",
        onClick: () => {
          void undoGroupAction(action).catch((error: Error) => {
            toast.error(error.message);
          });
        }
      }
    });
  };

  const assignStudentMutation = useMutation({
    mutationFn: mockApi.assignStudentToGroup,
    onSuccess: async (response) => {
      await invalidateGroupManagementQueries();

      resetDragState();
      setPendingGroupAction(null);
      const actionSnapshot = lastConfirmedGroupAction.current;
      if (actionSnapshot) {
        showUndoToast(response.message, actionSnapshot);
      } else {
        toast.success(response.message);
      }
      lastConfirmedGroupAction.current = null;
    },
    onError: (error: Error) => {
      resetDragState();
      setPendingGroupAction(null);
      lastConfirmedGroupAction.current = null;
      toast.error(error.message);
    }
  });

  const unassignStudentMutation = useMutation({
    mutationFn: mockApi.unassignStudentFromGroup,
    onSuccess: async (response) => {
      await invalidateGroupManagementQueries();

      resetDragState();
      setPendingGroupAction(null);
      const actionSnapshot = lastConfirmedGroupAction.current;
      if (actionSnapshot) {
        showUndoToast(response.message, actionSnapshot);
      } else {
        toast.success(response.message);
      }
      lastConfirmedGroupAction.current = null;
    },
    onError: (error: Error) => {
      resetDragState();
      setPendingGroupAction(null);
      lastConfirmedGroupAction.current = null;
      toast.error(error.message);
    }
  });

  const requestAssignToSelectedGroup = (studentId: string) => {
    if (!selectedManageGroup) {
      toast.error("Avval guruh tanlang.");
      return;
    }

    const student = studentList.find((item) => item.id === studentId);

    if (!student) {
      toast.error("O'quvchi topilmadi.");
      return;
    }

    setPendingGroupAction({
      mode: "assign",
      studentId,
      studentName: student.fullName,
      fromGroup: student.group,
      toGroup: selectedManageGroup.name
    });
  };

  const requestRemoveFromSelectedGroup = (studentId: string) => {
    if (!selectedManageGroup) {
      toast.error("Avval guruh tanlang.");
      return;
    }

    const student = studentList.find((item) => item.id === studentId);

    if (!student) {
      toast.error("O'quvchi topilmadi.");
      return;
    }

    setPendingGroupAction({
      mode: "remove",
      studentId,
      studentName: student.fullName,
      fromGroup: selectedManageGroup.name
    });
  };

  const confirmGroupAction = () => {
    if (!pendingGroupAction || !selectedManageGroup) {
      return;
    }

    lastConfirmedGroupAction.current = pendingGroupAction;

    if (pendingGroupAction.mode === "assign") {
      assignStudentMutation.mutate({
        studentId: pendingGroupAction.studentId,
        groupId: selectedManageGroup.id,
        notifyStudent: true
      });
      return;
    }

    unassignStudentMutation.mutate({
      studentId: pendingGroupAction.studentId,
      groupId: selectedManageGroup.id,
      notifyStudent: true
    });
  };

  return (
    <section className="space-y-6">
      <PageHeader
        title="Guruhlar"
        description="Sig'im, jadval, to'lov qilmaganlar soni va o'qituvchi biriktirish holati."
        actions={
          <Button onClick={() => setIsGroupModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Yangi guruh
          </Button>
        }
      />
      <SummaryStrip>
        <StatsCard label="Jami guruhlar" value={String(groups.length)} tone="primary" />
        <StatsCard label="Barqaror guruhlar" value={String(groups.filter((item) => item.unpaidStudents === 0).length)} tone="success" />
        <StatsCard label="Xavfli guruhlar" value={String(groups.filter((item) => item.unpaidStudents > 0).length)} tone="danger" />
        <StatsCard label="Tanlangan guruh" value={selectedManageGroupStudents.length ? String(selectedManageGroupStudents.length) : "0"} tone="warning" />
      </SummaryStrip>
      <FilterBar
        aside={
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Barchasi", count: groups.length },
              { value: "risk", label: "Qarzdor guruhlar", count: groups.filter((item) => item.unpaidStudents > 0).length, tone: "danger" },
              { value: "stable", label: "Barqaror guruhlar", count: groups.filter((item) => item.unpaidStudents === 0).length, tone: "success" }
            ]}
          />
        }
      >
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder="Guruh nomi, kurs, o'qituvchi yoki xona bo'yicha qidiring..."
          quickFilterLabel="Xavfli guruhlar"
          onQuickFilter={() => setFilter("risk")}
        />
      </FilterBar>
      <div className="grid gap-6">
        <InfoPanel title="Guruhlar ro'yxati" description="Boshqarish uchun guruhni tanlang.">
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((group) => {
              const active = selectedManageGroup?.id === group.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedManageGroupId(group.id)}
                  className={cn(
                    "rounded-[24px] border p-4 text-left transition-all",
                    active
                      ? "border-primary/20 bg-primary/[0.05] shadow-[0_14px_28px_rgba(59,91,219,0.08)]"
                      : "border-border/80 bg-white hover:border-primary/20 hover:bg-slate-50 dark:bg-slate-950"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-lg font-bold">{group.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{group.course}</div>
                    </div>
                    <div className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600">
                      {group.unpaidStudents} ta
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="mini-note">{group.teacher}</div>
                    <div className="mini-note">{group.room}</div>
                  </div>
                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    {group.schedule}
                  </div>
                </button>
              );
            })}
          </div>
        </InfoPanel>
      </div>
      <AppModal
        open={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title="Yangi guruh yaratish"
        description="Guruh, kurs, xona va o'qituvchini tanlang. Guruh yaratilgach boshqaruv ro'yxatiga darrov tushadi."
        eyebrow="Group setup"
        size="xl"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setIsGroupModalOpen(false)} className="w-full sm:w-auto">
              Bekor qilish
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!canCreateGroup || createGroupMutation.isPending}
              loading={createGroupMutation.isPending}
              onClick={() =>
                createGroupMutation.mutate({
                  name: newGroupName,
                  course: newGroupCourse,
                  teacherId: newTeacherId,
                  room: newRoom,
                  schedule: newSchedule
                })
              }
            >
              {createGroupMutation.isPending ? "Yaratilmoqda..." : "Guruh yaratish"}
            </Button>
          </div>
        }
      >
        <div className="field-grid">
          <label>
            <span className="field-label">Guruh nomi</span>
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="Masalan: ENG-501"
              className="field-control"
            />
          </label>
          <label>
            <span className="field-label">Kurs</span>
            <select value={newGroupCourse} onChange={(event) => setNewGroupCourse(event.target.value)} className="field-control">
              {courseOptions.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">O'qituvchi</span>
            <select value={newTeacherId} onChange={(event) => setNewTeacherId(event.target.value)} className="field-control">
              {teacherList.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Xona</span>
            <input value={newRoom} onChange={(event) => setNewRoom(event.target.value)} className="field-control" />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Jadval</span>
            <select value={newSchedule} onChange={(event) => setNewSchedule(event.target.value)} className="field-control">
              {groupScheduleOptions.map((schedule) => (
                <option key={schedule} value={schedule}>
                  {schedule}
                </option>
              ))}
            </select>
          </label>
        </div>
      </AppModal>
      <InfoPanel
        title="Drag-drop biriktirish"
        description="Chapdan o'ngga tashlasangiz qo'shiladi, o'ngdan chapga qaytarsangiz guruhdan chiqariladi."
        action={selectedManageGroup ? <div className="topbar-pill">{selectedManageGroup.name}</div> : undefined}
      >
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div
            className={cn(
              "space-y-4 rounded-[28px] border-2 border-dashed p-4 transition-all",
              leftDropActive
                ? "border-amber-400 bg-amber-50/80 shadow-[0_18px_30px_rgba(245,158,11,0.08)] dark:bg-amber-950/20"
                : "border-transparent"
            )}
            onDragOver={(event) => {
              if (dragMode !== "remove") {
                return;
              }

              event.preventDefault();
              setLeftDropActive(true);
            }}
            onDragLeave={() => setLeftDropActive(false)}
            onDrop={(event) => {
              if (dragMode !== "remove") {
                return;
              }

              event.preventDefault();
              setLeftDropActive(false);
              const studentId = event.dataTransfer.getData("text/studentId") || draggedStudentId;

              if (studentId) {
                requestRemoveFromSelectedGroup(studentId);
              }
            }}
          >
            <SearchFilterBar value={assignmentSearch} onChange={setAssignmentSearch} placeholder="Biriktiriladigan studentni qidiring..." />
            <div className="flex items-center justify-between gap-3 rounded-[20px] border border-border/80 bg-white px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              <span>Erkin studentlar</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <MoveLeft size={14} />
                Shu tomonga tashlasangiz chiqariladi
              </span>
            </div>
            <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
              {availableStudents.length ? (
                availableStudents.map((student) => (
                  <div
                    key={student.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/studentId", student.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedStudentId(student.id);
                      setDragMode("assign");
                    }}
                    onDragEnd={() => {
                      resetDragState();
                    }}
                    className={cn(
                      "rounded-[22px] border border-border/80 bg-slate-50/80 p-4 transition-all dark:bg-slate-900/70",
                      draggedStudentId === student.id && "border-primary/30 bg-primary/[0.06]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-white text-slate-500 shadow-sm dark:bg-slate-950">
                            <GripVertical size={15} />
                          </div>
                          <div className="truncate font-semibold">{student.fullName}</div>
                        </div>
                        <div className="mt-2 text-sm text-slate-500">
                          Hozirgi guruh: {student.group} | Kurs: {student.course}
                        </div>
                      </div>
                      <StatusBadge status={student.paymentStatus} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">Drag qiling yoki tugma bilan biriktiring</div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={assignStudentMutation.isPending}
                        loading={assignStudentMutation.isPending}
                        onClick={() => requestAssignToSelectedGroup(student.id)}
                      >
                        <UserPlus size={15} />
                        Qo'shish
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-border px-4 py-10 text-center text-sm text-slate-500">
                  Bu guruhdan tashqarida mos student topilmadi.
                </div>
              )}
            </div>
          </div>
          <div
            onDragOver={(event) => {
              if (dragMode !== "assign") {
                return;
              }

              event.preventDefault();
              setRightDropActive(true);
            }}
            onDragLeave={() => setRightDropActive(false)}
            onDrop={(event) => {
              if (dragMode !== "assign") {
                return;
              }

              event.preventDefault();
              setRightDropActive(false);
              const studentId = event.dataTransfer.getData("text/studentId") || draggedStudentId;

              if (studentId) {
                requestAssignToSelectedGroup(studentId);
              }
            }}
            className={cn(
              "rounded-[28px] border-2 border-dashed p-5 transition-all",
              rightDropActive
                ? "border-primary bg-primary/[0.06] shadow-[0_18px_30px_rgba(59,91,219,0.08)]"
                : "border-border/80 bg-white dark:bg-slate-950"
            )}
          >
            {selectedManageGroup ? (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-display text-xl font-bold">{selectedManageGroup.name}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {selectedManageGroup.teacher} | {selectedManageGroup.schedule} | {selectedManageGroup.room}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/[0.08] px-3 py-1 text-xs font-semibold text-primary">
                    <MoveRight size={14} />
                    Shu yerga tashlang
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="mini-note">Studentlar: {selectedManageGroupStudents.length} ta</div>
                  <div className="mini-note">Qarzdorlar: {selectedManageGroup.unpaidStudents} ta</div>
                  <div className="mini-note">Xona: {selectedManageGroup.room}</div>
                </div>
                <div className="mt-5 space-y-3">
                  {selectedManageGroupStudents.length ? (
                    selectedManageGroupStudents.map((student) => (
                      <div
                        key={student.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/studentId", student.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggedStudentId(student.id);
                          setDragMode("remove");
                        }}
                        onDragEnd={() => {
                          resetDragState();
                        }}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-[20px] border border-border/80 bg-slate-50/80 px-4 py-3 transition-all dark:bg-slate-900/70",
                          draggedStudentId === student.id && dragMode === "remove" && "border-amber-400 bg-amber-50/80 dark:bg-amber-950/20"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-white text-slate-500 shadow-sm dark:bg-slate-950">
                              <GripVertical size={15} />
                            </div>
                            <div className="font-medium">{student.fullName}</div>
                          </div>
                          <div className="text-sm text-slate-500">
                            Davomat {student.attendancePercent}% | To'lov {student.paymentStatus === "paid" ? "to'langan" : "nazoratda"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={student.paymentStatus} />
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={unassignStudentMutation.isPending}
                            loading={unassignStudentMutation.isPending}
                            onClick={() => requestRemoveFromSelectedGroup(student.id)}
                          >
                            <UserMinus size={15} />
                            Chiqarish
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-border px-4 py-10 text-center text-sm text-slate-500">
                      Bu guruhga hali student tashlanmagan.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-[20px] border border-dashed border-border px-4 py-10 text-center text-sm text-slate-500">
                Avval guruh tanlang.
              </div>
            )}
          </div>
        </div>
      </InfoPanel>
      <ConfirmDialog
        open={Boolean(pendingGroupAction)}
        eyebrow={pendingGroupAction?.mode === "assign" ? "Guruhga qo'shish" : "Guruhdan chiqarish"}
        title={
          pendingGroupAction?.mode === "assign"
            ? "Haqiqatan ham o'quvchini guruhga qo'shmoqchimisiz?"
            : "Haqiqatan ham o'quvchini guruhdan chiqarmoqchimisiz?"
        }
        description={
          pendingGroupAction
            ? pendingGroupAction.mode === "assign"
              ? `${pendingGroupAction.studentName} hozir ${pendingGroupAction.fromGroup} guruhida. Uni ${pendingGroupAction.toGroup} guruhiga o'tkazish tasdiqlansinmi?`
              : `${pendingGroupAction.studentName} ${pendingGroupAction.fromGroup} guruhidan chiqariladi. Bu o'quvchi vaqtincha erkin ro'yxatga o'tadi.`
            : ""
        }
        confirmLabel={pendingGroupAction?.mode === "assign" ? "Ha, qo'shish" : "Ha, chiqarish"}
        confirmVariant={pendingGroupAction?.mode === "assign" ? "primary" : "danger"}
        cancelLabel="Yo'q, bekor qilish"
        onCancel={() => {
          setPendingGroupAction(null);
          resetDragState();
        }}
        onConfirm={confirmGroupAction}
      >
        {pendingGroupAction ? (
          <div className="rounded-[24px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-primary text-sm font-bold text-white shadow-[0_10px_20px_rgba(59,91,219,0.18)]">
                {pendingGroupAction.studentName
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="min-w-0">
                <div className="font-semibold">{pendingGroupAction.studentName}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {pendingGroupAction.mode === "assign" ? "Yangi guruhga o'tkaziladi" : "Guruhdan chiqariladi"}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="topbar-pill">{pendingGroupAction.fromGroup}</div>
              {pendingGroupAction.mode === "assign" ? (
                <>
                  <MoveRight size={14} className="text-slate-400" />
                  <div className="topbar-pill border-primary/20 bg-primary/10 text-primary">
                    {pendingGroupAction.toGroup}
                  </div>
                </>
              ) : (
                <>
                  <MoveLeft size={14} className="text-slate-400" />
                  <div className="topbar-pill border-amber-300/60 bg-amber-100/80 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300">
                    Erkin ro'yxat
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

export function AdminCoursesPage() {
  const queryClient = useQueryClient();
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [coursePrice, setCoursePrice] = useState("850000");
  const { data } = useQuery({
    queryKey: ["courses"],
    queryFn: mockApi.getCourses
  });

  const rows = data ?? [];
  const createCourseMutation = useMutation({
    mutationFn: mockApi.createCourse,
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["courses"] }),
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
      ]);

      toast.success(response.message);
      setIsCourseModalOpen(false);
      setCourseTitle("");
      setCoursePrice("850000");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const canCreateCourse = Boolean(courseTitle.trim() && Number(coursePrice) > 0);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Kurslar"
        description="Kurs katalogi, narxi va nechta guruhga bog'langani shu yerda boshqariladi."
        actions={
          <Button onClick={() => setIsCourseModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Yangi kurs
          </Button>
        }
      />
      <SummaryStrip>
        <StatsCard label="Jami kurslar" value={String(rows.length)} change="Faol katalog" tone="primary" />
        <StatsCard label="Faol guruhlar" value={String(rows.reduce((sum, item) => sum + item.groupCount, 0))} change="Barcha kurslar bo'yicha" tone="success" />
        <StatsCard label="Biriktirilgan o'quvchilar" value={String(rows.reduce((sum, item) => sum + item.studentCount, 0))} change="Kurslarga yozilganlar" tone="warning" />
      </SummaryStrip>
      <div className="grid gap-5 lg:grid-cols-2">
        {rows.map((course) => (
          <Card key={course.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-xl font-bold">{course.title}</div>
                <div className="mt-2 text-sm text-slate-500">Narxi: {course.price}</div>
              </div>
              <div className="topbar-pill">{course.groupCount} ta guruh</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="mini-note">{course.studentCount} ta o'quvchi biriktirilgan</div>
              <div className="mini-note">ID: {course.id}</div>
            </div>
          </Card>
        ))}
      </div>
      <AppModal
        open={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title="Yangi kurs qo'shish"
        description="Kurs nomi va narxini kiriting. Saqlangach u darrov backendga yoziladi va group/student formalarida ko'rinadi."
        eyebrow="Course setup"
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setIsCourseModalOpen(false)} className="w-full sm:w-auto">
              Bekor qilish
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!canCreateCourse || createCourseMutation.isPending}
              loading={createCourseMutation.isPending}
              onClick={() =>
                createCourseMutation.mutate({
                  title: courseTitle,
                  price: Number(coursePrice),
                })
              }
            >
              {createCourseMutation.isPending ? "Saqlanmoqda..." : "Kursni saqlash"}
            </Button>
          </div>
        }
      >
        <div className="field-grid">
          <label className="md:col-span-2">
            <span className="field-label">Kurs nomi</span>
            <input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} className="field-control" placeholder="Masalan: Frontend React Pro" />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Narxi</span>
            <input value={coursePrice} onChange={(event) => setCoursePrice(event.target.value)} className="field-control" type="number" min="0" placeholder="850000" />
          </label>
        </div>
      </AppModal>
    </section>
  );
}

export function AdminAttendancePage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const { data } = useQuery({
    queryKey: ["attendance"],
    queryFn: mockApi.getAttendance
  });

  const rows = data ?? [];
  const filtered = rows.filter((item) => {
    const matchesSearch = [item.studentName, item.group, item.comment ?? ""].join(" ").toLowerCase().includes(search.toLowerCase());
    return matchesSearch && matchesAttendanceFilter(item, filter);
  });

  return (
    <section className="space-y-6">
      <PageHeader
        title="Davomat"
        description="Kelgan, kelmagan, kechikkan va ogohlantirish holatlarini to'liq nazorat qilish oynasi."
        actions={
          <Button variant="secondary" onClick={() => toast.success("Bugungi xulosa yangilandi.")}>
            Bugungi xulosa
          </Button>
        }
      />
      <SummaryStrip>
        <StatsCard label="Bugungi yozuvlar" value={String(rows.filter((item) => item.date === TODAY).length)} change="Joriy sana bo'yicha" tone="primary" />
        <StatsCard label="Kelmaganlar" value={String(rows.filter((item) => item.date === TODAY && item.status === "absent").length)} change="Bugun" tone="danger" />
        <StatsCard label="Kechikkanlar" value={String(rows.filter((item) => item.date === TODAY && item.status === "late").length)} change="Bugun" tone="warning" />
        <StatsCard
          label="Ogohlantirishlar"
          value={String(rows.filter((item) => item.status === "not_prepared" || item.status === "homework_not_done").length)}
          change="Tayyor emas yoki vazifa qilmagan"
          tone="warning"
        />
      </SummaryStrip>
      <FilterBar
        aside={
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Barchasi", count: rows.length },
              { value: "today", label: "Bugun", count: rows.filter((item) => item.date === TODAY).length },
              { value: "present", label: "Kelganlar", count: rows.filter((item) => item.status === "present").length, tone: "success" },
              { value: "absent", label: "Kelmaganlar", count: rows.filter((item) => item.status === "absent").length, tone: "danger" },
              { value: "late", label: "Kechikkanlar", count: rows.filter((item) => item.status === "late").length, tone: "warning" },
              {
                value: "attention",
                label: "Ogohlantirishlar",
                count: rows.filter((item) => item.status === "not_prepared" || item.status === "homework_not_done").length,
                tone: "warning"
              }
            ]}
          />
        }
      >
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder="O'quvchi, guruh yoki izoh bo'yicha qidiring..."
          quickFilterLabel="Faqat bugungi yozuvlar"
          onQuickFilter={() => setFilter("today")}
        />
      </FilterBar>
      <div className="main-with-sidebar">
        <AttendanceTable rows={filtered} />
        <SidePanel title="Davomat nazorati" description="Rahbariyat uchun tezkor signal paneli.">
          <div className="space-y-3">
            <div className="mini-note">Bugungi yozuvlar: {rows.filter((item) => item.date === TODAY).length} ta</div>
            <div className="mini-note">Bugungi kelmaganlar: {rows.filter((item) => item.date === TODAY && item.status === "absent").length} ta</div>
            <div className="mini-note">Kechikishlar: {rows.filter((item) => item.status === "late").length} ta</div>
          </div>
          <TimelineList
            items={filtered.slice(0, 4).map((item) => ({
              id: item.id,
              title: item.studentName,
              description: `${item.group} | ${item.comment ?? "Izoh kiritilmagan"}`,
              meta: item.date,
              tone:
                item.status === "absent"
                  ? "danger"
                  : item.status === "late" || item.status === "not_prepared" || item.status === "homework_not_done"
                    ? "warning"
                    : "success"
            }))}
          />
        </SidePanel>
      </div>
    </section>
  );
}

export function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [paymentMonth, setPaymentMonth] = useState(TODAY.slice(0, 7));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Naqd");
  const [dueDate, setDueDate] = useState("2026-04-05");
  const [sendNotification, setSendNotification] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: mockApi.getStudents
  });
  const { data } = useQuery({
    queryKey: ["payments"],
    queryFn: mockApi.getPayments
  });

  const studentList = students ?? [];
  const rows = data ?? [];
  const paymentMonthLabel = formatPaymentMonthLabel(paymentMonth);
  const selectedStudent = studentList.find((item) => item.id === selectedStudentId);
  const selectedStudentPayments = rows.filter((item) => item.studentId === selectedStudentId || (!item.studentId && item.studentName === selectedStudent?.fullName));
  const currentMonthPayment = selectedStudentPayments.find((item) => item.month === paymentMonthLabel);
  const monthlyFeeValue = parseMoneyValue(selectedStudent?.monthlyFee);
  const alreadyPaidValue = parseMoneyValue(currentMonthPayment?.amount);
  const maxPayableAmount = currentMonthPayment ? parseMoneyValue(currentMonthPayment.remainingAmount) : monthlyFeeValue;
  const receivedAmountValue = Number(paymentAmount) || 0;
  const nextPaidValue = alreadyPaidValue + receivedAmountValue;
  const remainingAmountValue = Math.max(monthlyFeeValue - nextPaidValue, 0);
  const previewStatus = getPaymentStatusPreview(monthlyFeeValue, nextPaidValue, dueDate);
  const previewStatusNote = getPaymentStatusNotePreview(monthlyFeeValue, nextPaidValue, dueDate);
  const debtMonths = selectedStudentPayments.filter((item) => item.status !== "paid");
  const totalDebtValue = debtMonths.reduce((total, item) => total + parseMoneyValue(item.remainingAmount), 0);
  const isCurrentMonthPaid = currentMonthPayment?.status === "paid";
  const isOverpaying = maxPayableAmount > 0 && receivedAmountValue > maxPayableAmount;
  const filtered = rows.filter((item) => {
    const matchesSearch = [item.studentName, item.month, item.method].join(" ").toLowerCase().includes(search.toLowerCase());
    return matchesSearch && matchesPaymentFilter(item, filter);
  });

  useEffect(() => {
    if (!selectedStudentId && studentList.length) {
      setSelectedStudentId(studentList[0].id);
    }
  }, [selectedStudentId, studentList]);

  useEffect(() => {
    if (!paymentMonth) {
      return;
    }

    setDueDate(`${paymentMonth}-05`);
  }, [paymentMonth]);

  useEffect(() => {
    if (!selectedStudent) {
      return;
    }

    const defaultAmount = currentMonthPayment?.remainingAmount
      ? parseMoneyValue(currentMonthPayment.remainingAmount)
      : monthlyFeeValue;

    setPaymentAmount(defaultAmount > 0 && !isCurrentMonthPaid ? String(defaultAmount) : "");
  }, [currentMonthPayment?.remainingAmount, isCurrentMonthPaid, monthlyFeeValue, selectedStudent]);

  const paymentMutation = useMutation({
    mutationFn: mockApi.recordPayment,
    onSuccess: async (response: RecordPaymentResponse) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "teacher"] }),
        queryClient.invalidateQueries({ queryKey: ["student-detail"] })
      ]);

      toast.success(response.message);
      setPaymentReceipt(response.receipt ?? null);

      if (response.notificationSent) {
        toast.success("Ota-onaga to'lov bo'yicha xabar ham yuborildi.");
      }

      setSendNotification(false);
    }
  });

  return (
    <section className="space-y-6">
      <PageHeader
        title="To'lovlar"
        description="To'langan, qisman to'langan, to'lanmagan va muddati o'tgan yozuvlarni filtrlash va nazorat qilish."
        actions={<ExportButtons title="To'lovlar" students={studentList} />}
      />
      <SummaryStrip>
        <StatsCard label="Jami yozuvlar" value={String(rows.length)} change="To'lov jurnali" tone="primary" />
        <StatsCard label="To'langanlar" value={String(rows.filter((item) => item.status === "paid").length)} change="Yopilgan to'lovlar" tone="success" />
        <StatsCard label="Qisman" value={String(rows.filter((item) => item.status === "partial").length)} change="Qoldiq bor" tone="warning" />
        <StatsCard label="Muddati o'tgan" value={String(rows.filter((item) => item.status === "overdue").length)} change="Darhol nazorat kerak" tone="danger" />
      </SummaryStrip>
      <div className="main-with-sidebar">
        <InfoPanel title="To'lov qabul qilish" description="Tushgan summani kiriting. Holat va qoldiq avtomatik hisoblanadi.">
          <div className="field-grid">
            <label>
              <span className="field-label">O'quvchi</span>
              <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} className="field-control">
                {studentList.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName} - {student.group}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Oy</span>
              <input type="month" value={paymentMonth} onChange={(event) => setPaymentMonth(event.target.value)} className="field-control" />
              <div className="mt-2 text-xs text-slate-500">Tanlangan oy: {paymentMonthLabel}</div>
            </label>
            <label>
              <span className="field-label">Qabul qilingan summa</span>
              <input
                type="number"
                min="0"
                max={maxPayableAmount || undefined}
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                className="field-control"
                disabled={isCurrentMonthPaid}
              />
              <div className="mt-2 text-xs text-slate-500">
                {isCurrentMonthPaid
                  ? "Shu oy to'liq yopilgan."
                  : `Hozir ko'pi bilan ${maxPayableAmount.toLocaleString("uz-UZ")} so'm qabul qilinadi.`}
              </div>
            </label>
            <label>
              <span className="field-label">To'lov usuli</span>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="field-control" disabled={isCurrentMonthPaid}>
                <option value="Naqd">Naqd</option>
                <option value="Karta">Karta</option>
                <option value="Bank o'tkazmasi">Bank o'tkazmasi</option>
              </select>
            </label>
            <label>
              <span className="field-label">Muddat</span>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="field-control" disabled={isCurrentMonthPaid} />
            </label>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-[22px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Oylik</div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{selectedStudent?.monthlyFee ?? "0 so'm"}</div>
            </div>
            <div className="rounded-[22px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Oldin to'langan</div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{currentMonthPayment?.amount ?? "0 so'm"}</div>
            </div>
            <div className="rounded-[22px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Saqlangandan keyin</div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{nextPaidValue.toLocaleString("uz-UZ")} so'm</div>
            </div>
            <div className="rounded-[22px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Qolgan qarz</div>
              <div className="mt-2 text-lg font-semibold text-rose-600 dark:text-rose-300">{remainingAmountValue.toLocaleString("uz-UZ")} so'm</div>
            </div>
          </div>
          <div className="rounded-[22px] border border-primary/15 bg-primary/5 px-4 py-4 dark:bg-primary/10">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={previewStatus} />
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{previewStatusNote}</div>
            </div>
            <div className="mt-2 text-sm text-slate-500">
              {selectedStudent?.fullName ?? "O'quvchi tanlanmagan"} uchun {paymentMonthLabel} oyi bo'yicha jami {nextPaidValue.toLocaleString("uz-UZ")} so'm bo'ladi.
            </div>
            {isOverpaying ? <div className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-300">Orticha to'lov mumkin emas. Qolgan summa {maxPayableAmount.toLocaleString("uz-UZ")} so'm.</div> : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant={sendNotification ? "primary" : "secondary"} onClick={() => setSendNotification((value) => !value)}>
              {sendNotification ? "Xabar yuboriladi" : "Xabar yubormaslik"}
            </Button>
            <div className="text-sm text-slate-500">
              {sendNotification ? "To'lovdan so'ng ota-onaga ham eslatma logi yoziladi." : "Kerak bo'lsa ota-onaga eslatma yuborishingiz mumkin."}
            </div>
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={!selectedStudentId || receivedAmountValue <= 0 || paymentMutation.isPending || isCurrentMonthPaid || isOverpaying}
            loading={paymentMutation.isPending}
            onClick={() =>
              paymentMutation.mutate({
                studentId: selectedStudentId,
                month: paymentMonthLabel,
                amount: receivedAmountValue,
                dueDate,
                method: paymentMethod,
                sendNotification
              })
            }
          >
            {paymentMutation.isPending ? "Saqlanmoqda..." : isCurrentMonthPaid ? "Shu oy yopilgan" : "To'lovni saqlash"}
          </Button>
        </InfoPanel>
        <SidePanel title="Moliyaviy nazorat" description="Qarz oylar va qoldiq summa shu yerda aniq ko'rinadi.">
          <div className="space-y-3">
            <div className="mini-note">Jami qarz: {totalDebtValue.toLocaleString("uz-UZ")} so'm</div>
            <div className="mini-note">Qarz oylar soni: {debtMonths.length} ta</div>
            <div className="mini-note">Joriy oy holati: {previewStatusNote}</div>
          </div>
          <TimelineList
            items={(debtMonths.length ? debtMonths : rows.slice(0, 4)).map((payment) => ({
              id: payment.id,
              title: `${payment.studentName} - ${payment.month}`,
              description: `${payment.amount} tushgan | Qolgan ${payment.remainingAmount ?? "-"}`,
              meta: payment.statusNote ?? (payment.status === "paid" ? "To'langan" : "Nazorat"),
              tone: payment.status === "paid" ? "success" : payment.status === "partial" ? "warning" : "danger"
            }))}
          />
        </SidePanel>
      </div>
      <FilterBar
        aside={
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Barchasi", count: rows.length },
              { value: "paid", label: "To'langan", count: rows.filter((item) => item.status === "paid").length, tone: "success" },
              { value: "partial", label: "Qisman", count: rows.filter((item) => item.status === "partial").length, tone: "warning" },
              { value: "unpaid", label: "To'lanmagan", count: rows.filter((item) => item.status === "unpaid").length, tone: "danger" },
              { value: "overdue", label: "Muddati o'tgan", count: rows.filter((item) => item.status === "overdue").length, tone: "danger" }
            ]}
          />
        }
      >
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder="O'quvchi, oy yoki to'lov usuli bo'yicha qidiring..."
          quickFilterLabel="Faqat qarzdorlar"
          onQuickFilter={() => setFilter("overdue")}
        />
      </FilterBar>
      <PaymentTable rows={filtered} />
      <PaymentReceiptModal open={Boolean(paymentReceipt)} receipt={paymentReceipt} onClose={() => setPaymentReceipt(null)} />
    </section>
  );
}

export function AdminReportsPage() {
  const { data } = useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: () => mockApi.getDashboardMetrics("ADMIN")
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: mockApi.getStudents
  });
  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: mockApi.getPayments
  });

  const riskStudents = (students ?? []).filter((item) => item.attendancePercent < 80 || item.paymentStatus !== "paid");
  const paidCount = (payments ?? []).filter((item) => item.status === "paid").length;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Hisobotlar va tahlillar"
        description="Davomat, tushum, faollik va xavfli holatlarni rahbariyat uchun ko'rish."
        actions={<ExportButtons title="Hisobotlar va tahlillar" students={students ?? []} />}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Haftalik davomat" description="Umumiy ko'rsatkich yaxshi, ayrim kunlarda pasayish bor." data={data?.chart ?? []} />
        <ChartCard
          title="To'lovlar yig'ilishi"
          description="Oylar bo'yicha tushgan real summa shu yerda ko'rinadi."
          data={data?.paymentChart ?? data?.chart ?? []}
          valueFormatter={(value) => `${value.toLocaleString("uz-UZ")} so'm`}
          deltaFormatter={(value) =>
            value > 0
              ? `+${value.toLocaleString("uz-UZ")} so'm`
              : value < 0
                ? `${value.toLocaleString("uz-UZ")} so'm`
                : "O'zgarish yo'q"
          }
          averageFormatter={(selectedValue, averageValue) => {
            const gap = selectedValue - averageValue;

            return gap > 0
              ? `O'rtachadan ${gap.toLocaleString("uz-UZ")} so'm yuqori`
              : gap < 0
                ? `O'rtachadan ${Math.abs(gap).toLocaleString("uz-UZ")} so'm past`
                : "O'rtacha bilan teng";
          }}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-4">
          <div className="font-display text-xl font-bold">Qisqa xulosa</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-slate-900/50">
              <div className="text-xs text-slate-400">To'langan yozuvlar</div>
              <div className="mt-1 font-display text-3xl font-bold">{paidCount}</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-slate-900/50">
              <div className="text-xs text-slate-400">Xavfli o'quvchilar</div>
              <div className="mt-1 font-display text-3xl font-bold">{riskStudents.length}</div>
            </div>
          </div>
        </Card>
        <Card className="space-y-4">
          <div className="font-display text-xl font-bold">Eng ko'p nazorat talab qilayotganlar</div>
          <div className="space-y-3">
            {riskStudents.slice(0, 5).map((student) => (
              <div key={student.id} className="flex items-center justify-between rounded-2xl border border-border bg-white/70 px-4 py-3 dark:bg-slate-900/50">
                <div>
                  <div className="font-medium">{student.fullName}</div>
                  <div className="text-sm text-slate-500">
                    Davomat {student.attendancePercent}% | Guruh {student.group}
                  </div>
                </div>
                <StatusBadge status={student.paymentStatus} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

export function AdminNotificationsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: mockApi.getNotifications
  });

  const rows = data ?? [];
  const filtered = rows.filter((item) => {
    const matchesSearch = [item.studentName, item.template, item.recipient].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ? true : filter === "today" ? item.sentAt.startsWith(TODAY) : item.status === "sent";

    return matchesSearch && matchesFilter;
  });

  return (
    <section className="space-y-6">
      <PageHeader
        title="Xabarnomalar markazi"
        description="Telegram tarixi, shablonlar va ota-onalar bilan aloqa jurnali."
        actions={
          <Button variant="secondary" onClick={() => setFilter("today")}>
            Bugungi yuborishlar
          </Button>
        }
      />
      <SummaryStrip>
        <StatsCard label="Jami xabarlar" value={String(rows.length)} change="Aloqa jurnali" tone="primary" />
        <StatsCard label="Bugungi yuborishlar" value={String(rows.filter((item) => item.sentAt.startsWith(TODAY)).length)} change="Joriy sana" tone="success" />
        <StatsCard label="Muvaffaqiyatli" value={String(rows.filter((item) => item.status === "sent").length)} change="Yuborilgan" tone="success" />
        <StatsCard label="Xatoliklar" value={String(rows.filter((item) => item.status === "failed").length)} change="Qayta tekshirish kerak" tone="danger" />
      </SummaryStrip>
      <FilterBar
        aside={
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Barchasi", count: rows.length },
              { value: "today", label: "Bugun", count: rows.filter((item) => item.sentAt.startsWith(TODAY)).length },
              { value: "sent", label: "Yuborilgan", count: rows.filter((item) => item.status === "sent").length, tone: "success" }
            ]}
          />
        }
      >
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder="O'quvchi, shablon yoki qabul qiluvchi bo'yicha qidiring..."
          quickFilterLabel="Faqat bugungi xabarlar"
          onQuickFilter={() => setFilter("today")}
        />
      </FilterBar>
      <div className="main-with-sidebar">
        <DataTable
          description="Ota-onaga yuborilgan barcha xabarlar tarixi."
          rows={filtered}
          columns={[
            { key: "student", header: "O'quvchi", render: (row) => row.studentName },
            { key: "template", header: "Shablon", render: (row) => row.template },
            { key: "recipient", header: "Qabul qiluvchi", render: (row) => row.recipient },
            { key: "status", header: "Holat", render: (row) => <StatusBadge status={row.status} /> },
            { key: "sentAt", header: "Yuborilgan vaqt", render: (row) => row.sentAt }
          ]}
        />
        <SidePanel title="Aloqa bo'yicha xulosa" description="Ko'p ishlatilayotgan signal va yangi yozuvlar.">
          <div className="space-y-3">
            <div className="mini-note">Kelmaganlar xabari: {rows.filter((item) => item.template.toLowerCase().includes("kelmadi")).length} ta</div>
            <div className="mini-note">To'lov xabari: {rows.filter((item) => item.template.toLowerCase().includes("to'lov")).length} ta</div>
            <div className="mini-note">Bugungi qabul qiluvchilar: {rows.filter((item) => item.sentAt.startsWith(TODAY)).length} ta</div>
          </div>
          <TimelineList
            items={filtered.slice(0, 4).map((item) => ({
              id: item.id,
              title: item.studentName,
              description: item.template,
              meta: item.sentAt,
              tone: item.status === "failed" ? "danger" : "success"
            }))}
          />
        </SidePanel>
      </div>
    </section>
  );
}

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["telegram-settings"],
    queryFn: mockApi.getTelegramSettings
  });
  const [enabled, setEnabled] = useState(false);
  const [botUsername, setBotUsername] = useState("");
  const [botToken, setBotToken] = useState("");
  const [welcomeText, setWelcomeText] = useState("");
  const [welcomeImageUrl, setWelcomeImageUrl] = useState("");
  const [notificationImageUrl, setNotificationImageUrl] = useState("");
  const [attendanceTemplate, setAttendanceTemplate] = useState("");
  const [homeworkTemplate, setHomeworkTemplate] = useState("");
  const [paymentTemplate, setPaymentTemplate] = useState("");

  useEffect(() => {
    if (!data) {
      return;
    }

    setEnabled(data.enabled);
    setBotUsername(data.botUsername ?? "");
    setBotToken("");
    setWelcomeText(data.welcomeText);
    setWelcomeImageUrl(data.welcomeImageUrl ?? "");
    setNotificationImageUrl(data.notificationImageUrl ?? "");
    setAttendanceTemplate(data.attendanceTemplate);
    setHomeworkTemplate(data.homeworkTemplate);
    setPaymentTemplate(data.paymentTemplate);
  }, [data]);

  const settingsMutation = useMutation({
    mutationFn: mockApi.updateTelegramSettings,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["telegram-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["student-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
      await queryClient.refetchQueries({ queryKey: ["students"], type: "active" });
      toast.success("Telegram bot sozlamalari saqlandi.");
      setBotToken("");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const syncMutation = useMutation({
    mutationFn: mockApi.syncTelegramBot,
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["telegram-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["student-detail"] })
      ]);
      toast.success(`Sinxronlash tugadi. ${response.connected} ta ota-ona ulandi.`);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const welcomePreviewImage = resolveTelegramMediaUrl(welcomeImageUrl);
  const notificationPreviewImage = resolveTelegramMediaUrl(notificationImageUrl);
  const welcomePreviewText = renderTelegramTemplate(welcomeText);
  const attendancePreviewText = renderTelegramTemplate(attendanceTemplate);

  return (
    <section className="space-y-6">
      <PageHeader title="Sozlamalar" description="Telegram bot, ota-ona ulanishi va media shablonlari shu yerda boshqariladi." />
      <div className="main-with-sidebar">
        <div className="space-y-6">
          <InfoPanel title="Telegram bot markazi" description="Bot token, username va xabar media ko'rinishlarini saqlang.">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="field-label">Bot username</span>
                <input value={botUsername} onChange={(event) => setBotUsername(event.target.value)} className="field-control" placeholder="@kursboshqaruv_bot" />
              </label>
              <label>
                <span className="field-label">Bot token</span>
                <input value={botToken} onChange={(event) => setBotToken(event.target.value)} className="field-control" placeholder={data?.hasBotToken ? "Token saqlangan, yangilash uchun yangi token kiriting" : "<set-local-bot-token>"} />
              </label>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[26px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-950/60">
                <div className="field-label">Welcome rasmi</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {telegramImagePresets.map((preset) => {
                    const presetImage = resolveTelegramMediaUrl(preset.id);
                    const active = welcomeImageUrl === preset.id;
                    return (
                      <button
                        key={`welcome-${preset.id}`}
                        type="button"
                        onClick={() => setWelcomeImageUrl(preset.id)}
                        className={cn(
                          "overflow-hidden rounded-[22px] border text-left transition-all",
                          active ? "border-primary shadow-[0_16px_30px_rgba(59,91,219,0.16)]" : "border-border/80 hover:border-primary/30"
                        )}
                      >
                        <img src={presetImage} alt={preset.label} className="h-28 w-full object-cover" />
                        <div className="space-y-1 p-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{preset.label}</div>
                          <div className="text-xs text-slate-500">{preset.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <label className="mt-4 block">
                  <span className="field-label">Yoki o'z URLingiz</span>
                  <input value={welcomeImageUrl} onChange={(event) => setWelcomeImageUrl(event.target.value)} className="field-control" placeholder="https://..." />
                </label>
              </div>
              <div className="rounded-[26px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-950/60">
                <div className="field-label">Ogohlantirish rasmi</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {telegramImagePresets.map((preset) => {
                    const presetImage = resolveTelegramMediaUrl(preset.id);
                    const active = notificationImageUrl === preset.id;
                    return (
                      <button
                        key={`notification-${preset.id}`}
                        type="button"
                        onClick={() => setNotificationImageUrl(preset.id)}
                        className={cn(
                          "overflow-hidden rounded-[22px] border text-left transition-all",
                          active ? "border-primary shadow-[0_16px_30px_rgba(59,91,219,0.16)]" : "border-border/80 hover:border-primary/30"
                        )}
                      >
                        <img src={presetImage} alt={preset.label} className="h-28 w-full object-cover" />
                        <div className="space-y-1 p-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{preset.label}</div>
                          <div className="text-xs text-slate-500">{preset.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <label className="mt-4 block">
                  <span className="field-label">Yoki o'z URLingiz</span>
                  <input value={notificationImageUrl} onChange={(event) => setNotificationImageUrl(event.target.value)} className="field-control" placeholder="https://..." />
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant={enabled ? "success" : "secondary"} onClick={() => setEnabled((value) => !value)}>
                {enabled ? "Bot yoqilgan" : "Bot o'chirilgan"}
              </Button>
              <Button variant="secondary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} loading={syncMutation.isPending}>
                {syncMutation.isPending ? "Sinxronlash..." : "Ota-onani sinxronlash"}
              </Button>
              <div className="text-sm text-slate-500">
                {botUsername ? `Ulash linki ko'rinishi: https://t.me/${botUsername.replace(/^@/, "")}?start=parent_student-id` : "Username yozilgach ulash linki hosil bo'ladi."}
              </div>
            </div>
          </InfoPanel>
          <InfoPanel title="Telegram shablonlari" description="Davomat, uy vazifasi va to'lov uchun real caption matnlari.">
            <div className="mb-4 flex flex-wrap gap-2">
              {telegramPlaceholderHints.map((placeholder) => (
                <div key={placeholder} className="inline-flex rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1 text-[11px] font-semibold text-primary">
                  {placeholder}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <label>
                <span className="field-label">Welcome matni</span>
                <textarea value={welcomeText} onChange={(event) => setWelcomeText(event.target.value)} rows={4} className="field-control min-h-[110px]" />
              </label>
              <label>
                <span className="field-label">Davomat matni</span>
                <textarea value={attendanceTemplate} onChange={(event) => setAttendanceTemplate(event.target.value)} rows={4} className="field-control min-h-[110px]" />
              </label>
              <label>
                <span className="field-label">Uy vazifasi matni</span>
                <textarea value={homeworkTemplate} onChange={(event) => setHomeworkTemplate(event.target.value)} rows={4} className="field-control min-h-[110px]" />
              </label>
              <label>
                <span className="field-label">To'lov matni</span>
                <textarea value={paymentTemplate} onChange={(event) => setPaymentTemplate(event.target.value)} rows={4} className="field-control min-h-[110px]" />
              </label>
            </div>
            <Button
              onClick={() =>
                settingsMutation.mutate({
                  enabled,
                  botUsername,
                  botToken: botToken || undefined,
                  welcomeText,
                  welcomeImageUrl: welcomeImageUrl || undefined,
                  notificationImageUrl: notificationImageUrl || undefined,
                  attendanceTemplate,
                  homeworkTemplate,
                  paymentTemplate
                })
              }
              disabled={settingsMutation.isPending}
              loading={settingsMutation.isPending}
            >
              {settingsMutation.isPending ? "Saqlanmoqda..." : "Telegram sozlamalarini saqlash"}
            </Button>
          </InfoPanel>
        </div>
        <SidePanel title="Preview" description="Telegramda xabar qanday ko'rinishini shu yerda ko'rasiz.">
          <div className="space-y-4">
            {welcomePreviewImage ? (
              <div className="overflow-hidden rounded-[24px] border border-border/80 bg-slate-950/90">
                <img src={welcomePreviewImage} alt="Telegram welcome preview" className="h-40 w-full object-cover" />
              </div>
            ) : null}
            <div className="rounded-[28px] border border-emerald-200/60 bg-[linear-gradient(180deg,#ecfeff,#ffffff)] p-4 dark:border-emerald-900/40 dark:bg-[linear-gradient(180deg,#0f172a,#020617)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">Welcome preview</div>
              <div className="mt-3 rounded-[22px] bg-white/92 p-4 text-sm leading-6 text-slate-700 shadow-sm dark:bg-slate-950/70 dark:text-slate-200">
                <div className="whitespace-pre-wrap">{welcomePreviewText}</div>
              </div>
            </div>
            {notificationPreviewImage ? (
              <div className="overflow-hidden rounded-[24px] border border-border/80 bg-slate-950/90">
                <img src={notificationPreviewImage} alt="Telegram notification preview" className="h-44 w-full object-cover" />
              </div>
            ) : null}
            <div className="rounded-[28px] border border-sky-200/60 bg-[linear-gradient(180deg,#eff6ff,#ffffff)] p-4 dark:border-sky-900/40 dark:bg-[linear-gradient(180deg,#0f172a,#020617)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-500">Telegram caption</div>
              <div className="mt-3 space-y-3 rounded-[22px] bg-white/90 p-4 text-sm leading-6 text-slate-700 shadow-sm dark:bg-slate-950/70 dark:text-slate-200">
                <div className="whitespace-pre-wrap">{attendancePreviewText}</div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-100/80 p-2.5 shadow-inner dark:border-slate-800 dark:bg-slate-950/90">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Keyboard preview</div>
                  <div className="space-y-2">
                    {telegramKeyboardButtons.map((row, rowIndex) => (
                      <div key={`admin-keyboard-row-${rowIndex}`} className="grid grid-cols-2 gap-2">
                        {row.map((label) => (
                          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            {label}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidePanel>
      </div>
    </section>
  );
}
