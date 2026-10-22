import { handle, requireChild, requireParent } from "@/lib/api";
import { ok } from "@/lib/json";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { buildChildFees, loadParentFinance } from "@/lib/services/parent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireParent();
    const child = await requireChild(user, Number(params.id));
    const finance = await loadParentFinance([child.id]);
    const { summary, items } = buildChildFees(
      finance.feeItems,
      finance.payments,
      child.id,
    );

    return ok({
      child: { id: child.id, name: child.name },
      summary,
      items,
      payments: finance.payments
        .filter((payment) => payment.studentId === child.id)
        .map((payment) => ({
          id: payment.id,
          feeItemId: payment.feeItemId,
          feeItemName: payment.feeItem.name,
          amountCents: payment.amountCents,
          method: payment.method,
          methodLabel:
            PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
          date: fmtDate(payment.paidAt),
          note: payment.note,
        })),
    });
  });
}
