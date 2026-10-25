"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import {
  dateString,
  int,
  optionalStr,
  str,
  withError,
  withSuccess,
} from "@/lib/forms";
import { PAYMENT_METHODS } from "@/lib/constants";
import { isValidDateString, yuanToCents } from "@/lib/format";

export async function createFeeItem(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = str(formData, "name");
  const term = str(formData, "term");
  const amountCents = yuanToCents(str(formData, "amount"));
  const dueDate = dateString(formData, "dueDate");
  const description = optionalStr(formData, "description");

  if (!name) redirect(withError("/fees", "请填写收费项目名称"));
  if (!term) redirect(withError("/fees", "请填写所属学期"));
  if (amountCents <= 0) redirect(withError("/fees", "收费金额必须大于 0"));
  if (!isValidDateString(dueDate)) {
    redirect(withError("/fees", "请选择有效的缴费截止日期"));
  }

  const duplicate = await prisma.feeItem.findUnique({
    where: { name_term: { name, term } },
    select: { id: true },
  });
  if (duplicate) redirect(withError("/fees", "同一学期下已存在同名收费项目"));

  await prisma.feeItem.create({
    data: { name, term, amountCents, dueDate, description },
  });

  revalidatePath("/fees");
  revalidatePath("/");
  redirect(withSuccess("/fees", `已创建收费项目「${name}」`));
}

export async function deleteFeeItem(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = int(formData, "id");
  if (!id) redirect(withError("/fees", "参数错误"));

  const feeItem = await prisma.feeItem.findUnique({
    where: { id },
    include: { _count: { select: { payments: true } } },
  });
  if (!feeItem) redirect(withError("/fees", "收费项目不存在"));

  if (feeItem._count.payments > 0) {
    redirect(withError("/fees", "该项目已有缴费记录，不能删除"));
  }

  await prisma.feeItem.delete({ where: { id } });

  revalidatePath("/fees");
  revalidatePath("/");
  redirect(withSuccess("/fees", `已删除收费项目「${feeItem.name}」`));
}

export async function recordPayment(formData: FormData): Promise<void> {
  const user = await requireAdmin();

  const studentId = int(formData, "studentId");
  const feeItemId = int(formData, "feeItemId");
  const amountCents = yuanToCents(str(formData, "amount"));
  const method = str(formData, "method") || "TRANSFER";
  const note = optionalStr(formData, "note");
  const back = `/fees/${feeItemId ?? ""}`;

  if (!studentId) redirect(withError(back, "请选择幼儿"));
  if (!feeItemId) redirect(withError("/fees", "收费项目不存在"));
  if (amountCents <= 0) redirect(withError(back, "缴费金额必须大于 0"));
  if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
    redirect(withError(back, "请选择正确的支付方式"));
  }

  const [student, feeItem, paidAggregate] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true, name: true } }),
    prisma.feeItem.findUnique({ where: { id: feeItemId } }),
    prisma.payment.aggregate({
      where: { studentId, feeItemId },
      _sum: { amountCents: true },
    }),
  ]);

  if (!student) redirect(withError(back, "幼儿不存在"));
  if (!feeItem) redirect(withError("/fees", "收费项目不存在"));

  const paid = paidAggregate._sum.amountCents ?? 0;
  const outstanding = feeItem.amountCents - paid;
  if (outstanding <= 0) redirect(withError(back, `${student.name} 该项目已缴清`));
  if (amountCents > outstanding) {
    redirect(
      withError(back, `缴费金额超过应缴余额（${(outstanding / 100).toFixed(2)} 元）`),
    );
  }

  await prisma.payment.create({
    data: {
      studentId,
      feeItemId,
      amountCents,
      method,
      note,
      recordedById: user.id,
    },
  });

  revalidatePath(`/fees/${feeItemId}`);
  revalidatePath("/fees");
  revalidatePath("/");
  redirect(withSuccess(back, `已登记 ${student.name} 的缴费`));
}
