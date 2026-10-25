import { ApiError, intParam, requireTeacherClass } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { isValidDateString, todayString } from "@/lib/format";
import { loadTeacherClasses } from "@/lib/services/teacher";

/** 解析 ?classId=；缺省用第一个班，未分配班级时返回 null。 */
export async function resolveTeacherClass(
  user: SessionUser,
  raw: string | null,
) {
  const classes = await loadTeacherClasses(user.id);
  if (raw === null || raw === "") {
    return { classes, classId: classes[0]?.id ?? null };
  }
  const classId = await requireTeacherClass(user, intParam(raw, "classId"));
  return { classes, classId };
}

/** 解析 ?date=YYYY-MM-DD，缺省为今天。 */
export function dateParam(raw: string | null): string {
  if (raw === null || raw === "") return todayString();
  if (!isValidDateString(raw)) {
    throw new ApiError("VALIDATION", "日期应为有效的 YYYY-MM-DD", 400);
  }
  return raw;
}
