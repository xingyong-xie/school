"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Gender, StudentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { hashPassword } from "@/lib/auth";
import {
  dateString,
  int,
  optionalStr,
  str,
  withError,
  withSuccess,
} from "@/lib/forms";

const GENDERS: Gender[] = ["MALE", "FEMALE"];
const STATUSES: StudentStatus[] = ["ACTIVE", "GRADUATED", "LEFT"];

type ParentResult = { id: number | null; error?: string };

async function resolveParent(
  formData: FormData,
  currentParentId: number | null,
): Promise<ParentResult> {
  const newPhone = str(formData, "newParentPhone");
  const newName = str(formData, "newParentName");

  if (newPhone) {
    const existing = await prisma.user.findUnique({ where: { username: newPhone } });
    if (existing) {
      if (existing.role !== "PARENT") {
        return { id: null, error: "该手机号已被教师或管理员账号占用" };
      }
      return { id: existing.id };
    }
    if (!newName) {
      return { id: null, error: "新建家长账号时请填写家长姓名" };
    }
    const created = await prisma.user.create({
      data: {
        username: newPhone,
        passwordHash: hashPassword("123456"),
        name: newName,
        role: "PARENT",
        phone: newPhone,
      },
    });
    return { id: created.id };
  }

  const rawParentId = str(formData, "parentId");
  if (!rawParentId) return { id: null };

  const parentId = int(formData, "parentId");
  if (!parentId) return { id: currentParentId };

  const parent = await prisma.user.findFirst({
    where: { id: parentId, role: "PARENT" },
    select: { id: true },
  });
  if (!parent) return { id: null, error: "所选家长账号不存在" };
  return { id: parent.id };
}

type StudentFields =
  | {
      ok: true;
      data: {
        name: string;
        studentNo: string;
        birthDate: Date;
        gender: Gender;
        status: StudentStatus;
        classId: number | null;
        phone: string | null;
        address: string | null;
        notes: string | null;
      };
    }
  | { ok: false; error: string };

function readStudentFields(formData: FormData): StudentFields {
  const name = str(formData, "name");
  const studentNo = str(formData, "studentNo");
  const birthDate = dateString(formData, "birthDate");
  const gender = str(formData, "gender") as Gender;
  const statusRaw = str(formData, "status") as StudentStatus;
  const status = STATUSES.includes(statusRaw) ? statusRaw : "ACTIVE";
  const classId = int(formData, "classId");

  if (!name) return { ok: false, error: "请填写幼儿姓名" };
  if (!studentNo) return { ok: false, error: "请填写学号" };
  if (!birthDate) return { ok: false, error: "请选择出生日期" };
  if (!GENDERS.includes(gender)) return { ok: false, error: "请选择性别" };

  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) {
    return { ok: false, error: "出生日期格式不正确" };
  }

  return {
    ok: true,
    data: {
      name,
      studentNo,
      birthDate: birth,
      gender,
      status,
      classId,
      phone: optionalStr(formData, "phone"),
      address: optionalStr(formData, "address"),
      notes: optionalStr(formData, "notes"),
    },
  };
}

export async function createStudent(formData: FormData): Promise<void> {
  await requireAdmin();

  const fields = readStudentFields(formData);
  if (!fields.ok) {
    redirect(withError("/students/new", fields.error));
  }

  const duplicate = await prisma.student.findUnique({
    where: { studentNo: fields.data.studentNo },
    select: { id: true },
  });
  if (duplicate) {
    redirect(withError("/students/new", "该学号已存在"));
  }

  if (fields.data.classId) {
    const schoolClass = await prisma.schoolClass.findUnique({
      where: { id: fields.data.classId },
      select: { id: true },
    });
    if (!schoolClass) {
      redirect(withError("/students/new", "所选班级不存在"));
    }
  }

  const parent = await resolveParent(formData, null);
  if (parent.error) {
    redirect(withError("/students/new", parent.error));
  }

  await prisma.student.create({
    data: {
      ...fields.data,
      parentId: parent.id,
      enrollmentDate: new Date(),
    },
  });

  revalidatePath("/students");
  revalidatePath("/");
  redirect(withSuccess("/students", `已添加幼儿「${fields.data.name}」`));
}

export async function updateStudent(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = int(formData, "id");
  if (!id) redirect(withError("/students", "参数错误"));

  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, studentNo: true, parentId: true },
  });
  if (!student) redirect(withError("/students", "幼儿档案不存在"));

  const fields = readStudentFields(formData);
  if (!fields.ok) {
    redirect(withError(`/students/${id}/edit`, fields.error));
  }

  const duplicate = await prisma.student.findFirst({
    where: { studentNo: fields.data.studentNo, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) {
    redirect(withError(`/students/${id}/edit`, "该学号已被其他幼儿使用"));
  }

  if (fields.data.classId) {
    const schoolClass = await prisma.schoolClass.findUnique({
      where: { id: fields.data.classId },
      select: { id: true },
    });
    if (!schoolClass) {
      redirect(withError(`/students/${id}/edit`, "所选班级不存在"));
    }
  }

  const parent = await resolveParent(formData, student.parentId);
  if (parent.error) {
    redirect(withError(`/students/${id}/edit`, parent.error));
  }

  await prisma.student.update({
    where: { id },
    data: { ...fields.data, parentId: parent.id },
  });

  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  revalidatePath("/");
  redirect(withSuccess(`/students/${id}`, "档案已更新"));
}

export async function deleteStudent(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = int(formData, "id");
  if (!id) redirect(withError("/students", "参数错误"));

  const student = await prisma.student.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!student) redirect(withError("/students", "幼儿档案不存在"));

  await prisma.student.delete({ where: { id } });

  revalidatePath("/students");
  revalidatePath("/");
  redirect(withSuccess("/students", `已删除幼儿「${student.name}」的档案`));
}
