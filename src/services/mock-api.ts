import type {
  AccountCreateResponse,
  AttendanceEntry,
  ChartDatum,
  CourseSummary,
  DashboardMetric,
  GroupSummary,
  NotificationEntry,
  PaymentEntry,
  PaymentReceipt,
  RecordPaymentResponse,
  Role,
  SessionUser,
  StudentDetail,
  StudentSummary,
  SystemMessageEntry,
  TelegramBotSettings,
  TeacherSummary
} from "@/types/domain";
import { getTodayIso } from "@/lib/date";
import { runtimeConfig } from "@/lib/runtime";
import { apiRequest } from "@/services/api-client";

const wait = (ms = 240) => new Promise((resolve) => setTimeout(resolve, ms));
const MOCK_STORAGE_PREFIX = "kurs-boshqaruv-mock:";

function readMockState<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${MOCK_STORAGE_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeMockState<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(`${MOCK_STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Ignore storage quota/privacy errors; mock mode can still run in memory.
  }
}

const TODAY = getTodayIso();

const attendancePresentStatuses = new Set([
  "present",
  "late",
  "excused",
  "not_prepared",
  "homework_not_done"
]);

const courseCatalog: Record<string, number> = {
  "Ingliz tili asoslari": 850000,
  "Matematika tezkor kursi": 920000,
  "IELTS intensiv": 1100000
};

const demoDirectory = {
  admin: {
    id: "admin-1",
    fullName: "Admin Demo",
    role: "ADMIN" as const,
    phone: "+998900000101",
    email: "jamshidjalolov6767@gmail.com"
  },
  teacher: {
    id: "teacher-1",
    fullName: "Teacher Demo",
    role: "TEACHER" as const,
    phone: "+998900000102",
    email: "teacher.demo@example.com"
  },
  student: {
    id: "student-1",
    fullName: "Student Demo",
    role: "STUDENT" as const,
    phone: "+998900000103",
    email: "student.demo@example.com",
    parentName: "Parent Demo",
    parentPhone: "+998900000201",
    parentTelegramHandle: "@parent_demo"
  }
} as const;

const studentsBase = [
  {
    id: demoDirectory.student.id,
    fullName: demoDirectory.student.fullName,
    phone: demoDirectory.student.phone,
    parentName: demoDirectory.student.parentName,
    parentPhone: demoDirectory.student.parentPhone,
    parentTelegramStatus: "connected" as const,
    parentTelegramHandle: demoDirectory.student.parentTelegramHandle,
    group: "ENG-401",
    course: "Ingliz tili asoslari",
    monthlyFee: 850000
  },
  {
    id: "student-2",
    fullName: "Malika Asadova",
    phone: "+998901110022",
    parentName: "Gulbahor Asadova",
    parentPhone: "+998901110023",
    parentTelegramStatus: "missing" as const,
    parentTelegramHandle: "",
    group: "ENG-401",
    course: "Ingliz tili asoslari",
    monthlyFee: 850000
  },
  {
    id: "student-3",
    fullName: "Jasur Karimov",
    phone: "+998907770011",
    parentName: "Karim Karimov",
    parentPhone: "+998907770012",
    parentTelegramStatus: "connected" as const,
    parentTelegramHandle: "@karim_parent",
    group: "MATH-220",
    course: "Matematika tezkor kursi",
    monthlyFee: 920000
  },
  {
    id: "student-4",
    fullName: "Mohira Tursunova",
    phone: "+998909991101",
    parentName: "Nigora Tursunova",
    parentPhone: "+998909991102",
    parentTelegramStatus: "connected" as const,
    parentTelegramHandle: "@mohira_parent",
    group: "MATH-220",
    course: "Matematika tezkor kursi",
    monthlyFee: 920000
  },
  {
    id: "student-5",
    fullName: "Bekzod Umarov",
    phone: "+998905551144",
    parentName: "Umida Umarova",
    parentPhone: "+998905551145",
    parentTelegramStatus: "connected" as const,
    parentTelegramHandle: "@umarova_parent",
    group: "IELTS-710",
    course: "IELTS intensiv",
    monthlyFee: 1100000
  },
  {
    id: "student-6",
    fullName: "Shahzoda Aliyeva",
    phone: "+998907001133",
    parentName: "Gavhar Aliyeva",
    parentPhone: "+998907001134",
    parentTelegramStatus: "connected" as const,
    parentTelegramHandle: "@shahzoda_parent",
    group: "IELTS-710",
    course: "IELTS intensiv",
    monthlyFee: 1100000
  }
];

const teachersBase = [
  {
    id: demoDirectory.teacher.id,
    fullName: demoDirectory.teacher.fullName,
    phone: demoDirectory.teacher.phone,
    specialization: "IELTS / Umumiy ingliz tili",
    status: "active" as const
  },
  {
    id: "teacher-2",
    fullName: "Diyor Qodirov",
    phone: "+998909009900",
    specialization: "Matematika",
    status: "active" as const
  }
];

const groupsBase = [
  {
    id: "group-1",
    name: "ENG-401",
    course: "Ingliz tili asoslari",
    teacherId: "teacher-1",
    teacher: demoDirectory.teacher.fullName,
    room: "A2 xona",
    schedule: "Du, Cho, Ju - 17:00",
    scheduleDays: ["Du", "Cho", "Ju"],
    scheduleTime: "17:00"
  },
  {
    id: "group-2",
    name: "MATH-220",
    course: "Matematika tezkor kursi",
    teacherId: "teacher-2",
    teacher: "Diyor Qodirov",
    room: "B1 xona",
    schedule: "Se, Pa, Sha - 15:30",
    scheduleDays: ["Se", "Pa", "Sha"],
    scheduleTime: "15:30"
  },
  {
    id: "group-3",
    name: "IELTS-710",
    course: "IELTS intensiv",
    teacherId: "teacher-1",
    teacher: demoDirectory.teacher.fullName,
    room: "C3 xona",
    schedule: "Se, Pa, Sha - 18:30",
    scheduleDays: ["Se", "Pa", "Sha"],
    scheduleTime: "18:30"
  }
];

const attendance: AttendanceEntry[] = [
  { id: "att-1", date: "2026-04-07", studentName: demoDirectory.student.fullName, group: "ENG-401", status: "present", homeworkScore: 90, dailyGrade: 5 },
  { id: "att-2", date: "2026-04-09", studentName: demoDirectory.student.fullName, group: "ENG-401", status: "late", comment: "8 daqiqa kechikdi", homeworkScore: 75, dailyGrade: 4 },
  { id: "att-3", date: "2026-04-11", studentName: demoDirectory.student.fullName, group: "ENG-401", status: "not_prepared", comment: "Daftar va kitobsiz keldi", homeworkScore: 40, dailyGrade: 3 },
  { id: "att-4", date: "2026-04-07", studentName: "Malika Asadova", group: "ENG-401", status: "present", homeworkScore: 100, dailyGrade: 5 },
  { id: "att-5", date: "2026-04-09", studentName: "Malika Asadova", group: "ENG-401", status: "present", homeworkScore: 95, dailyGrade: 5 },
  { id: "att-6", date: "2026-04-11", studentName: "Malika Asadova", group: "ENG-401", status: "present", homeworkScore: 90, dailyGrade: 5 },
  { id: "att-7", date: "2026-04-08", studentName: "Jasur Karimov", group: "MATH-220", status: "present", homeworkScore: 85 },
  { id: "att-8", date: "2026-04-10", studentName: "Jasur Karimov", group: "MATH-220", status: "homework_not_done", comment: "Uy vazifasi to'liq emas", homeworkScore: 20 },
  { id: "att-9", date: "2026-04-11", studentName: "Jasur Karimov", group: "MATH-220", status: "late", comment: "12 daqiqa kechikdi", homeworkScore: 70 },
  { id: "att-10", date: "2026-04-08", studentName: "Mohira Tursunova", group: "MATH-220", status: "absent", comment: "Sababsiz kelmadi", homeworkScore: 0 },
  { id: "att-11", date: "2026-04-10", studentName: "Mohira Tursunova", group: "MATH-220", status: "present", homeworkScore: 88 },
  { id: "att-12", date: "2026-04-11", studentName: "Mohira Tursunova", group: "MATH-220", status: "absent", comment: "Bugun ham kelmadi", homeworkScore: 0 },
  { id: "att-13", date: "2026-04-08", studentName: "Bekzod Umarov", group: "IELTS-710", status: "present", homeworkScore: 92, dailyGrade: 5 },
  { id: "att-14", date: "2026-04-10", studentName: "Bekzod Umarov", group: "IELTS-710", status: "excused", comment: "Tibbiy ma'lumotnoma bor", homeworkScore: null },
  { id: "att-15", date: "2026-04-11", studentName: "Bekzod Umarov", group: "IELTS-710", status: "present", homeworkScore: 100 },
  { id: "att-16", date: "2026-04-08", studentName: "Shahzoda Aliyeva", group: "IELTS-710", status: "present", homeworkScore: 85 },
  { id: "att-17", date: "2026-04-10", studentName: "Shahzoda Aliyeva", group: "IELTS-710", status: "absent", comment: "Ota-onaga qo'ng'iroq qilingan", homeworkScore: 0 },
  { id: "att-18", date: "2026-04-11", studentName: "Shahzoda Aliyeva", group: "IELTS-710", status: "present", homeworkScore: 80 }
];

const paymentRecords = [
  {
    id: "pay-1",
    studentId: "student-1",
    studentName: demoDirectory.student.fullName,
    month: "2026-yil mart",
    amount: 850000,
    dueDate: "2026-03-05",
    status: "paid" as const,
    method: "Naqd"
  },
  {
    id: "pay-2",
    studentId: "student-1",
    studentName: demoDirectory.student.fullName,
    month: "2026-yil aprel",
    amount: 0,
    dueDate: "2026-04-05",
    status: "overdue" as const,
    method: "Karta"
  },
  {
    id: "pay-3",
    studentId: "student-2",
    studentName: "Malika Asadova",
    month: "2026-yil aprel",
    amount: 850000,
    dueDate: "2026-04-05",
    status: "paid" as const,
    method: "Naqd"
  },
  {
    id: "pay-4",
    studentId: "student-3",
    studentName: "Jasur Karimov",
    month: "2026-yil aprel",
    amount: 460000,
    dueDate: "2026-04-05",
    status: "partial" as const,
    method: "Bank o'tkazmasi"
  },
  {
    id: "pay-5",
    studentId: "student-4",
    studentName: "Mohira Tursunova",
    month: "2026-yil aprel",
    amount: 0,
    dueDate: "2026-04-05",
    status: "unpaid" as const,
    method: "Naqd"
  },
  {
    id: "pay-6",
    studentId: "student-5",
    studentName: "Bekzod Umarov",
    month: "2026-yil aprel",
    amount: 1100000,
    dueDate: "2026-04-05",
    status: "paid" as const,
    method: "Karta"
  },
  {
    id: "pay-7",
    studentId: "student-6",
    studentName: "Shahzoda Aliyeva",
    month: "2026-yil mart",
    amount: 1100000,
    dueDate: "2026-03-05",
    status: "paid" as const,
    method: "Karta"
  },
  {
    id: "pay-8",
    studentId: "student-6",
    studentName: "Shahzoda Aliyeva",
    month: "2026-yil aprel",
    amount: 0,
    dueDate: "2026-04-05",
    status: "overdue" as const,
    method: "Karta"
  }
];

function getPaymentExpectedAmount(studentId: string, studentName?: string) {
  return studentsBase.find((item) => item.id === studentId)?.monthlyFee ?? studentsBase.find((item) => item.fullName === studentName)?.monthlyFee ?? 0;
}

function getPaymentStatus(expectedAmount: number, paidAmount: number, dueDate: string): PaymentEntry["status"] {
  if (expectedAmount <= 0) {
    return paidAmount > 0 ? "paid" : "unpaid";
  }

  if (expectedAmount > 0 && paidAmount >= expectedAmount) {
    return "paid";
  }

  if (paidAmount > 0) {
    return "partial";
  }

  if (dueDate < TODAY) {
    return "overdue";
  }

  return "unpaid";
}

function getPaymentStatusNote(expectedAmount: number, paidAmount: number, dueDate: string) {
  const status = getPaymentStatus(expectedAmount, paidAmount, dueDate);

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

function toPaymentEntry(item: (typeof paymentRecords)[number]): PaymentEntry {
  const expectedAmount = getPaymentExpectedAmount(item.studentId, item.studentName);
  const status = getPaymentStatus(expectedAmount, item.amount, item.dueDate);
  const remainingAmount = Math.max(expectedAmount - item.amount, 0);

  return {
    id: item.id,
    studentId: item.studentId,
    studentName: item.studentName,
    month: item.month,
    amount: formatMoney(item.amount),
    expectedAmount: formatMoney(expectedAmount),
    remainingAmount: formatMoney(remainingAmount),
    dueDate: item.dueDate,
    status,
    statusNote: getPaymentStatusNote(expectedAmount, item.amount, item.dueDate),
    method: item.method
  };
}

function getStudentPaymentStatus(studentId: string): PaymentEntry["status"] {
  const rows = paymentRecords
    .filter((item) => item.studentId === studentId)
    .map((item) => getPaymentStatus(getPaymentExpectedAmount(item.studentId, item.studentName), item.amount, item.dueDate));

  if (!rows.length) {
    return "unpaid";
  }

  if (rows.includes("overdue")) {
    return "overdue";
  }

  if (rows.includes("partial")) {
    return "partial";
  }

  if (rows.includes("unpaid")) {
    return "unpaid";
  }

  return "paid";
}

const teacherNotes = [
  {
    id: "note-1",
    studentName: demoDirectory.student.fullName,
    date: "2026-04-11",
    tag: "NOT_PREPARED",
    comment: "Bugun daftar, kitob va qalam to'liq emas edi."
  },
  {
    id: "note-2",
    studentName: demoDirectory.student.fullName,
    date: "2026-04-09",
    tag: "GOOD_ACTIVITY",
    comment: "Speaking mashg'ulotida yaxshi qatnashdi."
  },
  {
    id: "note-3",
    studentName: "Malika Asadova",
    date: "2026-04-11",
    tag: "EXCELLENT_PARTICIPATION",
    comment: "Bugungi darsda faolligi juda yaxshi bo'ldi."
  },
  {
    id: "note-4",
    studentName: "Jasur Karimov",
    date: "2026-04-10",
    tag: "HOMEWORK_NOT_DONE",
    comment: "Uy vazifasi 50 foiz bajarilgan."
  },
  {
    id: "note-5",
    studentName: "Mohira Tursunova",
    date: "2026-04-11",
    tag: "PARENT_CALL_REQUIRED",
    comment: "Ikki marta ketma-ket dars qoldirdi."
  },
  {
    id: "note-6",
    studentName: "Shahzoda Aliyeva",
    date: "2026-04-10",
    tag: "LOW_DISCIPLINE",
    comment: "Darsdan oldin kech javob berdi, nazorat kerak."
  }
];

const homeworkByStudent: Record<string, StudentDetail["homework"]> = {
  "student-1": [
    { id: "hw-1", title: "5-bo'lim lug'at mashqi", dueDate: "2026-04-13", status: "pending" },
    { id: "hw-2", title: "Listening practice 3", dueDate: "2026-04-10", status: "submitted" }
  ],
  "student-2": [
    { id: "hw-3", title: "Grammar workbook 8-bet", dueDate: "2026-04-13", status: "submitted" },
    { id: "hw-4", title: "Reading check-list", dueDate: "2026-04-15", status: "pending" }
  ],
  "student-3": [
    { id: "hw-5", title: "Tenglamalar to'plami", dueDate: "2026-04-12", status: "pending" },
    { id: "hw-6", title: "Geometriya savollari", dueDate: "2026-04-09", status: "submitted" }
  ],
  "student-4": [
    { id: "hw-7", title: "Kasrlar amaliyoti", dueDate: "2026-04-12", status: "pending" }
  ],
  "student-5": [
    { id: "hw-8", title: "Essay task 2", dueDate: "2026-04-14", status: "submitted" }
  ],
  "student-6": [
    { id: "hw-9", title: "Reading test 5", dueDate: "2026-04-12", status: "pending" }
  ]
};

let notifications: NotificationEntry[] = [
  {
    id: "notif-1",
    studentName: demoDirectory.student.fullName,
    channel: "Telegram",
    template: "Davomat - Tayyor emas",
    recipient: "@zarina_parent",
    status: "sent",
    sentAt: "2026-04-11 13:22"
  },
  {
    id: "notif-2",
    studentName: "Mohira Tursunova",
    channel: "Telegram",
    template: "Davomat - Kelmadi",
    recipient: "@mohira_parent",
    status: "sent",
    sentAt: "2026-04-11 10:08"
  },
  {
    id: "notif-3",
    studentName: "Shahzoda Aliyeva",
    channel: "Telegram",
    template: "To'lov - Qilinmagan",
    recipient: "@shahzoda_parent",
    status: "sent",
    sentAt: "2026-04-10 19:08"
  },
  {
    id: "notif-4",
    studentName: "Jasur Karimov",
    channel: "Telegram",
    template: "Uy vazifasi - Bajarilmagan",
    recipient: "@karim_parent",
    status: "sent",
    sentAt: "2026-04-10 18:16"
  }
];

let systemMessages: Array<SystemMessageEntry & { studentId: string }> = [
  {
    id: "msg-1",
    studentId: "student-1",
    title: "Guruhga biriktirildingiz",
    body: "Siz ENG-401 guruhiga muvaffaqiyatli biriktirildingiz. Dars jadvalini tekshirib chiqing.",
    createdAt: "2026-04-09 09:00"
  },
  {
    id: "msg-2",
    studentId: "student-1",
    title: "To'lov holati yangilandi",
    body: "2026-yil aprel oyi uchun to'lov holatingiz yangilandi.",
    createdAt: "2026-04-10 18:40"
  }
];

let telegramSettings: TelegramBotSettings = {
  enabled: false,
  botUsername: "",
  hasBotToken: false,
  welcomeText:
    "Assalomu alaykum, {parent}.\n\n{student} uchun ota-ona paneli muvaffaqiyatli ulandi.\n\nGuruh: {group}\nKurs: {course}\nJadval: {schedule}\nO'qituvchi: {teacher}\nXona: {room}\n\nPastdagi tugmalar orqali kerakli ma'lumotlarni tez ochishingiz mumkin.",
  welcomeImageUrl: "builtin://parent-welcome-premium",
  notificationImageUrl: "builtin://parent-alert-premium",
  attendanceTemplate: "Davomat yangilandi\n\nO'quvchi: {student}\nHolat: {template}\nGuruh: {group}\nJadval: {schedule}\nO'qituvchi: {teacher}",
  homeworkTemplate: "Uy vazifasi bo'yicha xabar\n\nO'quvchi: {student}\nHolat: {template}\nGuruh: {group}\nKurs: {course}\nJadval: {schedule}",
  paymentTemplate: "To'lov eslatmasi\n\nO'quvchi: {student}\nHolat: {template}\nGuruh: {group}\nKurs: {course}\nOylik: {monthly_fee}",
  lastUpdateId: 0
};

function normalizedBotUsername() {
  return String(telegramSettings.botUsername || "").trim().replace(/^@/, "");
}

function buildParentConnectUrl(studentId: string) {
  const botUsername = normalizedBotUsername();
  return botUsername ? `https://t.me/${botUsername}?start=parent_${studentId}` : null;
}

const demoUsers: Array<SessionUser & { password?: string }> = [
  {
    id: demoDirectory.admin.id,
    fullName: demoDirectory.admin.fullName,
    role: demoDirectory.admin.role,
    phone: demoDirectory.admin.phone,
    email: demoDirectory.admin.email,
    password: runtimeConfig.demoPassword || undefined
  },
  {
    id: demoDirectory.teacher.id,
    fullName: demoDirectory.teacher.fullName,
    role: demoDirectory.teacher.role,
    phone: demoDirectory.teacher.phone,
    email: demoDirectory.teacher.email,
    password: runtimeConfig.demoPassword || undefined
  },
  {
    id: demoDirectory.student.id,
    fullName: demoDirectory.student.fullName,
    role: demoDirectory.student.role,
    phone: demoDirectory.student.phone,
    email: demoDirectory.student.email,
    password: runtimeConfig.demoPassword || undefined
  }
];

function replaceArrayContents<T>(target: T[], next: T[] | null) {
  if (next?.length) {
    target.splice(0, target.length, ...next);
  }
}

function persistMockState() {
  writeMockState("courseCatalog", courseCatalog);
  writeMockState("students", studentsBase);
  writeMockState("teachers", teachersBase);
  writeMockState("groups", groupsBase);
  writeMockState("payments", paymentRecords);
  writeMockState("notifications", notifications);
  writeMockState("telegramSettings", telegramSettings);
  writeMockState("demoUsers", demoUsers);
}

function hydrateMockState() {
  const savedCourseCatalog = readMockState<Record<string, number>>("courseCatalog");
  if (savedCourseCatalog) {
    Object.assign(courseCatalog, savedCourseCatalog);
  }

  replaceArrayContents(studentsBase, readMockState<typeof studentsBase>("students"));
  replaceArrayContents(teachersBase, readMockState<typeof teachersBase>("teachers"));
  replaceArrayContents(groupsBase, readMockState<typeof groupsBase>("groups"));
  replaceArrayContents(paymentRecords, readMockState<typeof paymentRecords>("payments"));
  replaceArrayContents(notifications, readMockState<typeof notifications>("notifications"));
  replaceArrayContents(demoUsers, readMockState<typeof demoUsers>("demoUsers"));

  const savedTelegramSettings = readMockState<TelegramBotSettings>("telegramSettings");
  if (savedTelegramSettings) {
    telegramSettings = { ...telegramSettings, ...savedTelegramSettings };
  }
}

hydrateMockState();

function formatMoney(amount: number) {
  return `${new Intl.NumberFormat("uz-UZ").format(amount)} so'm`;
}

function formatDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getWeekDayCode(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"][day];
}

function byDateDesc<T extends { date: string }>(items: T[]) {
  return [...items].sort((left, right) => right.date.localeCompare(left.date));
}

function byDueDateDesc(items: PaymentEntry[]) {
  return [...items].sort((left, right) => right.dueDate.localeCompare(left.dueDate));
}

function bySentAtDesc(items: NotificationEntry[]) {
  return [...items].sort((left, right) => right.sentAt.localeCompare(left.sentAt));
}

function isAttended(status: AttendanceEntry["status"]) {
  return attendancePresentStatuses.has(status);
}

function getStudentAttendance(studentName: string) {
  return byDateDesc(attendance.filter((item) => item.studentName === studentName));
}

function getStudentPayments(studentId: string): PaymentEntry[] {
  return byDueDateDesc(paymentRecords.filter((item) => item.studentId === studentId).map(toPaymentEntry));
}

function getStudentLatestPayment(studentId: string) {
  return getStudentPayments(studentId)[0];
}

function getStudentAttendancePercent(studentName: string) {
  const entries = getStudentAttendance(studentName);

  if (!entries.length) {
    return 0;
  }

  const attendedCount = entries.filter((item) => isAttended(item.status)).length;
  return Math.round((attendedCount / entries.length) * 100);
}

function getStudentLatestNote(studentName: string) {
  return [...teacherNotes]
    .filter((item) => item.studentName === studentName)
    .sort((left, right) => right.date.localeCompare(left.date))[0];
}

function getStudentSummaries(): StudentSummary[] {
  return studentsBase.map((student) => {
    const latestNote = getStudentLatestNote(student.fullName);

    return {
      id: student.id,
      fullName: student.fullName,
      phone: student.phone,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      parentTelegramStatus: student.parentTelegramStatus,
      parentTelegramConnectUrl: buildParentConnectUrl(student.id),
      group: student.group,
      course: student.course,
      attendancePercent: getStudentAttendancePercent(student.fullName),
      paymentStatus: getStudentPaymentStatus(student.id),
      monthlyFee: formatMoney(student.monthlyFee),
      lastTeacherNote: latestNote?.comment ?? "So'nggi izoh mavjud emas."
    };
  });
}

function getTeacherSummaries(): TeacherSummary[] {
  return teachersBase.map((teacher) => {
    const teacherGroupNames = groupsBase.filter((group) => group.teacherId === teacher.id).map((group) => group.name);
    const studentCount = studentsBase.filter((student) => teacherGroupNames.includes(student.group)).length;

    return {
      id: teacher.id,
      fullName: teacher.fullName,
      phone: teacher.phone,
      specialization: teacher.specialization,
      groups: teacherGroupNames,
      studentCount,
      status: teacher.status
    };
  });
}

function getGroupSummaries(): GroupSummary[] {
  const summaries = getStudentSummaries();

  return groupsBase.map((group) => {
    const groupStudents = summaries.filter((student) => student.group === group.name);

    return {
      id: group.id,
      name: group.name,
      course: group.course,
      teacher: group.teacher,
      room: group.room,
      schedule: group.schedule,
      students: groupStudents.length,
      unpaidStudents: groupStudents.filter((student) => student.paymentStatus !== "paid").length
    };
  });
}

function getCourseSummaries(): CourseSummary[] {
  return Object.entries(courseCatalog).map(([title, price]) => {
    const courseGroups = groupsBase.filter((group) => group.course === title);
    const studentCount = studentsBase.filter((student) => student.course === title).length;

    return {
      id: `course-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title,
      price: formatMoney(price),
      priceValue: price,
      groupCount: courseGroups.length,
      studentCount,
    };
  });
}

function getPayments(): PaymentEntry[] {
  return byDueDateDesc(paymentRecords.map(toPaymentEntry));
}

function getAttendanceChart(entries: AttendanceEntry[]): ChartDatum[] {
  const grouped = entries.reduce<Record<string, { attended: number; total: number }>>((acc, item) => {
    const bucket = acc[item.date] ?? { attended: 0, total: 0 };
    bucket.total += 1;

    if (isAttended(item.status)) {
      bucket.attended += 1;
    }

    acc[item.date] = bucket;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => ({
      label: date,
      value: Math.round((bucket.attended / bucket.total) * 100)
    }));
}

function getStudentProgress(studentId: string) {
  const student = studentsBase.find((item) => item.id === studentId);
  const attendancePercent = getStudentAttendancePercent(student?.fullName ?? "");
  const homework = homeworkByStudent[studentId] ?? [];
  const submittedCount = homework.filter((item) => item.status === "submitted").length;
  const homeworkPercent = homework.length ? Math.round((submittedCount / homework.length) * 100) : 0;
  return Math.round((attendancePercent + homeworkPercent) / 2);
}

function appendNotification(studentName: string, template: string) {
  const student = studentsBase.find((item) => item.fullName === studentName);

  if (!student || student.parentTelegramStatus === "missing") {
    throw new Error("Bu o'quvchi uchun ota-ona Telegram manzili ulanmagan.");
  }

  notifications = [
    {
      id: crypto.randomUUID(),
      studentName,
      channel: "Telegram",
      template,
      recipient: student.parentTelegramHandle,
      status: "sent",
      sentAt: formatDateTime(new Date())
    },
    ...notifications
  ];
  persistMockState();
}

function appendSystemMessage(studentId: string, title: string, body: string) {
  systemMessages = [
    {
      id: crypto.randomUUID(),
      studentId,
      title,
      body,
      createdAt: formatDateTime(new Date())
    },
    ...systemMessages
  ];
}

function getAttendanceTemplate(status: AttendanceEntry["status"]) {
  const templates: Partial<Record<AttendanceEntry["status"], string>> = {
    absent: "Davomat - Kelmadi",
    late: "Davomat - Kechikdi",
    not_prepared: "Davomat - Tayyor emas",
    homework_not_done: "Uy vazifasi - Bajarilmagan"
  };

  return templates[status];
}

function getAttendanceNoteTag(status: AttendanceEntry["status"]) {
  const tags: Partial<Record<AttendanceEntry["status"], string>> = {
    late: "LATE",
    absent: "ABSENT",
    excused: "EXCUSED",
    not_prepared: "NOT_PREPARED",
    homework_not_done: "HOMEWORK_NOT_DONE"
  };

  return tags[status];
}

function getDefaultAttendanceComment(status: AttendanceEntry["status"]) {
  const comments: Partial<Record<AttendanceEntry["status"], string>> = {
    present: "O'z vaqtida darsda qatnashdi.",
    absent: "Bugungi darsga kelmadi.",
    late: "Darsga kechikib keldi.",
    excused: "Sababli ravishda darsda qatnasha olmadi.",
    not_prepared: "Darsga tayyor emas holatda keldi.",
    homework_not_done: "Uy vazifasini bajarmagan."
  };

  return comments[status] ?? "Holat yangilandi.";
}

function getStudentMessages(studentId: string): SystemMessageEntry[] {
  return [...systemMessages]
    .filter((item) => item.studentId === studentId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(({ id, title, body, createdAt }) => ({
      id,
      title,
      body,
      createdAt
    }));
}

function getAdminMetrics(): DashboardMetric[] {
  const studentSummaries = getStudentSummaries();
  const currentMonthPrefix = TODAY.slice(0, 7);
  const monthlyIncome = paymentRecords.filter((item) => item.dueDate.startsWith(currentMonthPrefix)).reduce((total, item) => total + item.amount, 0);
  const absentToday = attendance.filter((item) => item.date === TODAY && item.status === "absent").length;

  return [
    {
      label: "Jami o'quvchilar",
      value: String(studentSummaries.length),
      change: `${studentSummaries.filter((item) => item.parentTelegramStatus === "connected").length} tasi ota-onasi bilan bog'langan`,
      tone: "primary"
    },
    {
      label: "Jami o'qituvchilar",
      value: String(getTeacherSummaries().length),
      change: `${getGroupSummaries().length} ta faol guruh ishlayapti`,
      tone: "success"
    },
    {
      label: "Oylik tushum",
      value: formatMoney(monthlyIncome),
      change: `${paymentRecords.filter((item) => item.amount > 0).length} ta to'lov yozuvi bor`,
      tone: "success"
    },
    {
      label: "Bugun kelmaganlar",
      value: String(absentToday),
      change: `${studentSummaries.filter((item) => item.paymentStatus !== "paid").length} nafar xavfli o'quvchi bor`,
      tone: "danger"
    }
  ];
}

function getTeacherMetrics(teacherId: string): DashboardMetric[] {
  const teacherGroups = groupsBase.filter((group) => group.teacherId === teacherId);
  const teacherGroupNames = teacherGroups.map((group) => group.name);
  const teacherStudents = getStudentSummaries().filter((student) => teacherGroupNames.includes(student.group));
  const teacherAttendanceToday = attendance.filter((item) => item.date === TODAY && teacherGroupNames.includes(item.group));
  const todayLessons = teacherGroups.filter((group) => group.scheduleDays.includes(getWeekDayCode(TODAY))).length;

  return [
    {
      label: "Bugungi darslar",
      value: String(todayLessons),
      change: teacherGroups
        .filter((group) => group.scheduleDays.includes(getWeekDayCode(TODAY)))
        .map((group) => group.name)
        .join(", ") || "Bugun dars yo'q",
      tone: "primary"
    },
    {
      label: "Biriktirilgan guruhlar",
      value: String(teacherGroups.length),
      change: `${teacherStudents.length} nafar o'quvchi nazoratda`,
      tone: "success"
    },
    {
      label: "Bugun kelmaganlar",
      value: String(teacherAttendanceToday.filter((item) => item.status === "absent").length),
      change: `${teacherAttendanceToday.filter((item) => item.status === "late").length} nafar kechikkan`,
      tone: "warning"
    },
    {
      label: "To'lamaganlar",
      value: String(teacherStudents.filter((item) => item.paymentStatus !== "paid").length),
      change: `${teacherStudents.filter((item) => item.paymentStatus === "overdue").length} nafar muddati o'tgan`,
      tone: "danger"
    }
  ];
}

function getStudentMetrics(studentId: string): DashboardMetric[] {
  const student = studentsBase.find((item) => item.id === studentId) ?? studentsBase[0];
  const attendancePercent = getStudentAttendancePercent(student.fullName);
  const latestPayment = getStudentLatestPayment(student.id);
  const homework = homeworkByStudent[studentId] ?? [];
  const pendingHomework = homework.filter((item) => item.status === "pending").length;

  return [
    {
      label: "Davomat",
      value: `${attendancePercent}%`,
      change: `${getStudentAttendance(student.fullName).length} ta so'nggi dars hisoblandi`,
      tone: attendancePercent >= 85 ? "success" : "warning"
    },
    {
      label: "To'lov holati",
      value:
        latestPayment?.status === "paid"
          ? "To'langan"
          : latestPayment?.status === "partial"
            ? "Qisman"
            : latestPayment?.status === "overdue"
              ? "Qarzdorlik"
              : "To'lanmagan",
      change: latestPayment ? `${latestPayment.month} holati` : "To'lov yozuvi topilmadi",
      tone: latestPayment?.status === "paid" ? "success" : "warning"
    },
    {
      label: "Uy vazifasi",
      value: `${homework.length - pendingHomework}/${homework.length || 0}`,
      change: `${pendingHomework} ta vazifa kutilmoqda`,
      tone: pendingHomework ? "warning" : "primary"
    },
    {
      label: "O'sish",
      value: `${getStudentProgress(studentId)}%`,
      change: "Davomat va vazifa asosida hisoblandi",
      tone: "primary"
    }
  ];
}

function getDashboardChart(role: Role): ChartDatum[] {
  if (role === "ADMIN") {
    return getAttendanceChart(attendance);
  }

  if (role === "TEACHER") {
    const teacherGroups = groupsBase.filter((group) => group.teacherId === "teacher-1").map((group) => group.name);
    return getAttendanceChart(attendance.filter((item) => teacherGroups.includes(item.group)));
  }

  return getAttendanceChart(getStudentAttendance(demoDirectory.student.fullName));
}

function getPaymentDashboardChart(): ChartDatum[] {
  const grouped = paymentRecords.reduce<Record<string, { value: number; dueDate: string }>>((acc, item) => {
    const current = acc[item.month] ?? { value: 0, dueDate: item.dueDate };
    current.value += item.amount;
    if (item.dueDate < current.dueDate) {
      current.dueDate = item.dueDate;
    }

    acc[item.month] = current;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort((left, right) => left[1].dueDate.localeCompare(right[1].dueDate))
    .map(([label, bucket]) => ({ label, value: bucket.value }));
}

export const mockApi = {
  async login(identifier: string, password: string) {
    await wait();
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const user = demoUsers.find((item) => item.phone === identifier.trim() || item.email?.toLowerCase() === normalizedIdentifier);

    if (!user || !normalizedPassword) {
      throw new Error("Telefon raqami, email yoki parol noto'g'ri.");
    }

    if (user.password && user.password !== normalizedPassword) {
      throw new Error("Telefon raqami, email yoki parol noto'g'ri.");
    }

    const { password: _password, ...safeUser } = user;
    return {
      user: safeUser,
      accessToken: "demo-access-token"
    };
  },

  async register() {
    await wait();
    return {
      message: "Ochiq ro'yxatdan o'tish o'chirilgan. Admin akkaunt yaratadi."
    };
  },

  async getDashboardMetrics(role: Role) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{
        metrics: DashboardMetric[];
        chart: ChartDatum[];
        paymentChart?: ChartDatum[];
        activities: NotificationEntry[];
      }>(`/dashboard?role=${role}`);
    }

    await wait();

    const metricsByRole: Record<Role, DashboardMetric[]> = {
      ADMIN: getAdminMetrics(),
      TEACHER: getTeacherMetrics("teacher-1"),
      STUDENT: getStudentMetrics("student-1")
    };

    return {
      metrics: metricsByRole[role],
      chart: getDashboardChart(role),
      paymentChart: role === "ADMIN" ? getPaymentDashboardChart() : getDashboardChart(role),
      activities: bySentAtDesc(notifications).slice(0, 5)
    };
  },

  async getStudents() {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<StudentSummary[]>("/students");
    }

    await wait();
    return getStudentSummaries();
  },

  async getStudentDetail(id: string): Promise<StudentDetail> {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<StudentDetail>(`/students/${id}`);
    }

    await wait();
    const selected = studentsBase.find((item) => item.id === id) ?? studentsBase[0];
    const selectedGroup = groupsBase.find((item) => item.name === selected.group);

    return {
      id: selected.id,
      fullName: selected.fullName,
      phone: selected.phone,
      parentName: selected.parentName,
      parentPhone: selected.parentPhone,
      parentTelegramStatus: selected.parentTelegramStatus,
      parentTelegramHandle: selected.parentTelegramHandle,
      parentTelegramConnectUrl: buildParentConnectUrl(selected.id),
      monthlyFee: formatMoney(selected.monthlyFee),
      group: selected.group,
      course: selected.course,
      teacherName: selectedGroup?.teacher ?? "Biriktirilmagan",
      room: selectedGroup?.room ?? "Biriktirilmagan",
      schedule: selectedGroup?.schedule ?? "Jadval biriktirilmagan",
      scheduleDays: selectedGroup?.scheduleDays ?? [],
      scheduleTime: selectedGroup?.scheduleTime ?? null,
      groupAssignments: selectedGroup
        ? [
            {
              id: selectedGroup.id,
              name: selectedGroup.name,
              course: selectedGroup.course,
              teacherName: selectedGroup.teacher,
              room: selectedGroup.room,
              schedule: selectedGroup.schedule,
              scheduleDays: selectedGroup.scheduleDays,
              scheduleTime: selectedGroup.scheduleTime
            }
          ]
        : [],
      attendanceTimeline: getStudentAttendance(selected.fullName),
      payments: getStudentPayments(selected.id),
      notes: [...teacherNotes]
        .filter((item) => item.studentName === selected.fullName)
        .sort((left, right) => right.date.localeCompare(left.date))
        .map((item) => ({
          id: item.id,
          date: item.date,
          tag: item.tag,
          comment: item.comment
        })),
      homework: homeworkByStudent[selected.id] ?? [],
      messages: getStudentMessages(selected.id)
    };
  },

  async getTeachers() {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<TeacherSummary[]>("/teachers");
    }

    await wait();
    return getTeacherSummaries();
  },

  async getGroups() {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<GroupSummary[]>("/groups");
    }

    await wait();
    return getGroupSummaries();
  },

  async getCourses() {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<CourseSummary[]>("/courses");
    }

    await wait();
    return getCourseSummaries();
  },

  async getAttendance() {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<AttendanceEntry[]>("/attendance");
    }

    await wait();
    return byDateDesc(attendance);
  },

  async getPayments() {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<PaymentEntry[]>("/payments");
    }

    await wait();
    return getPayments();
  },

  async getNotifications() {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<NotificationEntry[]>("/notifications");
    }

    await wait();
    return bySentAtDesc(notifications);
  },

  async getTelegramSettings() {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<TelegramBotSettings>("/telegram/settings");
    }

    await wait();
    return telegramSettings;
  },

  async updateTelegramSettings(payload: {
    enabled: boolean;
    botUsername?: string;
    botToken?: string;
    welcomeText: string;
    welcomeImageUrl?: string;
    notificationImageUrl?: string;
    attendanceTemplate: string;
    homeworkTemplate: string;
    paymentTemplate: string;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<TelegramBotSettings>("/telegram/settings", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    }

    await wait();
    telegramSettings = {
      ...telegramSettings,
      ...payload,
      hasBotToken: telegramSettings.hasBotToken || Boolean(payload.botToken),
      botUsername: payload.botUsername !== undefined ? payload.botUsername.trim().replace(/^@/, "") : telegramSettings.botUsername
    };
    persistMockState();
    return telegramSettings;
  },

  async syncTelegramBot() {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ connected: number; updates: number }>("/telegram/sync", {
        method: "POST"
      });
    }

    await wait();
    return { connected: 0, updates: 0 };
  },

  async createTeacher(payload: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    specialization?: string;
  }): Promise<AccountCreateResponse & { teacherId?: string }> {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<AccountCreateResponse & { teacherId: string }>("/teachers/", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const normalizedPhone = payload.phone.trim();
    const normalizedEmail = payload.email?.trim().toLowerCase() || undefined;

    if (demoUsers.some((item) => item.phone === normalizedPhone || (normalizedEmail && item.email === normalizedEmail))) {
      throw new Error("Bu telefon yoki email bilan foydalanuvchi allaqachon mavjud.");
    }

    const nextTeacherId = `teacher-${crypto.randomUUID().slice(0, 8)}`;
    teachersBase.unshift({
      id: nextTeacherId,
      fullName: payload.fullName.trim(),
      phone: normalizedPhone,
      specialization: payload.specialization?.trim() || "-",
      status: "active"
    });
    demoUsers.unshift({
      id: nextTeacherId,
      fullName: payload.fullName.trim(),
      role: "TEACHER",
      phone: normalizedPhone,
      email: normalizedEmail,
      password: payload.password
    });
    persistMockState();

    return {
      success: true,
      teacherId: nextTeacherId,
      message: `${payload.fullName.trim()} o'qituvchi sifatida qo'shildi.`,
      loginIdentifier: normalizedEmail || normalizedPhone,
      password: payload.password
    };
  },

  async createStudent(payload: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    course?: string;
    parentTelegramHandle?: string;
  }): Promise<AccountCreateResponse & { studentId?: string }> {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<AccountCreateResponse & { studentId: string }>("/students/", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const normalizedPhone = payload.phone.trim();
    const normalizedEmail = payload.email?.trim().toLowerCase() || undefined;
    const course = payload.course?.trim() || "Biriktirilmagan";
    const nextStudentId = `student-${crypto.randomUUID().slice(0, 8)}`;

    if (demoUsers.some((item) => item.phone === normalizedPhone || (normalizedEmail && item.email === normalizedEmail))) {
      throw new Error("Bu telefon yoki email bilan foydalanuvchi allaqachon mavjud.");
    }

    studentsBase.unshift({
      id: nextStudentId,
      fullName: payload.fullName.trim(),
      phone: normalizedPhone,
      parentName: "",
      parentPhone: "",
      parentTelegramStatus: payload.parentTelegramHandle?.trim() ? "connected" : "missing",
      parentTelegramHandle: payload.parentTelegramHandle?.trim() || "",
      group: "Biriktirilmagan",
      course,
      monthlyFee: course in courseCatalog ? courseCatalog[course as keyof typeof courseCatalog] : 0
    });
    demoUsers.unshift({
      id: nextStudentId,
      fullName: payload.fullName.trim(),
      role: "STUDENT",
      phone: normalizedPhone,
      email: normalizedEmail,
      password: payload.password
    });
    persistMockState();

    return {
      success: true,
      studentId: nextStudentId,
      message: `${payload.fullName.trim()} o'quvchi sifatida qo'shildi.`,
      loginIdentifier: normalizedEmail || normalizedPhone,
      password: payload.password
    };
  },

  async createGroup(payload: {
    name: string;
    course: string;
    teacherId: string;
    room: string;
    schedule: string;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ success: boolean; groupId: string; message: string }>("/groups", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const teacher = teachersBase.find((item) => item.id === payload.teacherId);

    if (!teacher) {
      throw new Error("O'qituvchi topilmadi.");
    }

    const exists = groupsBase.some((item) => item.name.toLowerCase() === payload.name.trim().toLowerCase());

    if (exists) {
      throw new Error("Bu nomdagi guruh allaqachon mavjud.");
    }

    if (!courseCatalog[payload.course]) {
      throw new Error("Kurs topilmadi.");
    }

    const scheduleDays = payload.schedule
      .split("-")[0]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const scheduleTime = payload.schedule.split("-")[1]?.trim() || "";

    const nextGroup = {
      id: crypto.randomUUID(),
      name: payload.name.trim(),
      course: payload.course,
      teacherId: teacher.id,
      teacher: teacher.fullName,
      room: payload.room.trim(),
      schedule: payload.schedule,
      scheduleDays,
      scheduleTime
    };

    groupsBase.unshift(nextGroup);
    persistMockState();

    return {
      success: true,
      groupId: nextGroup.id,
      message: `${nextGroup.name} guruhi yaratildi.`
    };
  },

  async createCourse(payload: {
    title: string;
    price: number;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ success: boolean; courseId: string; message: string }>("/courses", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const title = payload.title.trim();
    if (!title) {
      throw new Error("Kurs nomini kiriting.");
    }
    if (payload.price <= 0) {
      throw new Error("Kurs narxini to'g'ri kiriting.");
    }
    if (courseCatalog[title]) {
      throw new Error("Bu nomdagi kurs allaqachon mavjud.");
    }

    courseCatalog[title] = payload.price;
    persistMockState();

    return {
      success: true,
      courseId: `course-${crypto.randomUUID().slice(0, 8)}`,
      message: `${title} kursi qo'shildi.`
    };
  },

  async assignStudentToGroup(payload: {
    studentId: string;
    groupId: string;
    notifyStudent?: boolean;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ success: boolean; message: string }>("/groups/assign-student", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const student = studentsBase.find((item) => item.id === payload.studentId);
    const group = groupsBase.find((item) => item.id === payload.groupId);

    if (!student) {
      throw new Error("O'quvchi topilmadi.");
    }

    if (!group) {
      throw new Error("Guruh topilmadi.");
    }

    if (student.group === group.name) {
      throw new Error(`${student.fullName} allaqachon ${group.name} guruhiga biriktirilgan.`);
    }

    student.group = group.name;
    student.course = group.course;
    student.monthlyFee = courseCatalog[group.course as keyof typeof courseCatalog];

    if (payload.notifyStudent) {
      appendSystemMessage(
        student.id,
        "Guruhga qo'shildingiz",
        `Siz ${group.name} guruhiga biriktirildingiz. Darslar ${group.schedule} jadvali asosida o'tadi.`
      );
    }
    persistMockState();

    return {
      success: true,
      message: `${student.fullName} ${group.name} guruhiga biriktirildi.`
    };
  },

  async unassignStudentFromGroup(payload: {
    studentId: string;
    groupId?: string;
    notifyStudent?: boolean;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ success: boolean; message: string }>("/groups/unassign-student", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const student = studentsBase.find((item) => item.id === payload.studentId);

    if (!student) {
      throw new Error("O'quvchi topilmadi.");
    }

    if (student.group === "Biriktirilmagan") {
      throw new Error(`${student.fullName} hozir hech qaysi guruhga biriktirilmagan.`);
    }

    if (payload.groupId) {
      const group = groupsBase.find((item) => item.id === payload.groupId);

      if (!group) {
        throw new Error("Guruh topilmadi.");
      }

      if (student.group !== group.name) {
        throw new Error(`${student.fullName} ${group.name} guruhida emas.`);
      }
    }

    const previousGroup = student.group;
    student.group = "Biriktirilmagan";

    if (payload.notifyStudent) {
      appendSystemMessage(
        student.id,
        "Guruhdan chiqarildingiz",
        `Siz ${previousGroup} guruhidan chiqarildingiz. Yangi guruh biriktirilgach bu yerda xabar ko'rinadi.`
      );
    }
    persistMockState();

    return {
      success: true,
      message: `${student.fullName} ${previousGroup} guruhidan chiqarildi.`
    };
  },

  async markGroupAttendance(payload: {
    groupId: string;
    date: string;
    lessonTopic?: string;
    homeworkTitle?: string;
    homeworkDueDate?: string;
    entries: Array<{
      studentId: string;
      status: AttendanceEntry["status"];
      comment?: string;
      sendNotification?: boolean;
    }>;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ success: boolean; message: string }>("/attendance/group", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const group = groupsBase.find((item) => item.id === payload.groupId);

    if (!group) {
      throw new Error("Guruh topilmadi.");
    }

    if (payload.date !== TODAY) {
      throw new Error("Davomatni faqat o'sha kuni tahrirlash mumkin.");
    }

    const students = studentsBase.filter((item) => item.group === group.name);
    const cleanedLessonTopic = payload.lessonTopic?.trim() || undefined;
    const cleanedHomeworkTitle = payload.homeworkTitle?.trim() || undefined;
    const homeworkDueDate = payload.homeworkDueDate || payload.date;

    payload.entries.forEach((entry) => {
      const student = students.find((item) => item.id === entry.studentId);

      if (!student) {
        return;
      }

      const cleanedComment = entry.comment?.trim() || getDefaultAttendanceComment(entry.status);
      const existingEntry = attendance.find(
        (item) => item.studentName === student.fullName && item.group === group.name && item.date === payload.date
      );

      if (existingEntry) {
        const previousStatus = existingEntry.status;
        existingEntry.lessonTopic = cleanedLessonTopic;
        existingEntry.status = entry.status;
        existingEntry.comment = cleanedComment;
        existingEntry.homeworkScore = entry.status === "absent" ? 0 : previousStatus === "absent" && existingEntry.homeworkScore === 0 ? null : existingEntry.homeworkScore;
        existingEntry.homeworkComment = entry.status === "absent" ? undefined : existingEntry.homeworkComment;
        existingEntry.dailyGrade = entry.status === "absent" ? null : existingEntry.dailyGrade;
        existingEntry.dailyGradeComment = entry.status === "absent" ? undefined : existingEntry.dailyGradeComment;
      } else {
        attendance.unshift({
          id: crypto.randomUUID(),
          date: payload.date,
          studentName: student.fullName,
          group: group.name,
          lessonTopic: cleanedLessonTopic,
          status: entry.status,
          comment: cleanedComment,
          homeworkScore: entry.status === "absent" ? 0 : null
        });
      }

      const noteTag = getAttendanceNoteTag(entry.status);

      if (noteTag) {
        teacherNotes.unshift({
          id: crypto.randomUUID(),
          studentName: student.fullName,
          date: payload.date,
          tag: noteTag,
          comment: cleanedComment
        });
      }

      const template = entry.sendNotification ? getAttendanceTemplate(entry.status) : undefined;

      if (template && student.parentTelegramStatus === "connected") {
        appendNotification(student.fullName, template);
      }

      if (cleanedHomeworkTitle) {
        const bucket = homeworkByStudent[student.id] ?? [];
        bucket.unshift({
          id: crypto.randomUUID(),
          title: cleanedHomeworkTitle,
          dueDate: homeworkDueDate,
          status: "pending"
        });
        homeworkByStudent[student.id] = bucket;
      }
    });

    return {
      success: true,
      message: `${group.name} guruhi uchun ${payload.date} sanasidagi davomat saqlandi.`
    };
  },

  async saveAttendanceTopic(payload: {
    groupId: string;
    date: string;
    lessonTopic: string;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ success: boolean; message: string }>("/attendance/topic", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const group = groupsBase.find((item) => item.id === payload.groupId);

    if (!group) {
      throw new Error("Guruh topilmadi.");
    }

    if (payload.date !== TODAY) {
      throw new Error("Dars mavzusini faqat o'sha kuni tahrirlash mumkin.");
    }

    const cleanedLessonTopic = payload.lessonTopic.trim();

    if (!cleanedLessonTopic) {
      throw new Error("Dars mavzusini kiriting.");
    }

    const rows = attendance.filter((item) => item.group === group.name && item.date === payload.date);

    if (!rows.length) {
      throw new Error("Avval shu sana uchun davomatni saqlang.");
    }

    rows.forEach((row) => {
      row.lessonTopic = cleanedLessonTopic;
    });

    return {
      success: true,
      message: `${group.name} guruhi uchun dars mavzusi saqlandi.`
    };
  },

  async saveAttendanceHomework(payload: {
    groupId: string;
    date: string;
    entries: Array<{
      studentId: string;
      homeworkScore: number;
      homeworkComment?: string;
    }>;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ success: boolean; message: string }>("/attendance/homework", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const group = groupsBase.find((item) => item.id === payload.groupId);

    if (!group) {
      throw new Error("Guruh topilmadi.");
    }

    if (payload.date !== TODAY) {
      throw new Error("Uy vazifasi bahosini faqat o'sha kuni kiritish mumkin.");
    }

    if (!payload.entries.length) {
      throw new Error("Saqlash uchun homework bahosi tanlanmagan.");
    }

    payload.entries.forEach((entry) => {
      const student = studentsBase.find((item) => item.id === entry.studentId);

      if (!student) {
        throw new Error("O'quvchi topilmadi.");
      }

      const attendanceEntry = attendance.find(
        (item) => item.studentName === student.fullName && item.group === group.name && item.date === payload.date
      );

      if (!attendanceEntry) {
        throw new Error("Avval shu sana uchun davomatni saqlang.");
      }

      if (attendanceEntry.homeworkScore !== null && attendanceEntry.homeworkScore !== undefined) {
        throw new Error(`${student.fullName} uchun homework bahosi allaqachon qo'yilgan.`);
      }

      attendanceEntry.homeworkScore = entry.homeworkScore;
      attendanceEntry.homeworkComment = entry.homeworkComment?.trim() || undefined;
    });

    return {
      success: true,
      message: `${group.name} guruhi uchun homework baholari saqlandi.`
    };
  },

  async saveAttendanceDailyGrade(payload: {
    groupId: string;
    date: string;
    entries: Array<{
      studentId: string;
      dailyGrade: number;
      dailyGradeComment?: string;
    }>;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ success: boolean; message: string }>("/attendance/daily-grade", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const group = groupsBase.find((item) => item.id === payload.groupId);

    if (!group) {
      throw new Error("Guruh topilmadi.");
    }

    if (payload.date !== TODAY) {
      throw new Error("Kunlik bahoni faqat o'sha kuni kiritish mumkin.");
    }

    if (!payload.entries.length) {
      throw new Error("Saqlash uchun kunlik baho tanlanmagan.");
    }

    payload.entries.forEach((entry) => {
      const student = studentsBase.find((item) => item.id === entry.studentId);

      if (!student) {
        throw new Error("O'quvchi topilmadi.");
      }

      const attendanceEntry = attendance.find(
        (item) => item.studentName === student.fullName && item.group === group.name && item.date === payload.date
      );

      if (!attendanceEntry) {
        throw new Error("Avval shu sana uchun davomatni saqlang.");
      }

      if (attendanceEntry.status === "absent") {
        throw new Error(`${student.fullName} kelmaganligi uchun kunlik baho qo'yib bo'lmaydi.`);
      }

      if (attendanceEntry.dailyGrade !== null && attendanceEntry.dailyGrade !== undefined) {
        throw new Error(`${student.fullName} uchun kunlik baho allaqachon qo'yilgan.`);
      }

      attendanceEntry.dailyGrade = entry.dailyGrade;
      attendanceEntry.dailyGradeComment = entry.dailyGradeComment?.trim() || undefined;
    });

    return {
      success: true,
      message: `${group.name} guruhi uchun kunlik baholar saqlandi.`
    };
  },

  async markAttendance(payload: {
    studentId: string;
    date: string;
    status: AttendanceEntry["status"];
    comment?: string;
    sendNotification?: boolean;
  }) {
    await wait();

    const student = studentsBase.find((item) => item.id === payload.studentId);

    if (!student) {
      throw new Error("O'quvchi topilmadi.");
    }

    const cleanedComment = payload.comment?.trim() || getDefaultAttendanceComment(payload.status);
    const existingIndex = attendance.findIndex(
      (item) => item.studentName === student.fullName && item.date === payload.date
    );

    if (existingIndex >= 0) {
      throw new Error("Bu o'quvchi uchun shu kunda davomat allaqachon olingan. Uni qayta o'zgartirib bo'lmaydi.");
    }

    const entry: AttendanceEntry = {
      id: crypto.randomUUID(),
      date: payload.date,
      studentName: student.fullName,
      group: student.group,
      status: payload.status,
      comment: cleanedComment,
      homeworkScore: payload.status === "absent" ? 0 : null
    };

    attendance.unshift(entry);

    const noteTag = getAttendanceNoteTag(payload.status);

    if (noteTag) {
      teacherNotes.unshift({
        id: crypto.randomUUID(),
        studentName: student.fullName,
        date: payload.date,
        tag: noteTag,
        comment: cleanedComment
      });
    }

    let notificationSent = false;

    if (payload.sendNotification) {
      const template = getAttendanceTemplate(payload.status);

      if (template && student.parentTelegramStatus === "connected") {
        appendNotification(student.fullName, template);
        notificationSent = true;
      }
    }

    return {
      success: true,
      notificationSent,
      message: "Davomat yozuvi saqlandi."
    };
  },

  async recordPayment(payload: {
    studentId: string;
    month: string;
    amount: number;
    dueDate: string;
    method: string;
    sendNotification?: boolean;
  }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<RecordPaymentResponse>("/payments", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();

    const student = studentsBase.find((item) => item.id === payload.studentId);

    if (!student) {
      throw new Error("O'quvchi topilmadi.");
    }

    const existingIndex = paymentRecords.findIndex(
      (item) => item.studentId === student.id && item.month === payload.month
    );
    const existingAmount = existingIndex >= 0 ? paymentRecords[existingIndex].amount : 0;
    const nextAmount = existingIndex >= 0 ? paymentRecords[existingIndex].amount + payload.amount : payload.amount;
    const expectedAmount = getPaymentExpectedAmount(student.id, student.fullName);
    const remainingBefore = Math.max(expectedAmount - existingAmount, 0);

    if (payload.amount <= 0) {
      throw new Error("Qabul qilingan summa 0 dan katta bo'lishi kerak.");
    }

    if (existingIndex >= 0 && getPaymentStatus(expectedAmount, existingAmount, paymentRecords[existingIndex].dueDate) === "paid") {
      throw new Error("Bu oy to'liq yopilgan. Qayta to'lov qabul qilinmaydi.");
    }

    if (expectedAmount > 0 && payload.amount > remainingBefore) {
      throw new Error(`Orticha to'lov mumkin emas. Qolgan summa ${formatMoney(remainingBefore)}.`);
    }

    const nextStatus = getPaymentStatus(expectedAmount, nextAmount, payload.dueDate);
    const nextStatusNote = getPaymentStatusNote(expectedAmount, nextAmount, payload.dueDate);
    const remainingAmount = Math.max(expectedAmount - nextAmount, 0);
    const nextRecord = {
      id: existingIndex >= 0 ? paymentRecords[existingIndex].id : crypto.randomUUID(),
      studentId: student.id,
      studentName: student.fullName,
      month: payload.month,
      amount: nextAmount,
      dueDate: payload.dueDate,
      status: nextStatus,
      method: payload.method
    };

    if (existingIndex >= 0) {
      paymentRecords[existingIndex] = nextRecord;
    } else {
      paymentRecords.unshift(nextRecord);
    }

    appendSystemMessage(
      student.id,
      "To'lov holati yangilandi",
      `${payload.month} uchun ${formatMoney(payload.amount)} qabul qilindi. Jami ${formatMoney(nextAmount)}. Qoldiq ${formatMoney(remainingAmount)}. Holat: ${nextStatusNote}.`
    );

    let notificationSent = false;

    if (payload.sendNotification && nextStatus !== "paid" && student.parentTelegramStatus === "connected") {
      appendNotification(student.fullName, "To'lov - Qilinmagan");
      notificationSent = true;
    }
    persistMockState();

    const paymentEntry = toPaymentEntry(nextRecord);
    const receipt: PaymentReceipt = {
      receiptNumber: `CHK-${String(nextRecord.id).slice(-6).toUpperCase()}`,
      studentName: student.fullName,
      month: payload.month,
      receivedAmount: formatMoney(payload.amount),
      totalPaid: formatMoney(nextAmount),
      remainingAmount: formatMoney(remainingAmount),
      expectedAmount: formatMoney(expectedAmount),
      dueDate: payload.dueDate,
      method: payload.method,
      status: nextStatus,
      statusNote: nextStatusNote,
      paidAt: new Date().toLocaleString("uz-UZ"),
    };

    return {
      success: true,
      notificationSent,
      message: `${existingIndex >= 0 ? "To'lov holati yangilandi." : "Yangi to'lov yozuvi qo'shildi."} Holat: ${nextStatusNote}. Qoldiq: ${formatMoney(remainingAmount)}`,
      payment: paymentEntry,
      receipt,
    };
  },

  async sendNotification(payload: { studentId?: string; studentName?: string; template: string }) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<{ success: boolean }>("/notifications/send", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await wait();
    if (!telegramSettings.enabled) {
      throw new Error("Telegram bot hali yoqilmagan.");
    }
    const student =
      (payload.studentId ? studentsBase.find((item) => item.id === payload.studentId) : undefined) ??
      (payload.studentName ? studentsBase.find((item) => item.fullName === payload.studentName) : undefined);

    if (!student) {
      throw new Error("O'quvchi topilmadi.");
    }

    if (student.parentTelegramStatus !== "connected") {
      throw new Error("Ota-ona hali Telegram botga ulanmagan.");
    }

    appendNotification(student.fullName, payload.template);

    return {
      success: true
    };
  },

  async globalSearch(term: string) {
    if (!runtimeConfig.useMockApi) {
      return apiRequest<Array<{ label: string; href: string; type: string }>>(`/search?term=${encodeURIComponent(term)}`);
    }

    await wait(120);
    const normalized = term.toLowerCase();

    return [
      ...getStudentSummaries().map((item) => ({
        label: item.fullName,
        href: `/admin/students/${item.id}`,
        type: "O'quvchi"
      })),
      ...getGroupSummaries().map((item) => ({
        label: item.name,
        href: "/admin/groups",
        type: "Guruh"
      })),
      ...getTeacherSummaries().map((item) => ({
        label: item.fullName,
        href: "/admin/teachers",
        type: "O'qituvchi"
      }))
    ].filter((item) => item.label.toLowerCase().includes(normalized));
  }
};
