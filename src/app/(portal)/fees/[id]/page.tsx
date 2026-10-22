import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { recordPayment } from "@/actions/fees";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { centsToYuan, fmtDateTime, fmtMoney } from "@/lib/format";
import { getIntParam, getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function FeeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  await requireAdmin();
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const feeItem = await prisma.feeItem.findUnique({ where: { id } });
  if (!feeItem) notFound();

  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");
  const classId = getIntParam(searchParams, "classId");

  const [classes, students, recentPayments] = await Promise.all([
    prisma.schoolClass.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: {
        status: "ACTIVE",
        ...(classId ? { classId } : {}),
      },
      include: {
        class: true,
        payments: { where: { feeItemId: id } },
      },
      orderBy: { studentNo: "asc" },
    }),
    prisma.payment.findMany({
      where: { feeItemId: id },
      include: { student: true, recordedBy: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: 12,
    }),
  ]);

  const rows = students.map((student) => {
    const paid = student.payments.reduce(
      (sum, payment) => sum + payment.amountCents,
      0,
    );
    const outstanding = Math.max(0, feeItem.amountCents - paid);
    return { ...student, paid, outstanding };
  });

  const expected = feeItem.amountCents * rows.length;
  const collected = rows.reduce((sum, row) => sum + row.paid, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
  const settledCount = rows.filter((row) => row.outstanding === 0).length;
  const unpaidCount = rows.filter((row) => row.paid === 0).length;

  return (
    <>
      <PageHeader
        title={feeItem.name}
        description={`${feeItem.term} · 截止 ${feeItem.dueDate} · 标准 ${fmtMoney(feeItem.amountCents)} / 人`}
        actions={
          <Link href="/fees" className="btn btn-secondary">
            返回收费管理
          </Link>
        }
      />
      <Alert error={error} success={success} />

      <div className="stats-grid">
        <StatCard label="应缴总额" value={fmtMoney(expected)} hint={`${rows.length} 名在园幼儿`} icon="¥" />
        <StatCard label="已收金额" value={fmtMoney(collected)} hint={`${settledCount} 人已缴清`} icon="✓" tone="blue" />
        <StatCard label="待收金额" value={fmtMoney(outstanding)} hint={`${unpaidCount} 人尚未缴费`} icon="!" tone="rose" />
        <StatCard
          label="收缴率"
          value={expected ? `${Math.round((collected / expected) * 100)}%` : "—"}
          hint={feeItem.description ?? "—"}
          icon="%"
          tone="amber"
        />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>缴费情况</h2>
          <form method="get" className="inline-form">
            <select name="classId" defaultValue={classId ?? ""} className="compact-select">
              <option value="">全部班级</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary btn-sm">
              筛选
            </button>
          </form>
        </div>

        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>学号</th>
                  <th>幼儿</th>
                  <th>班级</th>
                  <th>应缴</th>
                  <th>已缴</th>
                  <th>待缴</th>
                  <th>状态</th>
                  <th className="right">登记缴费</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.studentNo}</td>
                    <td>{row.name}</td>
                    <td className="muted">{row.class?.name ?? "—"}</td>
                    <td className="money">{fmtMoney(feeItem.amountCents)}</td>
                    <td className="money">{fmtMoney(row.paid)}</td>
                    <td className="money">{fmtMoney(row.outstanding)}</td>
                    <td>
                      <Badge
                        tone={
                          row.outstanding === 0
                            ? "green"
                            : row.paid > 0
                              ? "amber"
                              : "red"
                        }
                      >
                        {row.outstanding === 0 ? "已缴清" : row.paid > 0 ? "部分缴纳" : "未缴费"}
                      </Badge>
                    </td>
                    <td className="right">
                      {row.outstanding > 0 ? (
                        <form action={recordPayment} className="payment-form">
                          <input type="hidden" name="studentId" value={row.id} />
                          <input type="hidden" name="feeItemId" value={feeItem.id} />
                          <input
                            type="number"
                            name="amount"
                            min="0.01"
                            step="0.01"
                            max={centsToYuan(row.outstanding)}
                            defaultValue={centsToYuan(row.outstanding)}
                            aria-label="缴费金额"
                          />
                          <select name="method" defaultValue="TRANSFER" aria-label="支付方式">
                            {PAYMENT_METHODS.map((method) => (
                              <option key={method} value={method}>
                                {PAYMENT_METHOD_LABELS[method]}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="btn btn-primary btn-sm">
                            登记
                          </button>
                        </form>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="没有符合条件的幼儿" description="请调整班级筛选条件。" />
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>最近缴费记录</h2>
          <span className="muted small">共 {recentPayments.length} 笔</span>
        </div>
        {recentPayments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>幼儿</th>
                  <th>金额</th>
                  <th>方式</th>
                  <th>缴费时间</th>
                  <th>登记人</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.student.name}</td>
                    <td className="money">{fmtMoney(payment.amountCents)}</td>
                    <td className="muted">
                      {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                    </td>
                    <td className="muted">{fmtDateTime(payment.paidAt)}</td>
                    <td className="muted">{payment.recordedBy?.name ?? "—"}</td>
                    <td className="muted">{payment.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="暂无缴费记录" description="在上方表格中为幼儿登记缴费。" />
        )}
      </section>
    </>
  );
}
