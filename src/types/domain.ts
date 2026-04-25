export type Role = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused"
  | "not_prepared"
  | "homework_not_done";
export type PaymentStatus = "paid" | "unpaid" | "partial" | "overdue";

export interface SessionUser {
  id: string;
  profileId?: string;
  fullName: string;
  role: Role;
  phone: string;
  email?: string;
  avatar?: string;
}

export interface AccountCredentials {
  loginIdentifier: string;
  password: string;
  issuedAt?: string;
}

export interface AccountCreateResponse {
  success: boolean;
  message: string;
  loginIdentifier: string;
  password: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  change?: string;
  tone?: "primary" | "success" | "warning" | "danger";
}

export interface ChartDatum {
  label: string;
  value: number;
}

export interface StudentSummary {
  id: string;
  fullName: string;
  phone: string;
  parentName?: string;
  parentPhone?: string;
  parentTelegramStatus: "connected" | "missing";
  parentTelegramConnectUrl?: string | null;
  group: string;
  course: string;
  attendancePercent: number;
  paymentStatus: PaymentStatus;
  monthlyFee: string;
  lastTeacherNote: string;
  teacherName?: string;
  room?: string;
  schedule?: string;
  accountCredentials?: AccountCredentials | null;
}

export interface TeacherSummary {
  id: string;
  fullName: string;
  phone: string;
  specialization: string;
  groups: string[];
  studentCount: number;
  status: "active" | "inactive";
  accountCredentials?: AccountCredentials | null;
}

export interface GroupSummary {
  id: string;
  name: string;
  course: string;
  teacher: string;
  room: string;
  schedule: string;
  students: number;
  unpaidStudents: number;
}

export interface CourseSummary {
  id: string;
  title: string;
  price: string;
  priceValue: number;
  groupCount: number;
  studentCount: number;
}

export interface AttendanceEntry {
  id: string;
  date: string;
  studentName: string;
  group: string;
  lessonTopic?: string;
  status: AttendanceStatus;
  comment?: string;
  homeworkScore?: number | null;
  homeworkComment?: string;
  dailyGrade?: number | null;
  dailyGradeComment?: string;
}

export interface PaymentEntry {
  id: string;
  studentId?: string;
  studentName: string;
  month: string;
  amount: string;
  expectedAmount?: string;
  remainingAmount?: string;
  dueDate: string;
  status: PaymentStatus;
  statusNote?: string;
  method: string;
}

export interface PaymentReceipt {
  receiptNumber: string;
  studentName: string;
  month: string;
  receivedAmount: string;
  totalPaid: string;
  remainingAmount: string;
  expectedAmount: string;
  dueDate: string;
  method: string;
  status: PaymentStatus;
  statusNote: string;
  paidAt: string;
}

export interface RecordPaymentResponse {
  success: boolean;
  notificationSent: boolean;
  message: string;
  payment?: PaymentEntry;
  receipt?: PaymentReceipt;
}

export interface NotificationEntry {
  id: string;
  studentName: string;
  channel: "Telegram";
  template: string;
  recipient: string;
  status: "sent" | "failed";
  sentAt: string;
}

export interface SystemMessageEntry {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface StudentGroupAssignment {
  id: string;
  name: string;
  course: string;
  teacherName: string;
  room: string;
  schedule: string;
  scheduleDays: string[];
  scheduleTime?: string | null;
}

export interface StudentDetail {
  id: string;
  fullName: string;
  phone: string;
  parentName?: string;
  parentPhone?: string;
  parentTelegramStatus: "connected" | "missing";
  parentTelegramHandle?: string;
  parentTelegramConnectUrl?: string | null;
  group: string;
  course: string;
  monthlyFee?: string;
  teacherName?: string;
  room?: string;
  schedule?: string;
  scheduleDays?: string[];
  scheduleTime?: string | null;
  groupAssignments: StudentGroupAssignment[];
  attendanceTimeline: AttendanceEntry[];
  payments: PaymentEntry[];
  notes: Array<{ id: string; date: string; tag: string; comment: string }>;
  homework: Array<{ id: string; title: string; dueDate: string; status: string }>;
  messages: SystemMessageEntry[];
  accountCredentials?: AccountCredentials | null;
}

export interface TelegramBotSettings {
  enabled: boolean;
  botUsername?: string | null;
  hasBotToken: boolean;
  welcomeText: string;
  welcomeImageUrl?: string | null;
  notificationImageUrl?: string | null;
  attendanceTemplate: string;
  homeworkTemplate: string;
  paymentTemplate: string;
  lastUpdateId: number;
}
