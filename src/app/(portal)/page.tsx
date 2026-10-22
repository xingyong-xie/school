import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";
import {
  ATTENDANCE_LABELS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  categoryTone,
} from "@/lib/constants";
import {
  calcAge,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  monthStartString,
  todayString,
} from "@/lib/format";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

function rate(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  const error = getParam(searchParams, "error");
  const today = todayString();
  const monthStart = monthStartString();

  if (user.role === "ADMIN") {
    const [
      studentCount,
      classCount,
      teacherCount,
      todayRecords,
      pendingLeaves,
      feeItems,
      activeStudentCount,
      recentPayments,
    ] = await Promise.all([
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.schoolClass.count(),
      prisma.teacher.count(),
      prisma.attendance.findMany({
        where: { date: today },
        include: { student: { include: { class: true } } },
      }),
      prisma.leaveRequest.findMany({
        where: { status: "PENDING" },
        include: {
          student: { include: { class: true } },
          requestedBy: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.feeItem.findMany({
        orderBy: { createdAt: "asc" },
        include: { payments: { select: { amountCents: true } } },
      }),
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.payment.findMany({
        include: { student: true, feeItem: true },
        orderBy: { paidAt: "desc" },
        take: 5,
      }),
    ]);

    const present = todayRecords.filter(
      (item) => item.status === "PRESENT" || item.status === "LATE",
    ).length;
    const rateValue = rate(present, todayRecords.length);
    const expected = feeItems.reduce(
      (sum, item) => sum + item.amountCents * activeStudentCount,
      0,
    );
    const collected = feeItems.reduce(
      (sum, item) =>
        sum + item.payments.reduce((inner, payment) => inner + payment.amountCents, 0),
      0,
    );
    const outstanding = Math.max(0, expected - collected);

    const statusCounts = (["PRESENT", "LATE", "SICK", "PERSONAL", "ABSENT"] as const).map(
      (status) => ({
        status,
        count: todayRecords.filter((item) => item.status === status).length,
      }),
    );

    return (
      <>
        <PageHeader
          title={`你好，${user.name}`}
          description={`${today} · 全园共有 ${studentCount} 名在园幼儿，今日重点事项尽在掌握。`}
          actions={
            <Link href="/students/new" className="btn btn-primary">
              + 新增幼儿档案
            </Link>
          }
        />
        <Alert error={error} />

        <div className="stats-grid">
          <StatCard label="在园幼儿" value={studentCount} hint={`覆盖 ${classCount} 个班级`} icon="☺" />
          <StatCard label="在职教师" value={teacherCount} hint="含班级主班教师" icon="✎" tone="blue" />
          <StatCard
            label="今日出勤率"
            value={todayRecords.length ? `${rateValue}%` : "—"}
            hint={todayRecords.length ? `${present} / ${todayRecords.length} 人已登记` : "今日尚未登记考勤"}
            icon="✓"
            tone="amber"
          />
          <StatCard label="待缴费用" value={fmtMoney(outstanding)} hint={`累计已收 ${fmtMoney(collected)}`} icon="¥" tone="rose" />
        </div>

        <div className="dashboard-grid">
          <section className="card">
            <div className="card-head">
              <h2>今日考勤</h2>
              <Link href="/attendance" className="text-link">登记考勤 →</Link>
            </div>
            {todayRecords.length ? (
              <>
                <div className="rate-row">
                  <div className="rate-value">{rateValue}%</div>
                  <div className="rate-info">
                    <div className="progress">
                      <div className="progress-bar green" style={{ width: `${rateValue}%` }} />
                    </div>
                    <div className="muted">共 {todayRecords.length} 条登记记录</div>
                  </div>
                </div>
                <div className="status-chips">
                  {statusCounts.map((item) => (
                    <span key={item.status} className="status-chip">
                      <Badge tone={categoryTone(item.status)}>{ATTENDANCE_LABELS[item.status]}</Badge>
                      <strong>{item.count}</strong>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState title="今日暂无考勤记录" description="前往「考勤管理」登记今日出勤情况。" />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>待审批请假</h2>
              <Link href="/leaves" className="text-link">查看全部 →</Link>
            </div>
            {pendingLeaves.length ? (
              <ul className="list">
                {pendingLeaves.map((leave) => (
                  <li key={leave.id} className="list-row">
                    <div className="list-main">
                      <div className="list-title">
                        {leave.student.name}
                        <span className="muted small">
                          {leave.student.class?.name ?? "未分班"}
                        </span>
                      </div>
                      <div className="list-sub">
                        {LEAVE_TYPE_LABELS[leave.type]} · {leave.startDate}
                        {leave.endDate !== leave.startDate ? ` 至 ${leave.endDate}` : ""}
                      </div>
                    </div>
                    <Badge tone={categoryTone(leave.status)}>
                      {LEAVE_STATUS_LABELS[leave.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="没有待审批的请假" description="所有请假申请均已处理。" />
            )}
          </section>

          <section className="card span-2">
            <div className="card-head">
              <h2>收费概览</h2>
              <Link href="/fees" className="text-link">收费管理 →</Link>
            </div>
            <div className="fee-summary">
              <div>
                <div className="muted small">应缴总额</div>
                <div className="fee-number">{fmtMoney(expected)}</div>
              </div>
              <div>
                <div className="muted small">已收金额</div>
                <div className="fee-number green-text">{fmtMoney(collected)}</div>
              </div>
              <div>
                <div className="muted small">待收金额</div>
                <div className="fee-number amber-text">{fmtMoney(outstanding)}</div>
              </div>
              <div>
                <div className="muted small">整体收缴率</div>
                <div className="fee-number">{rate(collected, expected)}%</div>
              </div>
            </div>
            <div className="progress large">
              <div
                className="progress-bar green"
                style={{ width: `${rate(collected, expected)}%` }}
              />
            </div>
            <div className="fee-bars">
              {feeItems.map((item) => {
                const itemCollected = item.payments.reduce(
                  (sum, payment) => sum + payment.amountCents,
                  0,
                );
                const itemExpected = item.amountCents * activeStudentCount;
                return (
                  <div key={item.id} className="fee-bar-row">
                    <div className="fee-bar-label">
                      <span>{item.name}</span>
                      <span className="muted small">
                        {fmtMoney(itemCollected)} / {fmtMoney(itemExpected)}
                      </span>
                    </div>
                    <div className="progress">
                      <div
                        className="progress-bar blue"
                        style={{ width: `${rate(itemCollected, itemExpected)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card span-2">
            <div className="card-head">
              <h2>最近缴费</h2>
              <Link href="/fees" className="text-link">查看明细 →</Link>
            </div>
            {recentPayments.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>幼儿</th>
                      <th>收费项目</th>
                      <th>金额</th>
                      <th>缴费时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.student.name}</td>
                        <td>{payment.feeItem.name}</td>
                        <td className="money">{fmtMoney(payment.amountCents)}</td>
                        <td className="muted">{fmtDateTime(payment.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="暂无缴费记录" />
            )}
          </section>
        </div>
      </>
    );
  }

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: {
        classes: {
          include: {
            students: { where: { status: "ACTIVE" }, select: { id: true } },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!teacher) {
      return (
        <>
          <PageHeader title={`你好，${user.name}`} description="当前教师账号尚未关联教师档案，请联系管理员。" />
          <EmptyState title="未找到教师档案" description="请让管理员在「教师管理」中补充你的信息。" />
        </>
      );
    }

    const classIds = teacher.classes.map((item) => item.id);
    const studentCount = teacher.classes.reduce(
      (sum, item) => sum + item.students.length,
      0,
    );
    const [todayRecords, pendingLeaves] = await Promise.all([
      prisma.attendance.findMany({
        where: { date: today, student: { classId: { in: classIds } } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "PENDING",
          student: { classId: { in: classIds } },
        },
        include: { student: { include: { class: true } }, requestedBy: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const present = todayRecords.filter(
      (item) => item.status === "PRESENT" || item.status === "LATE",
    ).length;
    const rateValue = rate(present, todayRecords.length);
    const statusCounts = (["PRESENT", "LATE", "SICK", "PERSONAL", "ABSENT"] as const).map(
      (status) => ({
        status,
        count: todayRecords.filter((item) => item.status === status).length,
      }),
    );

    return (
      <>
        <PageHeader
          title={`你好，${user.name}老师`}
          description={`${today} · 你负责 ${teacher.classes.length} 个班级、${studentCount} 名幼儿。`}
          actions={
            classIds.length ? (
              <Link
                href={`/attendance?classId=${classIds[0]}&date=${today}`}
                className="btn btn-primary"
              >
                登记今日考勤
              </Link>
            ) : null
          }
        />
        <Alert error={error} />

        <div className="stats-grid">
          <StatCard label="负责班级" value={teacher.classes.length} hint={teacher.classes.map((item) => item.name).join("、") || "暂未分配"} icon="▤" />
          <StatCard label="在园幼儿" value={studentCount} hint="所负责班级合计" icon="☺" tone="blue" />
          <StatCard
            label="今日出勤率"
            value={todayRecords.length ? `${rateValue}%` : "—"}
            hint={`${present} / ${todayRecords.length} 人已登记`}
            icon="✓"
            tone="amber"
          />
          <StatCard label="待审批请假" value={pendingLeaves.length} hint="请及时处理家长申请" icon="◷" tone="rose" />
        </div>

        <div className="dashboard-grid">
          <section className="card">
            <div className="card-head">
              <h2>今日考勤概况</h2>
              <Link href="/attendance" className="text-link">前往登记 →</Link>
            </div>
            {todayRecords.length ? (
              <>
                <div className="rate-row">
                  <div className="rate-value">{rateValue}%</div>
                  <div className="rate-info">
                    <div className="progress">
                      <div className="progress-bar green" style={{ width: `${rateValue}%` }} />
                    </div>
                    <div className="muted">共 {todayRecords.length} 条登记记录</div>
                  </div>
                </div>
                <div className="status-chips">
                  {statusCounts.map((item) => (
                    <span key={item.status} className="status-chip">
                      <Badge tone={categoryTone(item.status)}>{ATTENDANCE_LABELS[item.status]}</Badge>
                      <strong>{item.count}</strong>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState title="今日尚未登记考勤" description="选择班级后即可快速登记。" />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>我的班级</h2>
              <Link href="/classes" className="text-link">查看班级 →</Link>
            </div>
            {teacher.classes.length ? (
              <ul className="list">
                {teacher.classes.map((item) => (
                  <li key={item.id} className="list-row">
                    <div className="list-main">
                      <div className="list-title">{item.name}</div>
                      <div className="list-sub">
                        {item.ageGroup} · {item.students.length}/{item.capacity} 人 · {item.room ?? "未分配教室"}
                      </div>
                    </div>
                    <Link
                      href={`/attendance?classId=${item.id}&date=${today}`}
                      className="btn btn-secondary btn-sm"
                    >
                      考勤
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="暂未分配班级" description="请联系园务管理员。" />
            )}
          </section>

          <section className="card span-2">
            <div className="card-head">
              <h2>待审批请假</h2>
              <Link href="/leaves" className="text-link">请假管理 →</Link>
            </div>
            {pendingLeaves.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>幼儿</th>
                      <th>班级</th>
                      <th>类型</th>
                      <th>请假日期</th>
                      <th>事由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeaves.map((leave) => (
                      <tr key={leave.id}>
                        <td>{leave.student.name}</td>
                        <td className="muted">{leave.student.class?.name ?? "—"}</td>
                        <td>{LEAVE_TYPE_LABELS[leave.type]}</td>
                        <td>
                          {leave.startDate}
                          {leave.endDate !== leave.startDate ? ` 至 ${leave.endDate}` : ""}
                        </td>
                        <td className="muted">{leave.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="没有待审批的请假" description="所有申请均已处理。" />
            )}
          </section>
        </div>
      </>
    );
  }

  // 家长工作台
  const children = await prisma.student.findMany({
    where: { parentId: user.id },
    include: { class: { include: { teacher: { include: { user: true } } } } },
    orderBy: { name: "asc" },
  });
  const childIds = children.map((item) => item.id);

  const [monthAttendance, feeItems, payments, pendingLeaves] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: { in: childIds }, date: { gte: monthStart } },
    }),
    prisma.feeItem.findMany(),
    prisma.payment.findMany({
      where: { studentId: { in: childIds } },
      include: { feeItem: true, student: true },
      orderBy: { paidAt: "desc" },
    }),
    prisma.leaveRequest.findMany({
      where: { studentId: { in: childIds }, status: "PENDING" },
      include: { student: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalFees = feeItems.reduce((sum, item) => sum + item.amountCents, 0);
  const paidByChild = new Map<number, number>();
  for (const payment of payments) {
    paidByChild.set(
      payment.studentId,
      (paidByChild.get(payment.studentId) ?? 0) + payment.amountCents,
    );
  }

  const monthPresent = monthAttendance.filter(
    (item) => item.status === "PRESENT" || item.status === "LATE",
  ).length;
  const totalOutstanding = children.reduce(
    (sum, child) => sum + Math.max(0, totalFees - (paidByChild.get(child.id) ?? 0)),
    0,
  );

  return (
    <>
      <PageHeader
        title={`你好，${user.name}`}
        description={`${today} · 这里是孩子们的在园动态与缴费情况。`}
        actions={
          <Link href="/leaves" className="btn btn-primary">
            提交请假申请
          </Link>
        }
      />
      <Alert error={error} />

      <div className="stats-grid">
        <StatCard label="我的孩子" value={children.length} hint="在园就读" icon="☺" />
        <StatCard
          label="本月出勤"
          value={`${monthPresent} 天`}
          hint={`本月共有 ${monthAttendance.length} 条考勤记录`}
          icon="✓"
          tone="blue"
        />
        <StatCard label="待审批请假" value={pendingLeaves.length} hint="审核结果将在列表更新" icon="◷" tone="amber" />
        <StatCard label="待缴费用" value={fmtMoney(totalOutstanding)} hint="含本学期全部收费项目" icon="¥" tone="rose" />
      </div>

      <div className="dashboard-grid">
        <section className="card span-2">
          <div className="card-head">
            <h2>孩子档案</h2>
            <Link href="/students" className="text-link">查看全部 →</Link>
          </div>
          {children.length ? (
            <div className="child-grid">
              {children.map((child) => {
                const childPaid = paidByChild.get(child.id) ?? 0;
                const childOutstanding = Math.max(0, totalFees - childPaid);
                const childRecords = monthAttendance.filter(
                  (item) => item.studentId === child.id,
                );
                const childPresent = childRecords.filter(
                  (item) => item.status === "PRESENT" || item.status === "LATE",
                ).length;
                return (
                  <Link key={child.id} href={`/students/${child.id}`} className="child-card">
                    <div className="child-top">
                      <div className="avatar large">{child.name.slice(0, 1)}</div>
                      <div>
                        <div className="child-name">{child.name}</div>
                        <div className="muted small">
                          {child.class?.name ?? "未分班"} · {calcAge(child.birthDate)} 岁
                        </div>
                      </div>
                    </div>
                    <div className="child-meta">
                      <span>本月出勤 <strong>{childPresent} 天</strong></span>
                      <span>
                        待缴 <strong className={childOutstanding > 0 ? "amber-text" : "green-text"}>{fmtMoney(childOutstanding)}</strong>
                      </span>
                    </div>
                    <div className="child-teacher">
                      主班教师：{child.class?.teacher?.user.name ?? "待分配"}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState title="尚未关联孩子档案" description="请联系园务管理员绑定家长账号。" />
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>待审批请假</h2>
            <Link href="/leaves" className="text-link">全部 →</Link>
          </div>
          {pendingLeaves.length ? (
            <ul className="list">
              {pendingLeaves.map((leave) => (
                <li key={leave.id} className="list-row">
                  <div className="list-main">
                    <div className="list-title">{leave.student.name}</div>
                    <div className="list-sub">
                      {LEAVE_TYPE_LABELS[leave.type]} · {leave.startDate}
                      {leave.endDate !== leave.startDate ? ` 至 ${leave.endDate}` : ""}
                    </div>
                  </div>
                  <Badge tone={categoryTone(leave.status)}>
                    {LEAVE_STATUS_LABELS[leave.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="暂无待审批请假" description="可在「请假管理」提交新的申请。" />
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>最近缴费</h2>
            <Link href="/fees" className="text-link">收费明细 →</Link>
          </div>
          {payments.length ? (
            <ul className="list">
              {payments.slice(0, 5).map((payment) => (
                <li key={payment.id} className="list-row">
                  <div className="list-main">
                    <div className="list-title">{payment.feeItem.name}</div>
                    <div className="list-sub">
                      {payment.student.name} · {fmtDate(payment.paidAt)}
                    </div>
                  </div>
                  <span className="money">{fmtMoney(payment.amountCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="暂无缴费记录" />
          )}
        </section>
      </div>
    </>
  );
}
