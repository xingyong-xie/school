import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  requireUser,
  teacherCanAccessStudent,
} from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StatCard } from "@/components/StatCard";
import { deleteStudent } from "@/actions/students";
import {
  ATTENDANCE_LABELS,
  DIARY_MOOD_LABELS,
  GENDER_LABELS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  STUDENT_STATUS_LABELS,
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

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      class: { include: { teacher: { include: { user: true } } } },
      parent: true,
      attendances: {
        orderBy: { date: "desc" },
        take: 20,
        include: { recordedBy: { select: { name: true } } },
      },
      leaves: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { reviewedBy: { select: { name: true } } },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        include: { feeItem: true, recordedBy: { select: { name: true } } },
      },
      diaryEntries: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 5,
        include: {
          author: { select: { name: true } },
          photos: { select: { id: true } },
        },
      },
    },
  });

  if (!student) notFound();

  if (user.role === "PARENT" && student.parentId !== user.id) {
    redirect("/?error=" + encodeURIComponent("无权查看该幼儿档案"));
  }
  if (
    user.role === "TEACHER" &&
    !(await teacherCanAccessStudent(user.id, student.id))
  ) {
    redirect("/?error=" + encodeURIComponent("该幼儿不在你负责的班级中"));
  }

  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");
  const monthStart = monthStartString();

  const monthRecords = student.attendances.filter((item) => item.date >= monthStart);
  const monthPresent = monthRecords.filter(
    (item) => item.status === "PRESENT" || item.status === "LATE",
  ).length;

  const feeItems = await prisma.feeItem.findMany();
  const totalFees = feeItems.reduce((sum, item) => sum + item.amountCents, 0);
  const paid = student.payments.reduce((sum, item) => sum + item.amountCents, 0);
  const outstanding = Math.max(0, totalFees - paid);

  return (
    <>
      <PageHeader
        title={student.name}
        description={`${student.studentNo} · ${student.class?.name ?? "未分班"} · ${calcAge(student.birthDate)} 岁`}
        actions={
          user.role === "ADMIN" ? (
            <div className="row-actions">
              <Link href="/students" className="btn btn-secondary">
                返回列表
              </Link>
              <Link href={`/students/${student.id}/edit`} className="btn btn-primary">
                编辑档案
              </Link>
              <form action={deleteStudent} className="inline-form">
                <input type="hidden" name="id" value={student.id} />
                <ConfirmButton
                  message={`确定删除 ${student.name} 的档案吗？相关考勤、请假、缴费和成长日记也会一并删除。`}
                  className="btn btn-danger"
                >
                  删除档案
                </ConfirmButton>
              </form>
            </div>
          ) : (
            <Link href="/students" className="btn btn-secondary">
              返回
            </Link>
          )
        }
      />
      <Alert error={error} success={success} />

      <div className="stats-grid">
        <StatCard
          label="本月出勤"
          value={`${monthPresent} 天`}
          hint={`本月共 ${monthRecords.length} 条记录`}
          icon="✓"
        />
        <StatCard
          label="累计请假"
          value={student.leaves.length}
          hint="最近 10 条记录"
          icon="◷"
          tone="amber"
        />
        <StatCard
          label="已缴费用"
          value={fmtMoney(paid)}
          hint={`应缴 ${fmtMoney(totalFees)}`}
          icon="¥"
          tone="blue"
        />
        <StatCard
          label="待缴费用"
          value={fmtMoney(outstanding)}
          hint={outstanding > 0 ? "请留意缴费截止日期" : "本学期费用已缴清"}
          icon="¥"
          tone="rose"
        />
      </div>

      <div className="detail-grid">
        <section className="card">
          <div className="card-head">
            <h2>基本信息</h2>
            <Badge tone={categoryTone(student.status)}>
              {STUDENT_STATUS_LABELS[student.status]}
            </Badge>
          </div>
          <dl className="info-list">
            <div>
              <dt>学号</dt>
              <dd className="mono">{student.studentNo}</dd>
            </div>
            <div>
              <dt>姓名</dt>
              <dd>{student.name}</dd>
            </div>
            <div>
              <dt>性别</dt>
              <dd>{GENDER_LABELS[student.gender]}</dd>
            </div>
            <div>
              <dt>出生日期</dt>
              <dd>{fmtDate(student.birthDate)}（{calcAge(student.birthDate)} 岁）</dd>
            </div>
            <div>
              <dt>入园日期</dt>
              <dd>{fmtDate(student.enrollmentDate)}</dd>
            </div>
            <div>
              <dt>班级</dt>
              <dd>{student.class?.name ?? "未分班"}</dd>
            </div>
            <div>
              <dt>主班教师</dt>
              <dd>{student.class?.teacher?.user.name ?? "待分配"}</dd>
            </div>
            <div>
              <dt>联系电话</dt>
              <dd>{student.phone ?? "—"}</dd>
            </div>
            <div className="span-2">
              <dt>家庭住址</dt>
              <dd>{student.address ?? "—"}</dd>
            </div>
            <div className="span-2">
              <dt>备注</dt>
              <dd>{student.notes ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>家长信息</h2>
          </div>
          {student.parent ? (
            <dl className="info-list single">
              <div>
                <dt>家长姓名</dt>
                <dd>{student.parent.name}</dd>
              </div>
              <div>
                <dt>登录账号</dt>
                <dd className="mono">{student.parent.username}</dd>
              </div>
              <div>
                <dt>联系电话</dt>
                <dd>{student.parent.phone ?? "—"}</dd>
              </div>
              <div>
                <dt>账号状态</dt>
                <dd>
                  <Badge tone={student.parent.active ? "green" : "red"}>
                    {student.parent.active ? "正常" : "停用"}
                  </Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <EmptyState title="未关联家长账号" description="管理员可在编辑档案时绑定家长。" />
          )}
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h2>考勤记录</h2>
            <Link href={`/attendance?date=${todayString()}`} className="text-link">
              考勤管理 →
            </Link>
          </div>
          {student.attendances.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>状态</th>
                    <th>备注</th>
                    <th>登记人</th>
                  </tr>
                </thead>
                <tbody>
                  {student.attendances.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      <td>
                        <Badge tone={categoryTone(record.status)}>
                          {ATTENDANCE_LABELS[record.status]}
                        </Badge>
                      </td>
                      <td className="muted">{record.note ?? "—"}</td>
                      <td className="muted">{record.recordedBy?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="暂无考勤记录" />
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>请假记录</h2>
            <Link href="/leaves" className="text-link">请假管理 →</Link>
          </div>
          {student.leaves.length ? (
            <ul className="list">
              {student.leaves.map((leave) => (
                <li key={leave.id} className="list-row">
                  <div className="list-main">
                    <div className="list-title">
                      {LEAVE_TYPE_LABELS[leave.type]}
                      <span className="muted small">{leave.startDate}{leave.endDate !== leave.startDate ? ` 至 ${leave.endDate}` : ""}</span>
                    </div>
                    <div className="list-sub">{leave.reason}</div>
                  </div>
                  <Badge tone={categoryTone(leave.status)}>
                    {LEAVE_STATUS_LABELS[leave.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="暂无请假记录" />
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>缴费记录</h2>
            <Link href="/fees" className="text-link">收费管理 →</Link>
          </div>
          {student.payments.length ? (
            <ul className="list">
              {student.payments.map((payment) => (
                <li key={payment.id} className="list-row">
                  <div className="list-main">
                    <div className="list-title">{payment.feeItem.name}</div>
                    <div className="list-sub">
                      {fmtDateTime(payment.paidAt)} ·{" "}
                      {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                      {payment.recordedBy ? ` · ${payment.recordedBy.name}` : ""}
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

        <section className="card span-2">
          <div className="card-head">
            <h2>成长日记</h2>
            <div className="head-actions">
              {user.role !== "PARENT" ? (
                <Link
                  href={`/diaries/new?studentId=${student.id}&returnTo=${encodeURIComponent(`/students/${student.id}`)}`}
                  className="btn btn-primary btn-sm"
                >
                  + 写日记
                </Link>
              ) : null}
              <Link
                href={`/diaries?studentId=${student.id}`}
                className="text-link"
              >
                查看全部 →
              </Link>
            </div>
          </div>
          {student.diaryEntries.length ? (
            <ul className="list">
              {student.diaryEntries.map((entry) => (
                <li key={entry.id} className="list-row">
                  <div className="list-main">
                    <div className="list-title">
                      {entry.title ?? "成长日记"}
                      <span className="muted small">
                        {entry.date}
                        {entry.author ? ` · ${entry.author.name}` : ""}
                      </span>
                    </div>
                    <div className="list-sub">
                      {entry.content.length > 60
                        ? `${entry.content.slice(0, 60)}…`
                        : entry.content}
                    </div>
                  </div>
                  <div className="row-actions">
                    {entry.photos.length ? (
                      <span className="muted small">▣ {entry.photos.length}</span>
                    ) : null}
                    {entry.mood ? (
                      <Badge tone={categoryTone(entry.mood)}>
                        {DIARY_MOOD_LABELS[entry.mood]}
                      </Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="暂无成长日记" />
          )}
        </section>
      </div>
    </>
  );
}
