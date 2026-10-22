import "server-only";

import type { FeeItem, Payment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todayString } from "@/lib/format";

export type PaymentWithItem = Payment & { feeItem: FeeItem };
export type FeeStatus = "PAID" | "PARTIAL" | "UNPAID";

export type ChildFeeItem = {
  feeItemId: number;
  name: string;
  term: string;
  description: string | null;
  amountCents: number;
  paidCents: number;
  remainingCents: number;
  dueDate: string;
  status: FeeStatus;
  overdue: boolean;
};

/** 读入收费项目与孩子缴费记录（一次查询供多个孩子复用）。 */
export async function loadParentFinance(childIds: number[]) {
  const [feeItems, payments] = await Promise.all([
    prisma.feeItem.findMany({ orderBy: [{ dueDate: "asc" }, { id: "asc" }] }),
    prisma.payment.findMany({
      where: { studentId: { in: childIds } },
      include: { feeItem: true, student: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
    }),
  ]);
  return { feeItems, payments };
}

export function feeStatus(amountCents: number, paidCents: number): FeeStatus {
  if (paidCents >= amountCents) return "PAID";
  if (paidCents > 0) return "PARTIAL";
  return "UNPAID";
}

/**
 * 按收费项目逐项计算余额：剩余 = max(0, 项目金额 - 该项目已缴)。
 * 项目之间互不抵扣；金额始终为整数分。
 */
export function buildChildFees(
  feeItems: FeeItem[],
  payments: PaymentWithItem[],
  childId: number,
  today = todayString(),
) {
  const paidByItem = new Map<number, number>();
  for (const payment of payments) {
    if (payment.studentId !== childId) continue;
    paidByItem.set(
      payment.feeItemId,
      (paidByItem.get(payment.feeItemId) ?? 0) + payment.amountCents,
    );
  }

  const items: ChildFeeItem[] = feeItems.map((item) => {
    const paidCents = paidByItem.get(item.id) ?? 0;
    const remainingCents = Math.max(0, item.amountCents - paidCents);
    return {
      feeItemId: item.id,
      name: item.name,
      term: item.term,
      description: item.description,
      amountCents: item.amountCents,
      paidCents,
      remainingCents,
      dueDate: item.dueDate,
      status: feeStatus(item.amountCents, paidCents),
      overdue: remainingCents > 0 && item.dueDate < today,
    };
  });

  const summary = {
    totalAmountCents: items.reduce((sum, item) => sum + item.amountCents, 0),
    totalPaidCents: items.reduce((sum, item) => sum + item.paidCents, 0),
    totalOutstandingCents: items.reduce(
      (sum, item) => sum + item.remainingCents,
      0,
    ),
  };

  return { summary, items };
}
