import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, Check, CheckCheck, ChevronDown, Send, X } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth-service";
import { AttendanceNotes } from "@/components/common/AttendanceNotes";
import { mockApi } from "@/services/mock-api";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { FilterChips } from "@/components/common/FilterChips";
import { AvatarUpload } from "@/components/forms/AvatarUpload";
import { NotificationModal } from "@/components/common/NotificationModal";
import { SearchFilterBar } from "@/components/common/SearchFilterBar";
import { StatusBadge } from "@/components/common/StatusBadge";
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
import { getTodayIso } from "@/lib/date";
import type { AttendanceEntry, NotificationEntry } from "@/types/domain";

type TeacherAttendanceFilter = "all" | "today" | "present" | "absent" | "late" | "attention";
type TeacherGroupFilter = "all" | "risk" | "stable";
type TeacherNotificationFilter = "all" | "today" | "sent";

const TODAY = getTodayIso();
const homeworkScoreOptions = [0, 25, 50, 75, 100] as const;
const dailyGradeOptions = [1, 2, 3, 4, 5] as const;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi."));
    reader.readAsDataURL(file);
  });
}

const lessonTopicsByCourse: Record<string, string[]> = {
  "Ingliz tili asoslari": [
    "Tanishtiruv va salomlashuv",
    "Present Simple asoslari",
    "Oila va kundalik ishlar",
    "Savol tuzish mashqi",
    "Lug'at va reading mashqi",
    "Past Simple kirish",
    "Speaking juftlik mashqi",
    "Takrorlash va mini test"
  ],
  "Matematika tezkor kursi": [
    "Kasrlar bilan amallar",
    "Tenglamalar yechish",
    "Foiz va nisbat",
    "Geometriya asoslari",
    "Ifodalarni soddalashtirish",
    "Funksiya kirish darsi",
    "Aralash masalalar",
    "Takrorlash va nazorat"
  ],
  "IELTS intensiv": [
    "Reading skimming usuli",
    "Listening signal words",
    "Writing task 1 tuzilmasi",
    "Writing task 2 argument",
    "Speaking part 1 practice",
    "Speaking part 2 flow",
    "Vocabulary booster",
    "Mock test tahlili"
  ]
};
const fallbackLessonTopics = [
  "Asosiy mavzu",
  "Amaliy mashq",
  "Takrorlash darsi",
  "Nazorat darsi"
] as const;

type AttendanceDraft = {
  status: AttendanceEntry["status"];
  comment: string;
  sendNotification: boolean;
  homeworkScore: number | null;
  homeworkComment: string;
  dailyGrade: number | null;
  dailyGradeComment: string;
};

function areDraftsEqual(
  left: Record<string, AttendanceDraft>,
  right: Record<string, AttendanceDraft>
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftItem = left[key];
    const rightItem = right[key];

    return (
      rightItem &&
      leftItem.status === rightItem.status &&
      leftItem.comment === rightItem.comment &&
      leftItem.sendNotification === rightItem.sendNotification &&
      leftItem.homeworkScore === rightItem.homeworkScore &&
      leftItem.homeworkComment === rightItem.homeworkComment &&
      leftItem.dailyGrade === rightItem.dailyGrade &&
      leftItem.dailyGradeComment === rightItem.dailyGradeComment
    );
  });
}

function SectionHeader({
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
      eyebrow="O'qituvchi maydoni"
      title={title}
      description={description}
      action={actions}
      metaTitle="Dars nazorati"
      metaDescription="Davomat, guruhlar va ota-ona bilan aloqa uchun toza ish maydoni."
      breadcrumbs={["Boshqaruv", "O'qituvchi", title]}
    />
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

function matchesTeacherAttendanceFilter(item: AttendanceEntry, filter: TeacherAttendanceFilter) {
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
    return item.status === "not_prepared" || item.status === "homework_not_done" || isHomeworkAttention(item.homeworkScore);
  }

  return true;
}

function formatUzbekDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("uz-UZ", options).format(new Date(`${value}T12:00:00`));
}

function formatAttendanceLongDate(value: string) {
  return formatUzbekDate(value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatAttendanceShortDate(value: string) {
  return formatUzbekDate(value, {
    day: "2-digit",
    month: "short"
  });
}

function getStudentInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getMatrixAttendanceValue(status: AttendanceEntry["status"]) {
  return status === "absent" ? "absent" : "present";
}

function isHomeworkAttention(score?: number | null) {
  return typeof score === "number" && score < 60;
}

function buildStatusFromMatrix(attendance: "present" | "absent"): AttendanceEntry["status"] {
  return attendance === "absent" ? "absent" : "present";
}

function getHomeworkScoreTone(score?: number | null) {
  if (typeof score !== "number") {
    return "muted";
  }

  if (score >= 80) {
    return "success";
  }

  if (score >= 60) {
    return "warning";
  }

  return "danger";
}

function formatHomeworkScore(score?: number | null) {
  return typeof score === "number" ? `${score}%` : "Baholanmagan";
}

function getDailyGradeTone(grade?: number | null) {
  if (typeof grade !== "number") {
    return "muted";
  }

  if (grade >= 5) {
    return "success";
  }

  if (grade >= 4) {
    return "warning";
  }

  return "danger";
}

function formatDailyGrade(grade?: number | null) {
  return typeof grade === "number" ? `${grade} baho` : "Baholanmagan";
}

function getLessonTopic(course: string | undefined, lessonIndex: number) {
  const topics = course ? lessonTopicsByCourse[course] : undefined;
  const source = topics?.length ? topics : fallbackLessonTopics;

  return source[lessonIndex % source.length];
}

export function TeacherDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user)!;
  const { data } = useQuery({
    queryKey: ["dashboard", "teacher"],
    queryFn: () => mockApi.getDashboardMetrics("TEACHER")
  });
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: mockApi.getGroups
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: mockApi.getStudents
  });
  const { data: attendance } = useQuery({
    queryKey: ["attendance"],
    queryFn: mockApi.getAttendance
  });
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: mockApi.getNotifications
  });

  const ownGroups = (groups ?? []).filter((group) => group.teacher === user.fullName);
  const ownGroupNames = ownGroups.map((group) => group.name);
  const ownStudents = (students ?? []).filter((student) => ownGroupNames.includes(student.group));
  const ownAttendanceToday = (attendance ?? []).filter((item) => item.date === TODAY && ownGroupNames.includes(item.group));

  return (
    <section className="space-y-6">
      <SectionHeader
        title="O'qituvchi paneli"
        description="Bugungi darslar, o'z guruhlari bo'yicha xavfli holatlar va tezkor davomat amallari."
        actions={
          <Button onClick={() => navigate("/teacher/notifications")}>
            <Send size={16} className="mr-2" />
            Xabarlar tarixi
          </Button>
        }
      />
      <SummaryStrip>
        {data?.metrics.map((metric) => <StatsCard key={metric.label} {...metric} />)}
      </SummaryStrip>
      <div className="dashboard-main-grid">
        <div className="space-y-6">
          <ChartCard title="Shaxsiy davomat ko'rsatkichi" description="O'z guruhlaringiz bo'yicha so'nggi kunlardagi qatnashish foizi." data={data?.chart ?? []} />
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <InfoPanel title="Bugungi holatlar" description="Bugungi darslar kesimida qisqa ko'rinish.">
              <div className="space-y-3">
                {[
                  ["Bugungi guruhlar", `${ownGroups.length} ta guruh nazoratda`],
                  ["Bugun kelmaganlar", `${ownAttendanceToday.filter((item) => item.status === "absent").length} nafar o'quvchi`],
                  ["Ogohlantirishlar", `${ownAttendanceToday.filter((item) => isHomeworkAttention(item.homeworkScore) || item.status === "not_prepared" || item.status === "homework_not_done").length} ta holat`],
                  ["Qarzdor o'quvchilar", `${ownStudents.filter((item) => item.paymentStatus !== "paid").length} nafar`]
                ].map(([title, description]) => (
                  <div key={title} className="rounded-2xl border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                    <div className="font-medium">{title}</div>
                    <div className="mt-1 text-sm text-slate-500">{description}</div>
                  </div>
                ))}
              </div>
            </InfoPanel>
            <InfoPanel title="So'nggi xabarlar" description="Ota-onaga yuborilgan oxirgi xabarlar.">
              <div className="space-y-3">
                {(notifications ?? [])
                  .filter((item) => ownStudents.some((student) => student.fullName === item.studentName))
                  .slice(0, 4)
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">
                      <div>
                        <div className="font-medium">{item.studentName}</div>
                        <div className="text-sm text-slate-500">{item.template}</div>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
              </div>
            </InfoPanel>
          </div>
        </div>
        <SidePanel title="Tezkor amallar" description="Asosiy ishlarni 1-2 qadamda bajarish uchun.">
          <div className="space-y-3">
            {[
              { label: "Davomat olish", onClick: () => navigate("/teacher/attendance/workspace") },
              { label: "Guruhlarimni ochish", onClick: () => navigate("/teacher/groups") },
              { label: "Qarzdorlarni ko'rish", onClick: () => toast.success("Guruh kartalarida qarzdorlar soni ko'rsatilgan.") },
              { label: "Ota-onaga xabar tarixi", onClick: () => navigate("/teacher/notifications") }
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 text-left text-sm font-medium transition hover:border-primary/30 dark:bg-slate-900/70"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="rounded-[24px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent timeline</div>
            <div className="mt-3">
              <TimelineList
                items={(notifications ?? [])
                  .filter((item) => ownStudents.some((student) => student.fullName === item.studentName))
                  .slice(0, 4)
                  .map((item) => ({
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

export function TeacherGroupsPage() {
  const user = useAuthStore((state) => state.user)!;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TeacherGroupFilter>("all");
  const { data } = useQuery({
    queryKey: ["groups"],
    queryFn: mockApi.getGroups
  });

  const groups = (data ?? []).filter((group) => group.teacher === user.fullName);
  const filtered = groups.filter((group) => {
    const matchesSearch = [group.name, group.course, group.room, group.schedule].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ? true : filter === "risk" ? group.unpaidStudents > 0 : group.unpaidStudents === 0;

    return matchesSearch && matchesFilter;
  });

  return (
    <section className="space-y-6">
      <SectionHeader title="Mening guruhlarim" description="Biriktirilgan guruhlar, to'lov holati va keyingi darslar." />
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
          placeholder="Guruh, kurs yoki xona bo'yicha qidiring..."
          quickFilterLabel="Faqat qarzdor guruhlar"
          onQuickFilter={() => setFilter("risk")}
        />
      </FilterBar>
      <div className="grid gap-5 xl:grid-cols-2">
        {filtered.map((group) => (
          <Card key={group.id} className="space-y-4 rounded-[26px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Guruh</div>
                <div className="mt-2 font-display text-xl font-bold">{group.name}</div>
                <div className="text-sm text-slate-500">{group.course}</div>
              </div>
              <StatusBadge status={group.unpaidStudents > 0 ? "overdue" : "paid"} />
            </div>
            <div className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 text-sm dark:bg-slate-900/70">{group.schedule}</div>
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">O'quvchilar: {group.students}</div>
              <div className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">Xona: {group.room}</div>
              <div className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">O'qituvchi: {group.teacher}</div>
            </div>
            <div className="text-sm text-slate-500">{group.unpaidStudents} nafar to'lov nazoratida.</div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function TeacherAttendancePage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((state) => state.user)!;
  const queryClient = useQueryClient();
  const isWorkspaceRoute = pathname.endsWith("/attendance/workspace");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TeacherAttendanceFilter>("all");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const selectedDate = TODAY;
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});
  const [lessonTopicInput, setLessonTopicInput] = useState("");
  const [homeworkTitleInput, setHomeworkTitleInput] = useState("");
  const [homeworkDueDate, setHomeworkDueDate] = useState(TODAY);
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: mockApi.getGroups
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: mockApi.getStudents
  });
  const { data } = useQuery({
    queryKey: ["attendance"],
    queryFn: mockApi.getAttendance
  });

  const ownGroups = useMemo(
    () => (groups ?? []).filter((group) => group.teacher === user.fullName),
    [groups, user.fullName]
  );
  const ownGroupNames = useMemo(() => ownGroups.map((group) => group.name), [ownGroups]);
  const ownStudents = useMemo(
    () => (students ?? []).filter((student) => ownGroupNames.includes(student.group)),
    [students, ownGroupNames]
  );
  const rows = useMemo(
    () => (data ?? []).filter((item) => ownGroupNames.includes(item.group)),
    [data, ownGroupNames]
  );
  const filtered = useMemo(
    () =>
      rows.filter((item) => {
        const matchesSearch = [item.studentName, item.group, item.lessonTopic ?? "", item.comment ?? ""].join(" ").toLowerCase().includes(search.toLowerCase());
        return matchesSearch && matchesTeacherAttendanceFilter(item, filter);
      }),
    [filter, rows, search]
  );
  const selectedGroup = useMemo(
    () => ownGroups.find((group) => group.id === selectedGroupId) ?? ownGroups[0],
    [ownGroups, selectedGroupId]
  );
  const selectedGroupStudents = useMemo(
    () => ownStudents.filter((student) => student.group === selectedGroup?.name),
    [ownStudents, selectedGroup?.name]
  );
  const lockedRows = useMemo(
    () => rows.filter((item) => item.group === selectedGroup?.name && item.date === selectedDate),
    [rows, selectedDate, selectedGroup?.name]
  );
  const isLocked = lockedRows.length > 0;
  const selectedGroupRows = useMemo(
    () => rows.filter((item) => item.group === selectedGroup?.name),
    [rows, selectedGroup?.name]
  );
  const selectedDateLabel = useMemo(() => formatAttendanceLongDate(selectedDate), [selectedDate]);
  const lessonDatesForGroup = useMemo(() => {
    const uniqueDates = Array.from(new Set([...selectedGroupRows.map((item) => item.date), selectedDate])).sort((left, right) =>
      left.localeCompare(right)
    );

    return uniqueDates.length ? uniqueDates : [selectedDate];
  }, [selectedDate, selectedGroupRows]);
  const selectedLessonIndex = Math.max(lessonDatesForGroup.indexOf(selectedDate), 0);
  const selectedSuggestedLessonTopic = getLessonTopic(selectedGroup?.course, selectedLessonIndex);
  const lessonRowLookup = useMemo(() => {
    return new Map(selectedGroupRows.map((item) => [`${item.studentName}::${item.date}`, item]));
  }, [selectedGroupRows]);

  useEffect(() => {
    if (!selectedGroupId && ownGroups.length) {
      setSelectedGroupId(ownGroups[0].id);
    }
  }, [ownGroups, selectedGroupId]);

  useEffect(() => {
    if (isLocked) {
      setLessonTopicInput(lockedRows[0]?.lessonTopic ?? selectedSuggestedLessonTopic);
      return;
    }

    setLessonTopicInput(selectedSuggestedLessonTopic);
    setHomeworkTitleInput("");
    setHomeworkDueDate(selectedDate);
  }, [isLocked, lockedRows, selectedDate, selectedSuggestedLessonTopic, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupStudents.length) {
      setDrafts((current) => (Object.keys(current).length ? {} : current));
      return;
    }

    if (isLocked) {
      const nextDrafts = lockedRows.reduce<typeof drafts>((acc, item) => {
        const student = selectedGroupStudents.find((entry) => entry.fullName === item.studentName);

        if (student) {
          acc[student.id] = {
            status: item.status,
            comment: item.comment ?? "",
            sendNotification: false,
            homeworkScore: item.homeworkScore ?? null,
            homeworkComment: item.homeworkComment ?? "",
            dailyGrade: item.dailyGrade ?? null,
            dailyGradeComment: item.dailyGradeComment ?? ""
          };
        }

        return acc;
      }, {});

      setDrafts((current) => (areDraftsEqual(current, nextDrafts) ? current : nextDrafts));
      return;
    }

    setDrafts((current) => {
      const nextDrafts = selectedGroupStudents.reduce<typeof drafts>((acc, student) => {
        acc[student.id] = current[student.id] ?? {
          status: "present",
          comment: "",
          sendNotification: false,
          homeworkScore: null,
          homeworkComment: "",
          dailyGrade: null,
          dailyGradeComment: ""
        };
        return acc;
      }, {});

      return areDraftsEqual(current, nextDrafts) ? current : nextDrafts;
    });
  }, [isLocked, lockedRows, selectedGroupStudents]);

  const attendanceMutation = useMutation({
    mutationFn: mockApi.markGroupAttendance,
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "teacher"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] }),
        queryClient.invalidateQueries({ queryKey: ["student-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-student"] })
      ]);

      toast.success(response.message);
    }
  });
  const homeworkMutation = useMutation({
    mutationFn: mockApi.saveAttendanceHomework,
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "teacher"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] }),
        queryClient.invalidateQueries({ queryKey: ["student-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-student"] })
      ]);

      toast.success(response.message);
    }
  });
  const dailyGradeMutation = useMutation({
    mutationFn: mockApi.saveAttendanceDailyGrade,
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "teacher"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] }),
        queryClient.invalidateQueries({ queryKey: ["student-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-student"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] })
      ]);

      toast.success(response.message);
    }
  });

  function updateStudentDraft(
    studentId: string,
    patch: Partial<AttendanceDraft>
  ) {
    setDrafts((current) => {
      const existing = current[studentId] ?? {
        status: "present" as AttendanceEntry["status"],
        comment: "",
        sendNotification: false,
        homeworkScore: null,
        homeworkComment: "",
        dailyGrade: null,
        dailyGradeComment: ""
      };

      return {
        ...current,
        [studentId]: {
          ...existing,
          ...patch
        }
      };
    });
  }

  function updateLessonAttendance(studentId: string, attendance: "present" | "absent") {
    if (isLocked) {
      return;
    }

    updateStudentDraft(studentId, {
      status: buildStatusFromMatrix(attendance),
      homeworkScore: attendance === "absent" ? 0 : null,
      homeworkComment: attendance === "absent" ? "" : undefined,
      dailyGrade: attendance === "absent" ? null : null,
      dailyGradeComment: attendance === "absent" ? "" : undefined
    });
  }

  function updateLessonHomework(studentId: string, homeworkScore: number) {
    if (!isLocked) {
      return;
    }

    updateStudentDraft(studentId, { homeworkScore });
  }

  function updateLessonHomeworkComment(studentId: string, homeworkComment: string) {
    if (!isLocked) {
      return;
    }

    updateStudentDraft(studentId, { homeworkComment });
  }

  function updateLessonDailyGrade(studentId: string, dailyGrade: number) {
    if (!isLocked) {
      return;
    }

    updateStudentDraft(studentId, { dailyGrade });
  }

  function updateLessonDailyGradeComment(studentId: string, dailyGradeComment: string) {
    if (!isLocked) {
      return;
    }

    updateStudentDraft(studentId, { dailyGradeComment });
  }

  function saveAttendance() {
    if (!selectedGroupId || isLocked || attendanceMutation.isPending || !selectedGroupStudents.length) {
      return;
    }

    attendanceMutation.mutate({
      groupId: selectedGroupId,
      date: selectedDate,
      lessonTopic: lessonTopicInput.trim() || selectedSuggestedLessonTopic,
      homeworkTitle: homeworkTitleInput.trim() || undefined,
      homeworkDueDate: homeworkTitleInput.trim() ? homeworkDueDate : undefined,
      entries: selectedGroupStudents.map((student) => ({
        studentId: student.id,
        status: drafts[student.id]?.status ?? "present",
        comment: drafts[student.id]?.comment ?? "",
        sendNotification: drafts[student.id]?.sendNotification ?? false
      }))
    });
  }

  const pendingHomeworkEntries = useMemo(
    () =>
      selectedGroupStudents
        .map((student) => {
          const savedRow = lessonRowLookup.get(`${student.fullName}::${selectedDate}`);
          const draft = drafts[student.id];

          if (!savedRow || savedRow.homeworkScore !== null && savedRow.homeworkScore !== undefined) {
            return null;
          }

          if (!draft || draft.homeworkScore === null || draft.homeworkScore === undefined) {
            return null;
          }

          return {
            studentId: student.id,
            homeworkScore: draft.homeworkScore,
            homeworkComment: draft.homeworkComment.trim() || undefined
          };
        })
        .filter(Boolean) as Array<{ studentId: string; homeworkScore: number; homeworkComment?: string }>,
    [drafts, lessonRowLookup, selectedDate, selectedGroupStudents]
  );

  const pendingDailyGradeEntries = useMemo(
    () =>
      selectedGroupStudents
        .map((student) => {
          const savedRow = lessonRowLookup.get(`${student.fullName}::${selectedDate}`);
          const draft = drafts[student.id];

          if (!savedRow || (savedRow.dailyGrade !== null && savedRow.dailyGrade !== undefined) || savedRow.status === "absent") {
            return null;
          }

          if (!draft || draft.dailyGrade === null || draft.dailyGrade === undefined) {
            return null;
          }

          return {
            studentId: student.id,
            dailyGrade: draft.dailyGrade,
            dailyGradeComment: draft.dailyGradeComment.trim() || undefined
          };
        })
        .filter(Boolean) as Array<{ studentId: string; dailyGrade: number; dailyGradeComment?: string }>,
    [drafts, lessonRowLookup, selectedDate, selectedGroupStudents]
  );

  function saveHomeworkScores() {
    if (!selectedGroupId || !isLocked || !pendingHomeworkEntries.length || homeworkMutation.isPending) {
      return;
    }

    homeworkMutation.mutate({
      groupId: selectedGroupId,
      date: selectedDate,
      entries: pendingHomeworkEntries
    });
  }

  function saveDailyGrades() {
    if (!selectedGroupId || !isLocked || !pendingDailyGradeEntries.length || dailyGradeMutation.isPending) {
      return;
    }

    dailyGradeMutation.mutate({
      groupId: selectedGroupId,
      date: selectedDate,
      entries: pendingDailyGradeEntries
    });
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        title={isWorkspaceRoute ? "Davomat olish" : "Davomat arxivi"}
        description={
          isWorkspaceRoute
            ? "Faqat guruhni tanlang va bugungi davomatni belgilang."
            : "Saqlangan davomatlar ro'yxati."
        }
        actions={
          isWorkspaceRoute ? (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/teacher/attendance")}
              >
                Orqaga
              </Button>
              <Button
                variant={isLocked ? "secondary" : "success"}
                onClick={saveAttendance}
                disabled={!selectedGroupId || isLocked || attendanceMutation.isPending || !selectedGroupStudents.length}
                loading={attendanceMutation.isPending}
              >
                <CheckCheck size={16} className="mr-2" />
                {attendanceMutation.isPending ? "Saqlanmoqda..." : isLocked ? "Saqlangan" : "Saqlash"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/teacher/attendance/workspace")}
            >
              Davomat olish
            </Button>
          )
        }
      />
      {isWorkspaceRoute ? (
        <div className="space-y-6">
          <Card className="rounded-[28px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/60 sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-end">
              <label>
                <span className="field-label">Guruh</span>
                <div className="premium-field">
                  <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)} className="field-control field-control--select">
                    {ownGroups.length ? (
                      ownGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} - {group.course}
                        </option>
                      ))
                    ) : (
                      <option value="">Guruh topilmadi</option>
                    )}
                  </select>
                  <span className="premium-field__icon">
                    <ChevronDown size={16} />
                  </span>
                </div>
              </label>
              <div className="rounded-[22px] border border-border/80 bg-white/90 px-4 py-3 dark:bg-slate-950/80">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                    <CalendarDays size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Bugun</div>
                    <div className="mt-1 truncate font-semibold text-slate-950 dark:text-white">{selectedDateLabel}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <label className="lg:col-span-1">
                <span className="field-label">Dars mavzusi</span>
                <input
                  value={lessonTopicInput}
                  onChange={(event) => setLessonTopicInput(event.target.value)}
                  disabled={isLocked}
                  placeholder="Bugungi mavzuni yozing..."
                  className="field-control"
                />
              </label>
              <label className="lg:col-span-1">
                <span className="field-label">Uy vazifasi</span>
                <input
                  value={homeworkTitleInput}
                  onChange={(event) => setHomeworkTitleInput(event.target.value)}
                  disabled={isLocked}
                  placeholder="Uyga vazifa nomi"
                  className="field-control"
                />
              </label>
              <label className="lg:col-span-1">
                <span className="field-label">Vazifa muddati</span>
                <input
                  type="date"
                  value={homeworkDueDate}
                  onChange={(event) => setHomeworkDueDate(event.target.value)}
                  disabled={isLocked}
                  className="field-control"
                />
              </label>
            </div>
          </Card>
          {selectedGroupStudents.length ? (
            <div className="space-y-4">
              <div className="lesson-journal__table-shell">
                <div className="lesson-journal__table-scroll">
                  <div className="lesson-journal__table-inner">
                    <table className="lesson-journal__table">
                    <thead>
                      <tr className="border-b border-border/80 bg-slate-950 text-white">
                        <th className="lesson-journal__student-col lesson-journal__sticky-col lesson-journal__sticky-col--head px-5 py-4 text-left align-top">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {selectedGroup?.name ?? "Guruh"} | {selectedGroupStudents.length} ta
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">O'quvchilar</div>
                        </th>
                        <th className="lesson-journal__lesson-col border-l border-white/10 bg-primary/20 px-4 py-4 text-left">
                          <div className="w-full text-left">
                            <div className="text-sm font-semibold text-white">Bugun</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-300">{formatAttendanceShortDate(selectedDate)}</div>
                            <div className="mt-2 text-xs text-slate-400">{selectedDateLabel}</div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/80">
                      {selectedGroupStudents.map((student) => {
                        const draft = drafts[student.id] ?? {
                          status: "present" as AttendanceEntry["status"],
                          comment: "",
                          sendNotification: false,
                          homeworkScore: null,
                          homeworkComment: "",
                          dailyGrade: null,
                          dailyGradeComment: ""
                        };
                        const needsAttention = student.paymentStatus !== "paid" || student.attendancePercent < 80;

                        return (
                          <tr key={student.id} className="align-top bg-white transition hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/40">
                            <td className="lesson-journal__student-col lesson-journal__sticky-col lesson-journal__sticky-col--body px-5 py-4">
                              <div className="flex items-start gap-3">
                                <div className="attendance-student-shell__avatar">{getStudentInitials(student.fullName)}</div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate font-semibold text-slate-950 dark:text-white">{student.fullName}</div>
                                    {needsAttention ? <StatusBadge status={student.paymentStatus} /> : null}
                                  </div>
                                  <div className="mt-2 text-sm text-slate-500">
                                    Davomat: {student.attendancePercent}% | To'lov: {student.paymentStatus === "paid" ? "to'langan" : "nazoratda"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            {[selectedDate].map((lessonDate) => {
                              const savedRow = lessonRowLookup.get(`${student.fullName}::${lessonDate}`);
                              const isActiveLesson = lessonDate === selectedDate;
                              const isAttendanceLocked = Boolean(savedRow);
                              const isHomeworkLocked = Boolean(savedRow && savedRow.homeworkScore !== null && savedRow.homeworkScore !== undefined);
                              const isDailyGradeLocked = Boolean(savedRow && savedRow.dailyGrade !== null && savedRow.dailyGrade !== undefined);
                              const attendanceValue = isActiveLesson
                                ? getMatrixAttendanceValue(draft.status)
                                : savedRow
                                    ? getMatrixAttendanceValue(savedRow.status)
                                    : null;
                              const isAbsentLesson = attendanceValue === "absent";
                              const canEditAttendance = isActiveLesson && !isAttendanceLocked;
                              const canEditHomework = isActiveLesson && isAttendanceLocked && !isHomeworkLocked && !isAbsentLesson;
                              const canEditDailyGrade = isActiveLesson && isAttendanceLocked && !isDailyGradeLocked && !isAbsentLesson;
                              const homeworkScore = isActiveLesson
                                ? (attendanceValue === "absent" ? 0 : draft.homeworkScore)
                                : (savedRow?.homeworkScore ?? null);
                              const homeworkComment = isActiveLesson
                                ? (attendanceValue === "absent" ? "" : draft.homeworkComment)
                                : (savedRow?.homeworkComment ?? "");
                              const dailyGrade = isActiveLesson
                                ? (attendanceValue === "absent" ? null : draft.dailyGrade)
                                : (savedRow?.dailyGrade ?? null);
                              const dailyGradeComment = isActiveLesson
                                ? (attendanceValue === "absent" ? "" : draft.dailyGradeComment)
                                : (savedRow?.dailyGradeComment ?? "");
                              const attendanceStateLabel =
                                attendanceValue === "present" ? "Keldi" : attendanceValue === "absent" ? "Kelmadi" : "Tanlanmagan";
                              const homeworkTone = getHomeworkScoreTone(homeworkScore);
                              const dailyGradeTone = getDailyGradeTone(dailyGrade);

                              return (
                                <td key={`${student.id}-${lessonDate}`} className="lesson-journal__lesson-col border-l border-border/80 bg-primary/5 px-4 py-4">
                                  <div className="lesson-journal__cell lesson-journal__cell--active">
                                <div className="lesson-journal__split-head">
                                  <div className="lesson-journal__split-label">Davomat</div>
                                  <span
                                    className={`lesson-journal__state-chip ${
                                      attendanceValue === "present"
                                        ? "lesson-journal__state-chip--success"
                                        : attendanceValue === "absent"
                                          ? "lesson-journal__state-chip--danger"
                                          : "lesson-journal__state-chip--muted"
                                    }`}
                                  >
                                    {attendanceStateLabel}
                                  </span>
                                </div>
                                <div className="lesson-journal__split">
                                  <div className="lesson-journal__split-block">
                                    {isAttendanceLocked ? (
                                      <div
                                        className={`lesson-journal__state-display ${
                                          attendanceValue === "absent"
                                            ? "lesson-journal__state-display--danger"
                                            : "lesson-journal__state-display--success"
                                        }`}
                                      >
                                        <span className="lesson-journal__state-display-icon">
                                          {attendanceValue === "absent" ? <X size={16} /> : <Check size={16} />}
                                        </span>
                                        <span>{attendanceStateLabel}</span>
                                      </div>
                                    ) : (
                                      <div className="lesson-journal__switch">
                                        <button
                                          type="button"
                                          title="Keldi"
                                          aria-label="Keldi"
                                          disabled={!canEditAttendance}
                                          onClick={() => updateLessonAttendance(student.id, "present")}
                                          className={`lesson-journal__switch-button ${
                                            attendanceValue === "present"
                                              ? "lesson-journal__switch-button--success"
                                              : "lesson-journal__switch-button--idle"
                                          } ${!canEditAttendance ? "lesson-journal__switch-button--locked" : ""}`}
                                        >
                                          <Check size={16} />
                                        </button>
                                        <button
                                          type="button"
                                          title="Kelmadi"
                                          aria-label="Kelmadi"
                                          disabled={!canEditAttendance}
                                          onClick={() => updateLessonAttendance(student.id, "absent")}
                                          className={`lesson-journal__switch-button ${
                                            attendanceValue === "absent"
                                              ? "lesson-journal__switch-button--danger"
                                              : "lesson-journal__switch-button--idle"
                                          } ${!canEditAttendance ? "lesson-journal__switch-button--locked" : ""}`}
                                        >
                                          <X size={16} />
                                        </button>
                                      </div>
                                    )}
                                    {isActiveLesson && isAttendanceLocked ? (
                                      <div className="lesson-journal__hint">Saqlangan.</div>
                                    ) : null}
                                  </div>
                                  <div className="lesson-journal__split-divider" />
                                  <div className="lesson-journal__split-block">
                                    <div className="lesson-journal__split-head">
                                      <div className="lesson-journal__split-label">Uy vazifasi</div>
                                      <span
                                        className={`lesson-journal__score-pill ${
                                          homeworkTone === "success"
                                            ? "lesson-journal__score-pill--success"
                                            : homeworkTone === "warning"
                                              ? "lesson-journal__score-pill--warning"
                                              : homeworkTone === "danger"
                                                ? "lesson-journal__score-pill--danger"
                                                : "lesson-journal__score-pill--muted"
                                        }`}
                                      >
                                        {typeof homeworkScore === "number" ? `${homeworkScore}%` : "--"}
                                      </span>
                                    </div>
                                    {canEditHomework ? (
                                      <div className="lesson-journal__homework-editor">
                                        <div className="lesson-journal__select-wrap">
                                          <select
                                            value={homeworkScore ?? ""}
                                            disabled={homeworkMutation.isPending}
                                            onChange={(event) => {
                                              if (!event.target.value) {
                                                return;
                                              }

                                              updateLessonHomework(student.id, Number(event.target.value));
                                            }}
                                            className="lesson-journal__select lesson-journal__select--premium"
                                          >
                                            <option value="">Foiz tanlang</option>
                                            {homeworkScoreOptions.map((score) => (
                                              <option key={score} value={score}>
                                                {score}%
                                              </option>
                                            ))}
                                          </select>
                                          <span className="lesson-journal__select-icon">
                                            <ChevronDown size={15} />
                                          </span>
                                        </div>
                                        <textarea
                                          value={homeworkComment}
                                          disabled={homeworkMutation.isPending}
                                          onChange={(event) => updateLessonHomeworkComment(student.id, event.target.value)}
                                          rows={3}
                                          placeholder="Uy vazifasi uchun qisqa izoh yozing..."
                                          className="lesson-journal__textarea"
                                        />
                                      </div>
                                    ) : isActiveLesson && isAbsentLesson ? (
                                      <div className="lesson-journal__badge-wrap">
                                        <span className="lesson-journal__badge lesson-journal__badge--danger">Kelmaganligi uchun avtomatik 0%</span>
                                      </div>
                                    ) : isActiveLesson && isHomeworkLocked ? (
                                      <div className="space-y-2">
                                        <div className="lesson-journal__hint">Saqlangan.</div>
                                        <AttendanceNotes homeworkComment={homeworkComment} emptyLabel={null} compact />
                                      </div>
                                    ) : isActiveLesson ? (
                                      <div className="lesson-journal__hint">Avval davomatni saqlang.</div>
                                    ) : (
                                      <div className="space-y-2">
                                        <div className="lesson-journal__badge-wrap">
                                          <span
                                            className={`lesson-journal__badge ${
                                              homeworkTone === "success"
                                                ? "lesson-journal__badge--success"
                                                : homeworkTone === "warning"
                                                  ? "lesson-journal__badge--warning"
                                                  : homeworkTone === "danger"
                                                    ? "lesson-journal__badge--danger"
                                                    : "lesson-journal__badge--muted"
                                            }`}
                                          >
                                            {formatHomeworkScore(homeworkScore)}
                                          </span>
                                        </div>
                                        <AttendanceNotes homeworkComment={homeworkComment} emptyLabel={null} compact />
                                      </div>
                                    )}
                                    <div className="border-t border-border/70 pt-3">
                                      <div className="lesson-journal__split-head">
                                        <div className="lesson-journal__split-label">Kunlik baho</div>
                                        <span
                                          className={`lesson-journal__score-pill ${
                                            dailyGradeTone === "success"
                                              ? "lesson-journal__score-pill--success"
                                              : dailyGradeTone === "warning"
                                                ? "lesson-journal__score-pill--warning"
                                                : dailyGradeTone === "danger"
                                                  ? "lesson-journal__score-pill--danger"
                                                  : "lesson-journal__score-pill--muted"
                                          }`}
                                        >
                                          {formatDailyGrade(dailyGrade)}
                                        </span>
                                      </div>
                                      {canEditDailyGrade ? (
                                        <div className="lesson-journal__homework-editor">
                                          <div className="lesson-journal__score-grid">
                                            {dailyGradeOptions.map((grade) => {
                                              const isActiveGrade = dailyGrade === grade;
                                              const toneClass =
                                                grade >= 5
                                                  ? "lesson-journal__score-button--success"
                                                  : grade >= 4
                                                    ? "lesson-journal__score-button--warning"
                                                    : "lesson-journal__score-button--danger";

                                              return (
                                                <button
                                                  key={grade}
                                                  type="button"
                                                  disabled={dailyGradeMutation.isPending}
                                                  onClick={() => updateLessonDailyGrade(student.id, grade)}
                                                  className={`lesson-journal__score-button ${
                                                    isActiveGrade ? toneClass : "lesson-journal__score-button--idle"
                                                  }`}
                                                >
                                                  {grade}
                                                </button>
                                              );
                                            })}
                                          </div>
                                          <textarea
                                            value={dailyGradeComment}
                                            disabled={dailyGradeMutation.isPending}
                                            onChange={(event) => updateLessonDailyGradeComment(student.id, event.target.value)}
                                            rows={3}
                                            placeholder="Bugungi baho uchun qisqa izoh yozing..."
                                            className="lesson-journal__textarea"
                                          />
                                        </div>
                                      ) : isActiveLesson && isAbsentLesson ? (
                                        <div className="lesson-journal__badge-wrap">
                                          <span className="lesson-journal__badge lesson-journal__badge--danger">Kelmaganligi uchun baho qo'yilmaydi</span>
                                        </div>
                                      ) : isActiveLesson && isDailyGradeLocked ? (
                                        <div className="space-y-2">
                                          <div className="lesson-journal__hint">Saqlangan.</div>
                                          <AttendanceNotes dailyGradeComment={dailyGradeComment} emptyLabel={null} compact />
                                        </div>
                                      ) : isActiveLesson ? (
                                        <div className="lesson-journal__hint">Avval davomatni saqlang.</div>
                                      ) : (
                                        <div className="space-y-2">
                                          <div className="lesson-journal__badge-wrap">
                                            <span
                                              className={`lesson-journal__badge ${
                                                dailyGradeTone === "success"
                                                  ? "lesson-journal__badge--success"
                                                  : dailyGradeTone === "warning"
                                                    ? "lesson-journal__badge--warning"
                                                    : dailyGradeTone === "danger"
                                                      ? "lesson-journal__badge--danger"
                                                      : "lesson-journal__badge--muted"
                                              }`}
                                            >
                                              {formatDailyGrade(dailyGrade)}
                                            </span>
                                          </div>
                                          <AttendanceNotes dailyGradeComment={dailyGradeComment} emptyLabel={null} compact />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                    {isActiveLesson ? (
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => updateStudentDraft(student.id, { sendNotification: !draft.sendNotification })}
                                        className={`lesson-journal__notify ${
                                          draft.sendNotification
                                            ? "border-primary/50 bg-primary text-white"
                                            : "border-border/80 bg-white text-slate-600 dark:bg-slate-950 dark:text-slate-300"
                                        }`}
                                      >
                                        <Bell size={14} />
                                        {draft.sendNotification ? "Signal yoqilgan" : "Signal o'chirilgan"}
                                      </button>
                                    ) : (savedRow?.comment || savedRow?.homeworkComment || savedRow?.dailyGradeComment) ? (
                                      <AttendanceNotes
                                        comment={savedRow?.comment}
                                        homeworkComment={savedRow?.homeworkComment}
                                        dailyGradeComment={savedRow?.dailyGradeComment}
                                        emptyLabel={null}
                                        compact
                                      />
                                    ) : null}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {isLocked ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="flex flex-col gap-4 rounded-[24px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/60 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Uy vazifasini baholash</div>
                      <div className="mt-1 text-base font-semibold text-slate-950 dark:text-white">Foiz va izohni kiriting.</div>
                      <div className="mt-1 text-sm text-slate-500">Tanlanganlar: {pendingHomeworkEntries.length} ta</div>
                    </div>
                    <Button
                      type="button"
                      variant={pendingHomeworkEntries.length ? "primary" : "secondary"}
                      onClick={saveHomeworkScores}
                      disabled={!pendingHomeworkEntries.length || homeworkMutation.isPending}
                      loading={homeworkMutation.isPending}
                      className="lg:min-w-[240px]"
                    >
                      <CheckCheck size={16} />
                      {homeworkMutation.isPending ? "Saqlanmoqda..." : "Uy vazifasini saqlash"}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-4 rounded-[24px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/60 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kunlik baho</div>
                      <div className="mt-1 text-base font-semibold text-slate-950 dark:text-white">1 dan 5 gacha baho va izohni kiriting.</div>
                      <div className="mt-1 text-sm text-slate-500">Tanlanganlar: {pendingDailyGradeEntries.length} ta</div>
                    </div>
                    <Button
                      type="button"
                      variant={pendingDailyGradeEntries.length ? "primary" : "secondary"}
                      onClick={saveDailyGrades}
                      disabled={!pendingDailyGradeEntries.length || dailyGradeMutation.isPending}
                      loading={dailyGradeMutation.isPending}
                      className="lg:min-w-[240px]"
                    >
                      <CheckCheck size={16} />
                      {dailyGradeMutation.isPending ? "Saqlanmoqda..." : "Kunlik bahoni saqlash"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState title="Guruhda o'quvchi yo'q" description="Boshqa guruhni tanlang yoki avval guruhga o'quvchi biriktiring." />
          )}
        </div>
      ) : null}
      {isWorkspaceRoute ? null : (
        <>
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
                    count: rows.filter((item) => item.status === "not_prepared" || item.status === "homework_not_done" || isHomeworkAttention(item.homeworkScore)).length,
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
              quickFilterLabel="Ogohlantirishlarni ko'rish"
              onQuickFilter={() => setFilter("attention")}
            />
          </FilterBar>
          <AttendanceTable rows={filtered} />
        </>
      )}
    </section>
  );
}

export function TeacherStudentDetailPage() {
  const { id = "student-1" } = useParams();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["teacher-student", id],
    queryFn: () => mockApi.getStudentDetail(id)
  });

  if (!data) {
    return null;
  }

  const openPayments = data.payments.filter((item) => item.status !== "paid").length;
  const parentPhone = data.phone.replace(data.phone.slice(-2), "**");

  return (
    <section className="space-y-6">
      <SectionHeader
        title={data.fullName}
        description={`${data.group} - ${data.course}`}
        actions={
          <Button onClick={() => setNotificationOpen(true)}>
            <Send size={16} className="mr-2" />
            Ota-onaga xabar
          </Button>
        }
      />
      <SummaryStrip>
        <StatsCard label="Davomat yozuvlari" value={String(data.attendanceTimeline.length)} change="So'nggi tarix" tone="primary" />
        <StatsCard label="Ochiq to'lovlar" value={String(openPayments)} change="Nazorat kerak" tone="warning" />
        <StatsCard label="Uy vazifalari" value={String(data.homework.length)} change="Faol topshiriqlar" tone="success" />
        <StatsCard label="Izohlar" value={String(data.notes.length)} change="Pedagogik kuzatuvlar" tone="primary" />
      </SummaryStrip>
      <div className="main-with-sidebar">
        <div className="space-y-6">
          <InfoPanel title="Akademik profil" description="Guruh, kurs va aloqa bo'yicha asosiy ma'lumotlar.">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="mini-note">Telefon: {data.phone}</div>
              <div className="mini-note">Guruh: {data.group}</div>
              <div className="mini-note">Kurs: {data.course}</div>
              <div className="mini-note">Ota-ona: {data.parentName}</div>
            </div>
          </InfoPanel>
          <InfoPanel title="Davomat tarixi" description="So'nggi darslar bo'yicha holatlar.">
            <div className="space-y-3">
              {data.attendanceTimeline.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">
                  <div>
                    <div className="font-medium">{item.date}</div>
                    <div className="mt-2">
                      <AttendanceNotes
                        comment={item.comment}
                        homeworkComment={item.homeworkComment}
                        dailyGradeComment={item.dailyGradeComment}
                        emptyLabel="Izoh kiritilmagan"
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
              ))}
            </div>
          </InfoPanel>
          <InfoPanel title="O'qituvchi izohlari" description="Dars bo'yicha xulosa va tavsiyalar.">
            <div className="space-y-3">
              {data.notes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{formatNoteTag(note.tag)}</span>
                    <span className="text-xs text-slate-400">{note.date}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{note.comment}</div>
                </div>
              ))}
            </div>
          </InfoPanel>
        </div>
        <SidePanel title="Tezkor ko'rinish" description="Ota-ona, to'lov va vazifalar bo'yicha qisqa panel.">
          <div className="space-y-3">
            <div className="mini-note">Ota-ona: {data.parentName}</div>
            <div className="mini-note">Aloqa: {parentPhone}</div>
            <div className="mini-note">Qarzdorlik: {openPayments} ta yozuv</div>
          </div>
          <TimelineList
            items={data.homework.slice(0, 4).map((item) => ({
              id: item.id,
              title: item.title,
              description: `Topshirish muddati: ${item.dueDate}`,
              meta: item.status === "submitted" ? "Topshirildi" : "Kutilmoqda",
              tone: item.status === "submitted" ? "success" : "warning"
            }))}
          />
        </SidePanel>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <PaymentTable rows={data.payments} />
        <InfoPanel title="Uy vazifalari" description="Topshiriqlar va topshirish holati.">
          <div className="space-y-3">
            {data.homework.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-slate-500">Topshirish muddati: {item.dueDate}</div>
                </div>
                <StatusBadge status={item.status === "submitted" ? "submitted" : "pending"} />
              </div>
            ))}
          </div>
        </InfoPanel>
      </div>
      <NotificationModal open={notificationOpen} studentId={data.id} studentName={data.fullName} onClose={() => setNotificationOpen(false)} />
    </section>
  );
}

export function TeacherNotificationsPage() {
  const user = useAuthStore((state) => state.user)!;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TeacherNotificationFilter>("all");
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: mockApi.getGroups
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: mockApi.getStudents
  });
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: mockApi.getNotifications
  });

  const ownGroupNames = (groups ?? []).filter((group) => group.teacher === user.fullName).map((group) => group.name);
  const ownStudents = (students ?? []).filter((student) => ownGroupNames.includes(student.group));
  const ownStudentNames = ownStudents.map((student) => student.fullName);
  const rows = (data ?? []).filter((item: NotificationEntry) => ownStudentNames.includes(item.studentName));
  const filtered = rows.filter((item) => {
    const matchesSearch = [item.studentName, item.template, item.recipient].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ? true : filter === "today" ? item.sentAt.startsWith(TODAY) : item.status === "sent";

    return matchesSearch && matchesFilter;
  });

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Xabarlar tarixi"
        description="Ota-onaga yuborilgan barcha signal va eslatmalar shu yerda saqlanadi."
        actions={
          <Button variant="secondary" onClick={() => setFilter("today")}>
            Bugungi xabarlar
          </Button>
        }
      />
      <SummaryStrip>
        <StatsCard label="Jami xabarlar" value={String(rows.length)} change="Mening guruhlarim bo'yicha" tone="primary" />
        <StatsCard
          label="Bugungi yuborishlar"
          value={String(rows.filter((item) => item.sentAt.startsWith(TODAY)).length)}
          change="Joriy sana"
          tone="success"
        />
        <StatsCard
          label="Yuborilgan"
          value={String(rows.filter((item) => item.status === "sent").length)}
          change="Muvaffaqiyatli"
          tone="success"
        />
        <StatsCard
          label="Muammo bo'lgan"
          value={String(rows.filter((item) => item.status === "failed").length)}
          change="Qayta tekshirish tavsiya etiladi"
          tone="danger"
        />
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
          description="O'qituvchi yuborgan xabarlar bo'yicha aloqa jurnali."
          rows={filtered}
          columns={[
            {
              key: "student",
              header: "O'quvchi",
              render: (row) => (
                <Link
                  to={`/teacher/students/${ownStudents.find((student) => student.fullName === row.studentName)?.id ?? "student-1"}`}
                  className="font-semibold hover:text-primary"
                >
                  {row.studentName}
                </Link>
              )
            },
            { key: "template", header: "Shablon", render: (row) => row.template },
            { key: "recipient", header: "Qabul qiluvchi", render: (row) => row.recipient },
            { key: "status", header: "Holat", render: (row) => <StatusBadge status={row.status} /> },
            { key: "sentAt", header: "Yuborilgan vaqt", render: (row) => row.sentAt }
          ]}
        />
        <SidePanel title="Aloqa markazi" description="Qaysi xabarlar ko'proq ishlatilayotganini tez ko'rish uchun.">
          <div className="space-y-3">
            <div className="mini-note">Bugun yuborilganlar: {rows.filter((item) => item.sentAt.startsWith(TODAY)).length} ta</div>
            <div className="mini-note">Kelmaganlar shabloni: {rows.filter((item) => item.template.toLowerCase().includes("kelmadi")).length} ta</div>
            <div className="mini-note">To'lov shabloni: {rows.filter((item) => item.template.toLowerCase().includes("to'lov")).length} ta</div>
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

export function TeacherProfilePage() {
  const user = useAuthStore((state) => state.user)!;
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email ?? "");
  const [specialization, setSpecialization] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user.avatar);
  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: mockApi.getTeachers
  });
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: mockApi.getGroups
  });

  const teacherSummary = useMemo(
    () => (teachers ?? []).find((item) => item.fullName === user.fullName || item.id === user.profileId),
    [teachers, user.fullName, user.profileId]
  );
  const ownGroups = useMemo(
    () => (groups ?? []).filter((group) => group.teacher === (teacherSummary?.fullName ?? user.fullName)),
    [groups, teacherSummary?.fullName, user.fullName]
  );

  useEffect(() => {
    setFullName(user.fullName);
    setPhone(user.phone);
    setEmail(user.email ?? "");
    setAvatarPreview(user.avatar);
  }, [user]);

  useEffect(() => {
    setSpecialization(teacherSummary?.specialization ?? "");
  }, [teacherSummary?.specialization]);

  const profileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: async (nextUser) => {
      setUser(nextUser);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teachers"] }),
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
      toast.success("Profil saqlandi.");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const passwordMutation = useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) => authService.changePassword(current, next),
    onSuccess: (response) => {
      setCurrentPassword("");
      setNewPassword("");
      toast.success(response.message);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const dataUrl = await readFileAsDataUrl(file);
      return authService.uploadAvatar(file.name, dataUrl);
    },
    onSuccess: async (nextUser) => {
      setUser(nextUser);
      setAvatarPreview(nextUser.avatar);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teachers"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
      toast.success("Profil rasmi yangilandi.");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  return (
    <section className="space-y-6">
      <SectionHeader title="Profil" description="O'zingizning profil, rasm va xavfsizlik sozlamalari." />
      <div className="main-with-sidebar">
        <div className="space-y-6">
          <InfoPanel title={fullName} description="Asosiy teacher ma'lumotlari shu yerda yangilanadi.">
            <div className="space-y-5">
              <AvatarUpload
                value={avatarPreview}
                name={fullName}
                disabled={avatarMutation.isPending}
                loading={avatarMutation.isPending}
                onSelect={(file) => {
                  setAvatarPreview(URL.createObjectURL(file));
                  avatarMutation.mutate(file);
                }}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="field-label">Ism</span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="field-control" />
                </label>
                <label>
                  <span className="field-label">Telefon</span>
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} className="field-control" />
                </label>
                <label>
                  <span className="field-label">Email</span>
                  <input value={email} onChange={(event) => setEmail(event.target.value)} className="field-control" />
                </label>
                <label>
                  <span className="field-label">Mutaxassislik</span>
                  <input value={specialization} onChange={(event) => setSpecialization(event.target.value)} className="field-control" />
                </label>
              </div>
              <Button
                onClick={() =>
                  profileMutation.mutate({
                    fullName,
                    phone,
                    email: email || undefined,
                    specialization: specialization || undefined
                  })
                }
                disabled={profileMutation.isPending}
                loading={profileMutation.isPending}
              >
                {profileMutation.isPending ? "Saqlanmoqda..." : "Profilni saqlash"}
              </Button>
            </div>
          </InfoPanel>

          <InfoPanel title="Parolni almashtirish" description="Joriy parol va yangi parolni kiriting.">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="field-label">Joriy parol</span>
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="field-control" />
              </label>
              <label>
                <span className="field-label">Yangi parol</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="field-control" />
              </label>
            </div>
            <Button
              className="mt-4"
              variant="secondary"
              disabled={!currentPassword || !newPassword || passwordMutation.isPending}
              loading={passwordMutation.isPending}
              onClick={() => passwordMutation.mutate({ current: currentPassword, next: newPassword })}
            >
              {passwordMutation.isPending ? "Yangilanmoqda..." : "Parolni yangilash"}
            </Button>
          </InfoPanel>
        </div>

        <SidePanel title="Biriktirilgan guruhlar" description="Hozir sizga biriktirilgan real guruhlar ro'yxati.">
          <div className="space-y-3">
            {ownGroups.length ? (
              ownGroups.map((group) => (
                <div key={group.id} className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 text-sm dark:bg-slate-900/70">
                  <div className="font-semibold text-slate-900 dark:text-white">{group.name}</div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">{group.course}</div>
                  <div className="mt-2 text-slate-500 dark:text-slate-400">{group.schedule} | {group.room}</div>
                </div>
              ))
            ) : (
              <Card className="rounded-[24px] border border-border/80 bg-slate-50/80 text-sm dark:bg-slate-900/70">
                Hozircha sizga guruh biriktirilmagan.
              </Card>
            )}
          </div>
        </SidePanel>
      </div>
    </section>
  );
}
