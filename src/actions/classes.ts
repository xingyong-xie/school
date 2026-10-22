"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { int, optionalStr, str, withError, withSuccess } from "@/lib/forms";

type ClassFields =
  | {
      ok: true;
      data: {
        name: string;
        ageGroup: string;
        capacity: number;
        room: string | null;
        teacherId: number | null;
      };
    }
  | { ok: false; error: string };

function readClassFields(formData: FormData): ClassFields {
  const name = str(formData, "name");
  const ageGroup = str(formData, "ageGroup");
  const capacity = int(formData, "capacity") ?? 25;
  const room = optionalStr(formData, "room");
  const teacherId = int(formData, "teacherId");

  if (!name) return { ok: false, error: "请填写班级名称" };
  if (!ageGroup) return { ok: false, error: "请填写年龄段" };
  if (capacity < 1 || capacity > 60) {
    return { ok: false, error: "班级容量应在 1-60 之间" };
  }

  return {
    ok: true,
    data: { name, ageGroup, capacity, room, teacherId: teacherId ?? null },
  };
}

async function validateTeacher(teacherId: number | null): Promise<string | null> {
  if (!teacherId) return null;
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true },
  });
  return teacher ? null : "所选教师不存在";
}

export async function createClass(formData: FormData): Promise<void> {
  await requireAdmin();

  const fields = readClassFields(formData);
  if (!fields.ok) redirect(withError("/classes", fields.error));

  const duplicate = await prisma.schoolClass.findUnique({
    where: { name: fields.data.name },
    select: { id: true },
  });
  if (duplicate) redirect(withError("/classes", "班级名称已存在"));

  const teacherError = await validateTeacher(fields.data.teacherId);
  if (teacherError) redirect(withError("/classes", teacherError));

  await prisma.schoolClass.create({ data: fields.data });

  revalidatePath("/classes");
  revalidatePath("/");
  redirect(withSuccess("/classes", `已创建班级「${fields.data.name}」`));
}

export async function updateClass(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = int(formData, "id");
  if (!id) redirect(withError("/classes", "参数错误"));

  const schoolClass = await prisma.schoolClass.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!schoolClass) redirect(withError("/classes", "班级不存在"));

  const fields = readClassFields(formData);
  if (!fields.ok) redirect(withError(`/classes/${id}/edit`, fields.error));

  const duplicate = await prisma.schoolClass.findFirst({
    where: { name: fields.data.name, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) redirect(withError(`/classes/${id}/edit`, "班级名称已存在"));

  const teacherError = await validateTeacher(fields.data.teacherId);
  if (teacherError) redirect(withError(`/classes/${id}/edit`, teacherError));

  await prisma.schoolClass.update({ where: { id }, data: fields.data });

  revalidatePath("/classes");
  revalidatePath(`/classes/${id}`);
  revalidatePath("/");
  redirect(withSuccess("/classes", "班级信息已更新"));
}

export async function deleteClass(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = int(formData, "id");
  if (!id) redirect(withError("/classes", "参数错误"));

  const schoolClass = await prisma.schoolClass.findUnique({
    where: { id },
    include: { _count: { select: { students: true } } },
  });
  if (!schoolClass) redirect(withError("/classes", "班级不存在"));

  if (schoolClass._count.students > 0) {
    redirect(
      withError(
        "/classes",
        `「${schoolClass.name}」仍有 ${schoolClass._count.students} 名幼儿，请先调整幼儿班级`,
      ),
    );
  }

  await prisma.schoolClass.delete({ where: { id } });

  revalidatePath("/classes");
  revalidatePath("/");
  redirect(withSuccess("/classes", `已删除班级「${schoolClass.name}」`));
}
