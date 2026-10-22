import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, teacherClassIds } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createFeeItem, deleteFeeItem } from "@/actions/fees";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

function rate(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export default async function FeesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");

  if (user.role === "ADMIN") {
    const [feeItems, activeStudentCount] = await Promise.all([
      prisma.feeItem.findMany({
        include: {
          payments: { select: { amountCents: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.student.count({ where: { status: "ACTIVE" } }),
    ]);

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

    return (
      <>
        <PageHeader
          title="收费管理"
          description="管理收费项目、查看收缴进度并为幼儿登记缴费。"
        />
        <Alert error={error} success={success} />

        <div className="stats-grid">
          <StatCard label="应缴总额" value={fmtMoney(expected)} hint={`${feeItems.length} 个收费项目`} icon="¥" />
          <StatCard label="已收金额" value={fmtMoney(collected)} hint={`收缴率 ${rate(collected, expected)}%`} icon="✓" tone="blue" />
          <StatCard label="待收金额" value={fmtMoney(outstanding)} hint="请关注临近截止项目" icon="!" tone="rose" />
          <StatCard label="在园幼儿" value={activeStudentCount} hint="收费对象基数" icon="☺" tone="amber" />
        </div>

        <section className="card">
          <div className="card-head">
            <h2>收费项目</h2>
            <span className="muted small">按收费项目查看明细与登记缴费</span>
          </div>
          {feeItems.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>收费项目</th>
                    <th>学期</th>
                    <th>标准</th>
                    <th>截止日期</th>
                    <th className="wide-col">收缴进度</th>
                    <th>缴费笔数</th>
                    <th className="right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {feeItems.map((item) => {
                    const itemCollected = item.payments.reduce(
                      (sum, payment) => sum + payment.amountCents,
                      0,
                    );
                    const itemExpected = item.amountCents * activeStudentCount;
                    const progress = rate(itemCollected, itemExpected);
                    return (
                      <tr key={item.id}>
                        <td>
                          <Link href={`/fees/${item.id}`} className="table-link">
                            {item.name}
                          </Link>
                          {item.description ? (
                            <div className="muted small">{item.description}</div>
                          ) : null}
                        </td>
                        <td className="muted">{item.term}</td>
                        <td className="money">{fmtMoney(item.amountCents)}</td>
                        <td>{item.dueDate}</td>
                        <td>
                          <div className="progress-row">
                            <div className="progress">
                              <div
                                className={`progress-bar ${progress >= 100 ? "green" : "blue"}`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                            <span className="muted small">
                              {fmtMoney(itemCollected)} / {fmtMoney(itemExpected)}
                            </span>
                          </div>
                        </td>
                        <td className="muted">{item._count.payments} 笔</td>
                        <td className="right">
                          <div className="row-actions">
                            <Link href={`/fees/${item.id}`} className="btn btn-secondary btn-sm">
                              明细
                            </Link>
                            <form action={deleteFeeItem} className="inline-form">
                              <input type="hidden" name="id" value={item.id} />
                              <ConfirmButton
                                message={`确定删除收费项目「${item.name}」吗？已有缴费记录时无法删除。`}
                              >
                                删除
                              </ConfirmButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="暂无收费项目" description="使用下方表单创建本学期收费项目。" />
          )}
        </section>

        <section className="card form-card">
          <div className="form-section-head">
            <h2>新增收费项目</h2>
            <p>收费标准按每名在园幼儿计算，登记缴费时自动核对应缴余额。</p>
          </div>
          <form action={createFeeItem}>
            <div className="form-grid">
              <label className="field">
                <span>项目名称 *</span>
                <input name="name" placeholder="如 2027 春季保教费" required />
              </label>
              <label className="field">
                <span>所属学期 *</span>
                <input name="term" defaultValue="2026 秋季学期" required />
              </label>
              <label className="field">
                <span>每位幼儿金额（元）*</span>
                <input
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  placeholder="如 4800"
                  required
                />
              </label>
              <label className="field">
                <span>缴费截止日期 *</span>
                <input type="date" name="dueDate" required />
              </label>
              <label className="field span-2">
                <span>说明</span>
                <input name="description" placeholder="可选，如包含的服务内容" />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                创建收费项目
              </button>
            </div>
          </form>
        </section>
      </>
    );
  }

  if (user.role === "TEACHER") {
    const classIds = await teacherClassIds(user.id);
    const [classes, feeItems] = await Promise.all([
      prisma.schoolClass.findMany({
        where: { id: { in: classIds } },
        include: {
          students: {
            where: { status: "ACTIVE" },
            include: { payments: { select: { amountCents: true } } },
            orderBy: { studentNo: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.feeItem.findMany(),
    ]);
    const totalFees = feeItems.reduce((sum, item) => sum + item.amountCents, 0);

    return (
      <>
        <PageHeader
          title="收费情况"
          description="查看所负责班级的收费进度，具体登记缴费请联系园务管理员。"
        />
        <Alert error={error} success={success} />

        {classes.length ? (
          <div className="class-grid">
            {classes.map((item) => {
              const expected = totalFees * item.students.length;
              const collected = item.students.reduce(
                (sum, student) =>
                  sum +
                  student.payments.reduce(
                    (inner, payment) => inner + payment.amountCents,
                    0,
                  ),
                0,
              );
              const outstanding = Math.max(0, expected - collected);
              return (
                <section key={item.id} className="card class-card">
                  <div className="class-card-head">
                    <div>
                      <h2>{item.name}</h2>
                      <p className="muted small">{item.students.length} 名在园幼儿</p>
                    </div>
                    <span className="class-count">
                      {rate(collected, expected)}<span>%</span>
                    </span>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-bar green"
                      style={{ width: `${Math.min(rate(collected, expected), 100)}%` }}
                    />
                  </div>
                  <div className="class-meta">
                    <span>应缴总额</span>
                    <strong>{fmtMoney(expected)}</strong>
                  </div>
                  <div className="class-meta">
                    <span>已缴金额</span>
                    <strong className="green-text">{fmtMoney(collected)}</strong>
                  </div>
                  <div className="class-meta">
                    <span>待缴金额</span>
                    <strong className={outstanding > 0 ? "amber-text" : "green-text"}>
                      {fmtMoney(outstanding)}
                    </strong>
                  </div>
                  <div className="class-actions">
                    <Link href={`/students?classId=${item.id}`} className="btn btn-secondary btn-sm">
                      查看幼儿
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <EmptyState title="暂未分配班级" description="请联系园务管理员分配班级。" />
          </div>
        )}
      </>
    );
  }

  // 家长收费视图
  const children = await prisma.student.findMany({
    where: { parentId: user.id },
    include: { class: true, payments: { include: { feeItem: true } } },
    orderBy: { name: "asc" },
  });
  const feeItems = await prisma.feeItem.findMany({ orderBy: { createdAt: "asc" } });
  const childIds = children.map((item) => item.id);
  const payments = await prisma.payment.findMany({
    where: { studentId: { in: childIds } },
    include: { feeItem: true, student: true },
    orderBy: { paidAt: "desc" },
  });

  const totalExpected = feeItems.reduce((sum, item) => sum + item.amountCents, 0) * children.length;
  const totalPaid = payments.reduce((sum, item) => sum + item.amountCents, 0);
  const totalOutstanding = Math.max(0, totalExpected - totalPaid);

  return (
    <>
      <PageHeader
        title="收费管理"
        description="查看孩子的应缴费用、缴费记录与待缴金额。"
      />
      <Alert error={error} success={success} />

      <div className="stats-grid">
        <StatCard label="应缴总额" value={fmtMoney(totalExpected)} hint={`${children.length} 个孩子`} icon="¥" />
        <StatCard label="已缴金额" value={fmtMoney(totalPaid)} hint={`${payments.length} 笔缴费记录`} icon="✓" tone="blue" />
        <StatCard label="待缴金额" value={fmtMoney(totalOutstanding)} hint="请留意缴费截止日期" icon="!" tone="rose" />
        <StatCard label="收费项目" value={feeItems.length} hint="本学期" icon="▤" tone="amber" />
      </div>

      {children.length ? (
        <div className="detail-grid">
          {children.map((child) => {
            const childPaid = child.payments.reduce(
              (sum, payment) => sum + payment.amountCents,
              0,
            );
            const childOutstanding = Math.max(0, totalExpected / children.length - childPaid);
            return (
              <section key={child.id} className="card">
                <div className="card-head">
                  <h2>{child.name}</h2>
                  <Badge tone={childOutstanding > 0 ? "amber" : "green"}>
                    {childOutstanding > 0 ? "有待缴费用" : "已缴清"}
                  </Badge>
                </div>
                <div className="muted small" style={{ marginBottom: 12 }}>
                  {child.class?.name ?? "未分班"} · 已缴 {fmtMoney(childPaid)} · 待缴{" "}
                  {fmtMoney(childOutstanding)}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>收费项目</th>
                        <th>应缴</th>
                        <th>已缴</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeItems.map((item) => {
                        const paid = child.payments
                          .filter((payment) => payment.feeItemId === item.id)
                          .reduce((sum, payment) => sum + payment.amountCents, 0);
                        const settled = paid >= item.amountCents;
                        return (
                          <tr key={item.id}>
                            <td>
                              {item.name}
                              <div className="muted small">截止 {item.dueDate}</div>
                            </td>
                            <td className="money">{fmtMoney(item.amountCents)}</td>
                            <td className="money">{fmtMoney(paid)}</td>
                            <td>
                              <Badge tone={settled ? "green" : paid > 0 ? "amber" : "red"}>
                                {settled ? "已缴清" : paid > 0 ? "部分缴纳" : "未缴费"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          <section className="card span-2">
            <div className="card-head">
              <h2>缴费记录</h2>
              <span className="muted small">{payments.length} 笔</span>
            </div>
            {payments.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>幼儿</th>
                      <th>收费项目</th>
                      <th>金额</th>
                      <th>方式</th>
                      <th>缴费时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.student.name}</td>
                        <td>{payment.feeItem.name}</td>
                        <td className="money">{fmtMoney(payment.amountCents)}</td>
                        <td className="muted">
                          {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                        </td>
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
      ) : (
        <div className="card">
          <EmptyState title="尚未关联孩子档案" description="请联系园务管理员绑定家长账号。" />
        </div>
      )}
    </>
  );
}
