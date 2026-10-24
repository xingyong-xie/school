import type {
  AttendanceStatus,
  DiaryMood,
  Gender,
  LeaveStatus,
  LeaveType,
  Role,
  StudentStatus,
} from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "管理员",
  TEACHER: "教师",
  PARENT: "家长",
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "男",
  FEMALE: "女",
};

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: "在园",
  GRADUATED: "已毕业",
  LEFT: "已离园",
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "出勤",
  LATE: "迟到",
  SICK: "病假",
  PERSONAL: "事假",
  ABSENT: "缺勤",
};

export const ATTENDANCE_OPTIONS: AttendanceStatus[] = [
  "PRESENT",
  "LATE",
  "SICK",
  "PERSONAL",
  "ABSENT",
];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  SICK: "病假",
  PERSONAL: "事假",
  OTHER: "其他",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: "待审批",
  APPROVED: "已批准",
  REJECTED: "已驳回",
};

export const DIARY_MOOD_LABELS: Record<DiaryMood, string> = {
  HAPPY: "开心",
  FOCUSED: "专注",
  ENERGETIC: "活力",
  CALM: "安静",
  NEEDS_ATTENTION: "需关注",
};

export const DIARY_MOODS: DiaryMood[] = [
  "HAPPY",
  "FOCUSED",
  "ENERGETIC",
  "CALM",
  "NEEDS_ATTENTION",
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: "银行转账",
  CASH: "现金",
  WECHAT: "微信支付",
  ALIPAY: "支付宝",
};

export const PAYMENT_METHODS = ["TRANSFER", "WECHAT", "ALIPAY", "CASH"] as const;

export const WEEKDAYS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
] as const;

export function categoryTone(value: string): string {
  switch (value) {
    case "PRESENT":
    case "APPROVED":
    case "ACTIVE":
    case "HAPPY":
    case "FOCUSED":
    case "ENERGETIC":
    case "CALM":
      return "green";
    case "LATE":
    case "PENDING":
    case "NEEDS_ATTENTION":
      return "amber";
    case "SICK":
    case "PERSONAL":
    case "GRADUATED":
      return "blue";
    case "ABSENT":
    case "REJECTED":
    case "LEFT":
      return "red";
    default:
      return "gray";
  }
}
