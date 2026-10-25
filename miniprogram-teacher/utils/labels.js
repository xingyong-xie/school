const LEAVE_TYPES = [
  { value: "SICK", label: "病假" },
  { value: "PERSONAL", label: "事假" },
  { value: "OTHER", label: "其他" },
];

const LEAVE_TYPE_LABELS = {
  SICK: "病假",
  PERSONAL: "事假",
  OTHER: "其他",
};

const LEAVE_STATUS_LABELS = {
  PENDING: "待审批",
  APPROVED: "已批准",
  REJECTED: "已驳回",
};

const ATTENDANCE_LABELS = {
  PRESENT: "出勤",
  LATE: "迟到",
  SICK: "病假",
  PERSONAL: "事假",
  ABSENT: "缺勤",
};

const FEE_STATUS = {
  PAID: { label: "已缴清", tone: "green" },
  PARTIAL: { label: "部分缴纳", tone: "amber" },
  UNPAID: { label: "未缴费", tone: "red" },
};

module.exports = {
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  ATTENDANCE_LABELS,
  FEE_STATUS,
};
