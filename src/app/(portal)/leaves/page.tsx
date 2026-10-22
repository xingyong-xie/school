import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireUser,
  teacherClassIds,
} from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createLeave, reviewLeave, cancelLeave } from "@/actions/leaves";
import {
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  categoryTone,
} from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { value: "ALL", label: "全部" },
  { value: "PENDING", label: "待审批" },
  { value: "APPROVED", label: "已批准" },
  { value: "REJECTED", label: "已驳回" },
] as const;

export default async function LeavesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");
  const statusFilter = getParam(searchParams, "status") ?? "ALL";

  const isParent = user.role === "PARENT";
  const classScope =
    user.role === "TEACHER" ? await teacherClassIds(user.id) : undefined;

  const scopeWhere: Prisma.LeaveRequestWhereInput = isParent
    ? { student: { parentId: user.id } }
    : user.role === "TEACHER"
      ? { student: { classId: { in: classScope ?? [] } } }
      : {};

  const where: Prisma.LeaveRequestWhereInput = {
    ...scopeWhere,
    ...(statusFilter !== "ALL"
      ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" }
      : {}),
  };

  const [leaves, allScopedLeaves, children] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        student: { include: { class: true } },
        requestedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.leaveRequest.findMany({
      where: scopeWhere,
      select: { status: true },
    }),
    isParent
      ? prisma.student.findMany({
          where: { parentId: user.id },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const pendingCount = allScopedLeaves.filter(
    (item) => item.status === "PENDING",
  ).length;
  const approvedCount = allScopedLeaves.filter(
    (item) => item.status === "APPROVED",
  ).length;
  const rejectedCount = allScopedLeaves.filter(
    (item) => item.status === "REJECTED",
  ).length;
  const pendingLeaves = leaves.filter((item) => item.status === "PENDING");

  return (
    <>
      <PageHeader
        title="请假管理"
        description={
          isParent
            ? "在线提交孩子的请假申请，并随时查看审批进度。"
            : "审批家长提交的请假申请，批准后请同步班级考勤。"
        }
        actions={
          isParent ? (
            <Link href="/attendance" className="btn btn-secondary">
              查看考勤
            </Link>
          ) : null
        }
      />
      <Alert error={error} success={success} />

      <div className="stats-grid">
        <StatCard label="待审批" value={pendingCount} hint="需及时处理" icon="◷" tone="amber" />
        <StatCard label="已批准" value={approvedCount} icon="✓" />
        <StatCard label="已驳回" value={rejectedCount} icon="!" tone="rose" />
        <StatCard label="全部记录" value={allScopedLeaves.length} icon="▤" tone="blue" />
      </div>

      {isParent ? (
        <section className="card form-card">
          <div className="form-section-head">
            <h2>提交请假申请</h2>
            <p>请至少提前说明请假原因，教师审批后会在下方更新状态。</p>
          </div>
          {children.length ? (
            <form action={createLeave}>
              <div className="form-grid">
                <label className="field">
                  <span>幼儿 *</span>
                  <select name="studentId" required defaultValue={children[0]?.id}>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>请假类型 *</span>
                  <select name="type" defaultValue="SICK" required>
                    <option value="SICK">病假</option>
                    <option value="PERSONAL">事假</option>
                    <option value="OTHER">其他</option>
                  </select>
                </label>
                <label className="field">
                  <span>开始日期 *</span>
                  <input type="date" name="startDate" required />
                </label>
                <label className="field">
                  <span>结束日期 *</span>
                  <input type="date" name="endDate" required />
                </label>
                <label className="field span-2">
                  <span>请假事由 *</span>
                  <textarea
                    name="reason"
                    rows={3}
                    placeholder="请简要说明请假原因"
                    required
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  提交申请
                </button>
              </div>
            </form>
          ) : (
            <EmptyState title="尚未关联孩子档案" description="请联系园务管理员绑定家长账号后提交请假。" />
          )}
        </section>
      ) : pendingLeaves.length ? (
        <section className="card">
          <div className="card-head">
            <h2>待审批申请</h2>
            <span className="muted small">{pendingLeaves.length} 条</span>
          </div>
          <div className="review-list">
            {pendingLeaves.map((leave) => (
              <article key={leave.id} className="review-item">
                <div className="review-main">
                  <div className="review-head">
                    <strong>{leave.student.name}</strong>
                    <span className="muted small">
                      {leave.student.class?.name ?? "未分班"} ·{" "}
                      {LEAVE_TYPE_LABELS[leave.type]}
                    </span>
                    <Badge tone="amber">{LEAVE_STATUS_LABELS.PENDING}</Badge>
                  </div>
                  <div className="review-dates">
                    {leave.startDate}
                    {leave.endDate !== leave.startDate ? ` 至 ${leave.endDate}` : ""}
                    <span className="muted"> · 申请人 {leave.requestedBy?.name ?? "—"}</span>
                  </div>
                  <div className="review-reason">{leave.reason}</div>
                </div>
                <form action={reviewLeave} className="review-form">
                  <input type="hidden" name="id" value={leave.id} />
                  <input
                    name="reviewNote"
                    placeholder="审批备注（可选）"
                    className="review-note"
                  />
                  <div className="row-actions">
                    <button
                      type="submit"
                      name="decision"
                      value="APPROVED"
                      className="btn btn-primary btn-sm"
                    >
                      批准
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="REJECTED"
                      className="btn btn-danger-ghost btn-sm"
                    >
                      驳回
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="card-head">
          <h2>{isParent ? "我的请假记录" : "请假记录"}</h2>
          <div className="tab-list">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tab.value === "ALL" ? "/leaves" : `/leaves?status=${tab.value}`}
                className={`tab ${statusFilter === tab.value ? "active" : ""}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        {leaves.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>幼儿</th>
                  <th>班级</th>
                  <th>类型</th>
                  <th>请假日期</th>
                  <th>事由</th>
                  <th>状态</th>
                  <th>审批信息</th>
                  {isParent ? <th className="right">操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>{leave.student.name}</td>
                    <td className="muted">{leave.student.class?.name ?? "—"}</td>
                    <td>{LEAVE_TYPE_LABELS[leave.type]}</td>
                    <td>
                      {leave.startDate}
                      {leave.endDate !== leave.startDate ? ` 至 ${leave.endDate}` : ""}
                    </td>
                    <td className="muted cell-wrap">{leave.reason}</td>
                    <td>
                      <Badge tone={categoryTone(leave.status)}>
                        {LEAVE_STATUS_LABELS[leave.status]}
                      </Badge>
                    </td>
                    <td className="muted small">
                      {leave.reviewedBy ? (
                        <>
                          {leave.reviewedBy.name} · {fmtDateTime(leave.reviewedAt)}
                          {leave.reviewNote ? <div>{leave.reviewNote}</div> : null}
                        </>
                      ) : (
                        "等待审批"
                      )}
                    </td>
                    {isParent ? (
                      <td className="right">
                        {leave.status === "PENDING" ? (
                          <form action={cancelLeave} className="inline-form">
                            <input type="hidden" name="id" value={leave.id} />
                            <ConfirmButton message="确定撤销这条请假申请吗？">
                              撤销
                            </ConfirmButton>
                          </form>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="暂无请假记录"
            description={isParent ? "需要请假时，可在上方提交申请。" : "当前筛选条件下没有请假记录。"}
          />
        )}
      </section>
    </>
  );
}
