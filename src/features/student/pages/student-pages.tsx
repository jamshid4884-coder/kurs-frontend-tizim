import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, CalendarDays, Clock3, Layers3, MapPin, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { mockApi } from "@/services/mock-api";
import { authService } from "@/services/auth-service";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { AttendanceNotes } from "@/components/common/AttendanceNotes";
import { FilterChips } from "@/components/common/FilterChips";
import { AvatarUpload } from "@/components/forms/AvatarUpload";
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
import { PaymentTable } from "@/components/tables/PaymentTable";
import type { StudentDetail } from "@/types/domain";

type StudentAttendanceFilter = "all" | "present" | "absent" | "late" | "attention";
type StudentPaymentFilter = "all" | "paid" | "partial" | "unpaid" | "overdue";

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <SharedPageHeader
      eyebrow="Shaxsiy kabinet"
      title={title}
      description={description}
      metaTitle="O'quvchi paneli"
      metaDescription="Davomat, jadval, to'lov va izohlar bitta tartibli ko'rinishda."
      breadcrumbs={["Boshqaruv", "O'quvchi", title]}
    />
  );
}

const liveStudentQueryOptions = {
  refetchInterval: 4000,
  refetchOnWindowFocus: true as const,
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi."));
    reader.readAsDataURL(file);
  });
}

function buildStudentSchedule(detail?: StudentDetail) {
  if (!detail?.scheduleDays?.length || !detail.scheduleTime) {
    return detail?.schedule ? [detail.schedule] : [];
  }

  return detail.scheduleDays.map((day) => `${day} - ${detail.scheduleTime}${detail.room ? ` - ${detail.room}` : ""}`);
}

function formatUzbekDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("uz-UZ", options).format(new Date(`${value}T12:00:00`));
}

function buildLessonSummary(entry: StudentDetail["attendanceTimeline"][number]) {
  if (entry.lessonTopic) {
    return entry.lessonTopic;
  }

  if (entry.comment) {
    return entry.comment;
  }

  if (entry.status === "present") {
    return "Darsda to'liq qatnashgan.";
  }

  if (entry.status === "late") {
    return "Darsga kechikib kirgan.";
  }

  if (entry.status === "absent") {
    return "Darsda qatnashmagan.";
  }

  if (entry.status === "excused") {
    return "Sababli ravishda dars qoldirilgan.";
  }

  if (entry.status === "not_prepared") {
    return "Darsga tayyorgarlik yetarli bo'lmagan.";
  }

  return "Uy vazifasi to'liq bajarilmagan.";
}

function getDailyGradeBadgeClass(grade?: number | null) {
  if (grade === 5) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (grade === 4) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300";
}

function formatDailyGradeLabel(grade?: number | null) {
  return typeof grade === "number" ? `Kunlik baho: ${grade}` : null;
}

export function StudentDashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  const studentProfileId = user.profileId ?? user.id;
  const { data } = useQuery({
    queryKey: ["dashboard", "student"],
    queryFn: () => mockApi.getDashboardMetrics("STUDENT"),
    ...liveStudentQueryOptions
  });
  const { data: detail } = useQuery({
    queryKey: ["student-detail", studentProfileId],
    queryFn: () => mockApi.getStudentDetail(studentProfileId),
    ...liveStudentQueryOptions
  });
  const pendingHomework = useMemo(() => (detail?.homework ?? []).filter((item) => item.status !== "submitted"), [detail?.homework]);
  const scheduleCards = useMemo(() => buildStudentSchedule(detail), [detail]);
  const latestMessage = detail?.messages?.[0];

  return (
    <section className="space-y-6">
      <SectionHeader title="O'quvchi paneli" description="Shaxsiy davomat, to'lov, uy vazifasi va o'sish ko'rsatkichlari." />
      <SummaryStrip>
        {data?.metrics.map((metric) => <StatsCard key={metric.label} {...metric} />)}
      </SummaryStrip>
      <div className="dashboard-main-grid">
        <div className="space-y-6">
          <ChartCard title="Davomat o'sishi" description="So'nggi darslar bo'yicha qatnashish ko'rsatkichi." data={data?.chart ?? []} />
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <InfoPanel title="Mening holatim" description="Biriktirilgan guruh, kurs, o'qituvchi va dars tartibi.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                  <div className="font-medium">Joriy guruh</div>
                  <div className="mt-1 text-sm text-slate-500">{detail?.group ?? "-"}</div>
                </div>
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                  <div className="font-medium">Joriy kurs</div>
                  <div className="mt-1 text-sm text-slate-500">{detail?.course ?? "-"}</div>
                </div>
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                  <div className="font-medium">O'qituvchi</div>
                  <div className="mt-1 text-sm text-slate-500">{detail?.teacherName ?? "-"}</div>
                </div>
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                  <div className="font-medium">Dars vaqti</div>
                  <div className="mt-1 text-sm text-slate-500">{detail?.schedule ?? "Jadval biriktirilmagan"}</div>
                </div>
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                  <div className="font-medium">Xona</div>
                  <div className="mt-1 text-sm text-slate-500">{detail?.room ?? "-"}</div>
                </div>
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                  <div className="font-medium">Ochiq to'lovlar</div>
                  <div className="mt-1 text-sm text-slate-500">{detail?.payments.filter((item) => item.status !== "paid").length ?? 0} ta yozuv</div>
                </div>
              </div>
            </InfoPanel>
            <InfoPanel title="Dars va vazifalar" description="Qachon dars bo'lishi va nechta vazifa ochiq turgani shu yerda ko'rinadi.">
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                  <div className="font-medium">Navbatdagi darslar</div>
                  <div className="mt-3 grid gap-2">
                    {scheduleCards.length ? (
                      scheduleCards.map((item) => (
                        <div key={item} className="rounded-2xl border border-border/70 bg-white/80 px-3 py-2 text-sm dark:bg-slate-950/50">
                          {item}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">Hozircha guruh va jadval biriktirilmagan.</div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                  <div className="font-medium">Ochiq uy vazifalari</div>
                  <div className="mt-1 text-sm text-slate-500">{pendingHomework.length} ta vazifa topshirilishi kutilmoqda.</div>
                </div>
                {(detail?.homework ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">
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
          <InfoPanel title="O'qituvchi izohlari" description="So'nggi pedagogik eslatmalar va tavsiyalar.">
            <div className="space-y-3">
              {latestMessage ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm dark:bg-primary/10">
                  <div className="font-medium">So'nggi tizim xabari</div>
                  <div className="mt-1 text-slate-500">{latestMessage.body}</div>
                </div>
              ) : null}
              {(detail?.notes ?? []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 text-sm dark:bg-slate-900/70">
                  <div className="font-medium">{item.date}</div>
                  <div className="mt-1 text-slate-500">{item.comment}</div>
                </div>
              ))}
            </div>
          </InfoPanel>
        </div>
        <SidePanel title="Tizim xabarlari" description="Sizga tegishli eng oxirgi tizim xabarlari.">
          <TimelineList
            items={(detail?.messages ?? []).slice(0, 4).map((item) => ({
              id: item.id,
              title: item.title,
              description: item.body,
              meta: item.createdAt,
              tone: "default"
            }))}
          />
        </SidePanel>
      </div>
    </section>
  );
}

export function StudentAttendancePage() {
  const user = useAuthStore((state) => state.user)!;
  const studentProfileId = user.profileId ?? user.id;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StudentAttendanceFilter>("all");
  const { data } = useQuery({
    queryKey: ["student-detail", studentProfileId],
    queryFn: () => mockApi.getStudentDetail(studentProfileId),
    ...liveStudentQueryOptions
  });

  const rows = (data?.attendanceTimeline ?? []).filter((item) =>
    [item.studentName, item.group, item.comment ?? ""].join(" ").toLowerCase().includes(search.toLowerCase())
  );
  const filtered = rows.filter((item) => {
    if (filter === "present") return item.status === "present";
    if (filter === "absent") return item.status === "absent";
    if (filter === "late") return item.status === "late";
    if (filter === "attention") return item.status === "not_prepared" || item.status === "homework_not_done";
    return true;
  });

  return (
    <section className="space-y-6">
      <SectionHeader title="Mening davomatim" description="Kechikish, kelmaslik va tayyorgarlik holatlari bilan to'liq tarix." />
      <SummaryStrip>
        <StatsCard label="Jami yozuvlar" value={String(rows.length)} change="Mening tarixim" tone="primary" />
        <StatsCard label="Kelganlar" value={String(rows.filter((item) => item.status === "present").length)} change="To'liq qatnashgan" tone="success" />
        <StatsCard label="Kelmaganlar" value={String(rows.filter((item) => item.status === "absent").length)} change="Nazorat kerak" tone="danger" />
        <StatsCard
          label="Ogohlantirishlar"
          value={String(rows.filter((item) => item.status === "not_prepared" || item.status === "homework_not_done").length)}
          change="Tayyor emas yoki vazifa qilinmagan"
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
        <SearchFilterBar value={search} onChange={setSearch} placeholder="Izoh yoki guruh bo'yicha qidiring..." />
      </FilterBar>
      <AttendanceTable rows={filtered} />
    </section>
  );
}

export function StudentGroupsPage() {
  const user = useAuthStore((state) => state.user)!;
  const studentProfileId = user.profileId ?? user.id;
  const { data } = useQuery({
    queryKey: ["student-detail", studentProfileId],
    queryFn: () => mockApi.getStudentDetail(studentProfileId),
    ...liveStudentQueryOptions
  });

  const groupAssignments = data?.groupAssignments ?? [];
  const pendingHomework = useMemo(
    () => [...(data?.homework ?? [])].sort((left, right) => left.dueDate.localeCompare(right.dueDate)),
    [data?.homework]
  );
  const recentLessons = useMemo(() => (data?.attendanceTimeline ?? []).slice(0, 6), [data?.attendanceTimeline]);

  return (
    <section className="space-y-6">
      <SectionHeader title="Guruhlarim" description="Qaysi guruhga qo'shilganingiz, dars va uy vazifasi shu yerda ko'rinadi." />
      <SummaryStrip>
        <StatsCard label="Biriktirilgan guruh" value={String(groupAssignments.length)} change={groupAssignments[0]?.name ?? "Hali guruh yo'q"} tone="primary" />
        <StatsCard
          label="Ochiq vazifa"
          value={String(pendingHomework.filter((item) => item.status !== "submitted").length)}
          change="Topshirish muddati kuzatiladi"
          tone="warning"
        />
        <StatsCard
          label="So'nggi dars"
          value={recentLessons[0] ? formatUzbekDate(recentLessons[0].date, { day: "numeric", month: "short" }) : "-"}
          change={recentLessons[0]?.group ?? "Yozuv topilmadi"}
          tone="success"
        />
        <StatsCard
          label="Dars tartibi"
          value={groupAssignments[0]?.scheduleTime ?? "-"}
          change={groupAssignments[0]?.scheduleDays.join(", ") ?? "Jadval biriktirilmagan"}
          tone="primary"
        />
      </SummaryStrip>

      {groupAssignments.length ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="grid gap-5">
              {groupAssignments.map((group) => (
                <Card
                  key={group.id}
                  className="overflow-hidden rounded-[28px] border border-primary/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,91,219,0.10),_transparent_45%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.94))] p-0 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,91,219,0.16),_transparent_48%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.94))]"
                >
                  <div className="border-b border-border/70 px-6 py-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70">Guruh</div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_18px_36px_rgba(59,91,219,0.18)]">
                        <Layers3 size={20} />
                      </div>
                      <div>
                        <div className="text-xl font-semibold text-slate-900 dark:text-white">{group.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{group.course}</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 p-6 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-border/80 bg-white/80 p-4 dark:bg-slate-950/50">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        <UserRound size={16} className="text-primary" />
                        O'qituvchi
                      </div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{group.teacherName}</div>
                    </div>
                    <div className="rounded-[22px] border border-border/80 bg-white/80 p-4 dark:bg-slate-950/50">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        <MapPin size={16} className="text-primary" />
                        Xona
                      </div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{group.room}</div>
                    </div>
                    <div className="rounded-[22px] border border-border/80 bg-white/80 p-4 dark:bg-slate-950/50">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        <CalendarDays size={16} className="text-primary" />
                        Dars kunlari
                      </div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {group.scheduleDays.length ? group.scheduleDays.join(", ") : "Ko'rsatilmagan"}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-border/80 bg-white/80 p-4 dark:bg-slate-950/50">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        <Clock3 size={16} className="text-primary" />
                        Dars vaqti
                      </div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{group.scheduleTime ?? group.schedule}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <InfoPanel title="Dars haqida" description="Oxirgi dars yozuvlari, holat va qisqa izohlar.">
              <div className="space-y-3">
                {recentLessons.length ? (
                  recentLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex flex-col gap-3 rounded-[24px] border border-border/80 bg-slate-50/80 px-4 py-4 dark:bg-slate-900/70 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatUzbekDate(lesson.date, { day: "numeric", month: "long", weekday: "long" })}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{lesson.group}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">{buildLessonSummary(lesson)}</div>
                        {lesson.comment || lesson.homeworkComment || lesson.dailyGradeComment ? (
                          <AttendanceNotes
                            comment={lesson.comment}
                            homeworkComment={lesson.homeworkComment}
                            dailyGradeComment={lesson.dailyGradeComment}
                            emptyLabel={null}
                            compact
                            className="pt-1"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={lesson.status} />
                        {typeof lesson.homeworkScore === "number" ? (
                          <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary dark:border-primary/20 dark:bg-primary/12">
                            Homework: {lesson.homeworkScore}%
                          </span>
                        ) : null}
                        {typeof lesson.dailyGrade === "number" ? (
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${getDailyGradeBadgeClass(lesson.dailyGrade)}`}
                          >
                            {formatDailyGradeLabel(lesson.dailyGrade)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <Card className="rounded-[24px] border border-border/80 bg-slate-50/80 text-sm dark:bg-slate-900/70">
                    Hozircha dars yozuvlari yo'q.
                  </Card>
                )}
              </div>
            </InfoPanel>
          </div>

          <div className="space-y-6">
            <InfoPanel title="Uy vazifalari" description="Vazifa nomi va topshirish muddati shu yerda turadi.">
              <div className="space-y-3">
                {pendingHomework.length ? (
                  pendingHomework.map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                            <BookOpenCheck size={16} className="text-primary" />
                            {item.title}
                          </div>
                          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Topshirish muddati: {formatUzbekDate(item.dueDate, { day: "numeric", month: "long", weekday: "long" })}
                          </div>
                        </div>
                        <StatusBadge status={item.status === "submitted" ? "submitted" : "pending"} />
                      </div>
                    </div>
                  ))
                ) : (
                  <Card className="rounded-[24px] border border-border/80 bg-slate-50/80 text-sm dark:bg-slate-900/70">
                    Hozircha uy vazifasi biriktirilmagan.
                  </Card>
                )}
              </div>
            </InfoPanel>

            <InfoPanel title="Dars tartibi" description="Guruhga biriktirilgan jadval qisqacha ko'rinadi.">
              <div className="space-y-3">
                {groupAssignments.map((group) => (
                  <div key={`${group.id}-schedule`} className="rounded-[24px] border border-border/80 bg-slate-50/80 p-4 dark:bg-slate-900/70">
                    <div className="font-semibold text-slate-900 dark:text-white">{group.name}</div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{group.schedule}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.scheduleDays.map((day) => (
                        <span
                          key={`${group.id}-${day}`}
                          className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary dark:border-primary/20 dark:bg-primary/12"
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </InfoPanel>
          </div>
        </div>
      ) : (
        <Card className="rounded-[28px] border border-border/80 bg-slate-50/80 text-sm dark:bg-slate-900/70">
          Hozircha sizga guruh biriktirilmagan.
        </Card>
      )}
    </section>
  );
}

export function StudentPaymentsPage() {
  const user = useAuthStore((state) => state.user)!;
  const studentProfileId = user.profileId ?? user.id;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StudentPaymentFilter>("all");
  const { data } = useQuery({
    queryKey: ["student-detail", studentProfileId],
    queryFn: () => mockApi.getStudentDetail(studentProfileId),
    ...liveStudentQueryOptions
  });

  const rows = (data?.payments ?? []).filter((item) =>
    [item.month, item.method, item.amount].join(" ").toLowerCase().includes(search.toLowerCase())
  );
  const filtered = rows.filter((item) => (filter === "all" ? true : item.status === filter));

  return (
    <section className="space-y-6">
      <SectionHeader title="Mening to'lovlarim" description="Kelgusi to'lovlar va muddati o'tgan yozuvlarni ko'rish." />
      <SummaryStrip>
        <StatsCard label="Jami yozuvlar" value={String(rows.length)} change="To'lov tarixi" tone="primary" />
        <StatsCard label="To'langanlar" value={String(rows.filter((item) => item.status === "paid").length)} change="Yopilgan" tone="success" />
        <StatsCard label="Qisman" value={String(rows.filter((item) => item.status === "partial").length)} change="Qoldiq bor" tone="warning" />
        <StatsCard label="Qarzdorlik" value={String(rows.filter((item) => item.status === "overdue" || item.status === "unpaid").length)} change="Nazorat kerak" tone="danger" />
      </SummaryStrip>
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
        <SearchFilterBar value={search} onChange={setSearch} placeholder="Oy, usul yoki summa bo'yicha qidiring..." />
      </FilterBar>
      <PaymentTable rows={filtered} />
    </section>
  );
}

export function StudentSchedulePage() {
  const user = useAuthStore((state) => state.user)!;
  const studentProfileId = user.profileId ?? user.id;
  const { data } = useQuery({
    queryKey: ["student-detail", studentProfileId],
    queryFn: () => mockApi.getStudentDetail(studentProfileId),
    ...liveStudentQueryOptions
  });
  const schedules = useMemo(() => buildStudentSchedule(data), [data]);

  return (
    <section className="space-y-6">
      <SectionHeader title="Jadval" description="Hozirgi guruh dars jadvali va xona ma'lumotlari." />
      {schedules.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          {schedules.map((item) => (
            <Card key={item} className="rounded-[24px] border border-border/80 bg-slate-50/80 text-sm dark:bg-slate-900/70">
              {item}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-[24px] border border-border/80 bg-slate-50/80 text-sm dark:bg-slate-900/70">
          Hozircha sizga guruh yoki dars jadvali biriktirilmagan.
        </Card>
      )}
    </section>
  );
}

export function StudentProfilePage() {
  const user = useAuthStore((state) => state.user)!;
  const setUser = useAuthStore((state) => state.setUser);
  const studentProfileId = user.profileId ?? user.id;
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["student-detail", studentProfileId],
    queryFn: () => mockApi.getStudentDetail(studentProfileId),
    ...liveStudentQueryOptions
  });
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email ?? "");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentTelegramHandle, setParentTelegramHandle] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user.avatar);

  useEffect(() => {
    if (!data) {
      return;
    }

    setFullName(data.fullName);
    setPhone(data.phone);
    setEmail(user.email ?? "");
    setParentName(data.parentName);
    setParentPhone(data.parentPhone ?? "");
    setParentTelegramHandle(data.parentTelegramHandle ?? "");
  }, [data, user.email]);

  const profileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: async (nextUser) => {
      setUser(nextUser);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["student-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] })
      ]);
      toast.success("Profil ma'lumotlari saqlandi.");
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
        queryClient.invalidateQueries({ queryKey: ["student-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] })
      ]);
      toast.success("Profil rasmi yangilandi.");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  if (!data) {
    return null;
  }

  return (
    <section className="space-y-6">
      <SectionHeader title="Profil" description="Shaxsiy ma'lumotlar, ota-ona aloqasi va o'qish holati." />
      <div className="main-with-sidebar">
        <div className="space-y-6">
          <InfoPanel title={data.fullName} description="Shaxsiy ma'lumotlar va akkaunt sozlamalari shu yerda saqlanadi.">
            <div className="space-y-5">
              <AvatarUpload
                value={avatarPreview}
                name={fullName}
                disabled={avatarMutation.isPending}
                loading={avatarMutation.isPending}
                onSelect={(file) => {
                  const preview = URL.createObjectURL(file);
                  setAvatarPreview(preview);
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
                  <span className="field-label">Telegram handle</span>
                  <input
                    value={parentTelegramHandle}
                    onChange={(event) => setParentTelegramHandle(event.target.value)}
                    placeholder="@otaona"
                    className="field-control"
                  />
                </label>
                <label>
                  <span className="field-label">Ota-ona</span>
                  <input value={parentName} onChange={(event) => setParentName(event.target.value)} className="field-control" />
                </label>
                <label>
                  <span className="field-label">Ota-ona telefoni</span>
                  <input value={parentPhone} onChange={(event) => setParentPhone(event.target.value)} className="field-control" />
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    profileMutation.mutate({
                      fullName,
                      phone,
                      email: email || undefined,
                      parentName,
                      parentPhone,
                      parentTelegramHandle: parentTelegramHandle || undefined
                    })
                  }
                  disabled={profileMutation.isPending}
                  loading={profileMutation.isPending}
                >
                  {profileMutation.isPending ? "Saqlanmoqda..." : "Profilni saqlash"}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 text-sm dark:bg-slate-900/70">Guruh: {data.group}</div>
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 text-sm dark:bg-slate-900/70">Kurs: {data.course}</div>
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 text-sm dark:bg-slate-900/70">O'qituvchi: {data.teacherName ?? "-"}</div>
                <div className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 text-sm dark:bg-slate-900/70">Jadval: {data.schedule ?? "Biriktirilmagan"}</div>
              </div>
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
          <InfoPanel title="Davomat tarixi" description="Oxirgi qatnashish yozuvlari.">
            <div className="space-y-3">
              {data.attendanceTimeline.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">
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
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getDailyGradeBadgeClass(item.dailyGrade)}`}
                      >
                        {formatDailyGradeLabel(item.dailyGrade)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </InfoPanel>
        </div>
        <SidePanel title="Uy vazifalari" description="Joriy topshiriqlar va topshirish holati.">
          <div className="space-y-3">
            {data.homework.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/70">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-slate-500">Topshirish muddati: {item.dueDate}</div>
                </div>
                <StatusBadge status={item.status === "submitted" ? "submitted" : "pending"} />
              </div>
            ))}
          </div>
        </SidePanel>
      </div>
    </section>
  );
}
