import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { renderTelegramTemplate, resolveTelegramMediaUrl, selectTelegramTemplate, telegramKeyboardButtons } from "@/lib/telegram-preview";
import { mockApi } from "@/services/mock-api";
import { Button } from "./Button";
import { Card } from "./Card";

interface NotificationModalProps {
  open: boolean;
  studentId: string;
  studentName: string;
  onClose: () => void;
}

const templates = [
  {
    value: "Davomat - Kelmadi",
    label: "Kelmagan",
    description: "Bugungi darsga kelmaganini yuboradi.",
    tone: "rose"
  },
  {
    value: "Davomat - Tayyor emas",
    label: "Tayyor emas",
    description: "Darsga tayyor emasligi haqida yuboradi.",
    tone: "amber"
  },
  {
    value: "Uy vazifasi - Bajarilmagan",
    label: "Uy vazifasi",
    description: "Uy vazifasi bajarilmaganini yuboradi.",
    tone: "sky"
  },
  {
    value: "To'lov - Qilinmagan",
    label: "To'lov",
    description: "To'lov eslatmasini yuboradi.",
    tone: "violet"
  }
] as const;

export function NotificationModal({ open, studentId, studentName, onClose }: NotificationModalProps) {
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState<(typeof templates)[number]["value"]>(templates[0].value);
  const { data: telegramSettings } = useQuery({
    queryKey: ["telegram-settings"],
    queryFn: mockApi.getTelegramSettings,
    enabled: open
  });
  const { data: studentDetail } = useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: () => mockApi.getStudentDetail(studentId),
    enabled: open
  });

  const sendMutation = useMutation({
    mutationFn: (nextTemplate: string) =>
      mockApi.sendNotification({
        studentId,
        studentName,
        template: nextTemplate
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
      toast.success("Telegram xabari yuborildi.");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message)
  });

  useEffect(() => {
    if (open) {
      setTemplate(templates[0].value);
    }
  }, [open, studentId]);

  const previewTemplate = selectTelegramTemplate(telegramSettings, template);
  const previewImage = resolveTelegramMediaUrl(telegramSettings?.notificationImageUrl);
  const previewText = renderTelegramTemplate(previewTemplate, {
    parent: studentDetail?.parentName ?? undefined,
    student: studentDetail?.fullName ?? studentName,
    group: studentDetail?.group ?? undefined,
    course: studentDetail?.course ?? undefined,
    schedule: studentDetail?.schedule ?? undefined,
    teacher: studentDetail?.teacherName ?? undefined,
    room: studentDetail?.room ?? undefined,
    monthly_fee: studentDetail?.monthlyFee ?? undefined,
    template
  });

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <Card className="flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[30px]">
        <div className="border-b border-border/80 px-5 py-5 sm:px-6">
          <div className="section-kicker">Notification Center</div>
          <h3 className="mt-3 font-display text-xl font-bold">Ota-onaga xabar yuborish</h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {studentName} uchun kerakli xabarni tanlang. Keyin bir tugma bilan Telegram botga yuborasiz.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr] xl:items-start">
            <div className="space-y-3">
              <label className="text-sm font-medium">Xabar turini tanlang</label>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                {templates.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTemplate(item.value)}
                    className={cn(
                      "rounded-[20px] border px-4 py-3 text-left transition-all",
                      template === item.value
                        ? "border-primary bg-primary/[0.08] shadow-[0_12px_24px_rgba(59,91,219,0.10)]"
                        : "border-border/80 bg-white/80 hover:border-primary/25 dark:bg-slate-950/60",
                      item.tone === "rose" && template === item.value && "border-rose-300 bg-rose-50/80 dark:bg-rose-950/20",
                      item.tone === "amber" && template === item.value && "border-amber-300 bg-amber-50/80 dark:bg-amber-950/20",
                      item.tone === "sky" && template === item.value && "border-sky-300 bg-sky-50/80 dark:bg-sky-950/20",
                      item.tone === "violet" && template === item.value && "border-violet-300 bg-violet-50/80 dark:bg-violet-950/20"
                    )}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium">Xabar ko'rinishi</label>
              <div className="rounded-[24px] border border-sky-200/60 bg-[linear-gradient(180deg,#eff6ff,#ffffff)] p-3.5 dark:border-sky-900/40 dark:bg-[linear-gradient(180deg,#0f172a,#020617)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-500">Telegram preview</div>
                <div className={cn("mt-3 grid gap-3", previewImage ? "lg:grid-cols-[180px_minmax(0,1fr)]" : "")}>
                  {previewImage ? (
                    <div className="overflow-hidden rounded-[22px] border border-border/80 bg-slate-950/90">
                      <img src={previewImage} alt="Telegram preview" className="h-24 w-full object-cover lg:h-full" />
                    </div>
                  ) : null}
                  <div className="space-y-3 rounded-[22px] bg-white/92 p-3 shadow-sm dark:bg-slate-950/70">
                    <div className="rounded-[18px] border border-sky-100 bg-sky-50/80 p-3 text-sm leading-6 text-slate-700 dark:border-sky-900/30 dark:bg-slate-900/80 dark:text-slate-200">
                      <div className="whitespace-pre-wrap">{previewText}</div>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-100/80 p-2.5 shadow-inner dark:border-slate-800 dark:bg-slate-950/90">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Keyboard preview</div>
                      <div className="space-y-2">
                        {telegramKeyboardButtons.map((row, rowIndex) => (
                          <div key={`keyboard-row-${rowIndex}`} className="grid grid-cols-2 gap-2">
                            {row.map((label) => (
                              <div
                                key={label}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                              >
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
              {!telegramSettings?.enabled ? <div className="text-sm text-rose-500">Telegram bot hozir o'chirilgan.</div> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-border/80 bg-white/92 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:bg-slate-950/92">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Yopish
          </Button>
          <Button
            disabled={!telegramSettings?.enabled || sendMutation.isPending}
            loading={sendMutation.isPending}
            className="w-full sm:w-auto"
            onClick={() => sendMutation.mutate(template)}
          >
            {sendMutation.isPending ? "Yuborilmoqda..." : "Shu xabarni yuborish"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
