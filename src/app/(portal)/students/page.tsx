import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, teacherClassIds } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteStudent } from "@/actions/students";
import {
  GENDER_LABELS,
  STUDENT_STATUS_LABELS,
  categoryTone,
} from "@/lib/constants";
import { calcAge, fmtDate } from "@/lib/format";
import { getParam, getIntParam, type SearchParams } from "@/lib/params";
import type { StudentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: StudentStatus[] = ["ACTIVE", "GRADUATED", "LEFT"];

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");
  const q = getParam(searchParams, "q") ?? "";
  const classId = getIntParam(searchParams, "classId");
  const statusParam = getParam(searchParams, "status") ?? "ACTIVE";

  const isParent = user.role === "PARENT";

  const classScope =
    user.role === "TEACHER" ? await teacherClassIds(user.id) : undefined;

  const classes = await prisma.schoolClass.findMany({
    where:
      user.role === "TEACHER"
        ? { id: { in: classScope ?? [] } }
        : user.role === "PARENT"
          ? { students: { some: { parentId: user.id } } }
          : undefined,
    orderBy: { name: "asc" },
  });

  const where: Prisma.StudentWhereInput = {};
  if (isParent) {
    where.parentId = user.id;
  } else {
    if (user.role === "TEACHER") {
      where.classId = { in: classScope ?? [] };
    }
    if (classId) where.classId = classId;
    if (q) {
      where.OR = [{ name: { contains: q } }, { studentNo: { contains: q } }];
    }
    if (statusParam !== "ALL") {
      where.status = STATUS_OPTIONS.includes(statusParam as StudentStatus)
        ? (statusParam as StudentStatus)
        : "ACTIVE";
    }
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      class: { include: { teacher: { include: { user: true } } } },
      parent: true,
    },
    orderBy: [{ status: "asc" }, { studentNo: "asc" }],
  });

  return (
    <>
      <PageHeader
        title={isParent ? "我的孩子" : "幼儿档案"}
        description={
          isParent
            ? "查看孩子在园的基本信息、考勤与缴费情况。"
            : "维护幼儿学籍、班级与家长账号，支持按班级和姓名检索。"
        }
        actions={
          user.role === "ADMIN" ? (
            <Link href="/students/new" className="btn btn-primary">
              + 新增幼儿
            </Link>
          ) : null
        }
      />
      <Alert error={error} success={success} />

      {isParent ? (
        students.length ? (
          <div className="child-grid wide">
            {students.map((child) => (
              <Link key={child.id} href={`/students/${child.id}`} className="child-card">
                <div className="child-top">
                  <div className="avatar large">{child.name.slice(0, 1)}</div>
                  <div>
                    <div className="child-name">{child.name}</div>
                    <div className="muted small">
                      {child.class?.name ?? "未分班"} · {calcAge(child.birthDate)} 岁
                    </div>
                  </div>
                  <Badge tone={categoryTone(child.status)}>
                    {STUDENT_STATUS_LABELS[child.status]}
                  </Badge>
                </div>
                <div className="child-meta">
                  <span>学号 <strong>{child.studentNo}</strong></span>
                  <span>入园 <strong>{fmtDate(child.enrollmentDate)}</strong></span>
                </div>
                <div className="child-teacher">
                  主班教师：{child.class?.teacher?.user.name ?? "待分配"}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState title="尚未关联孩子档案" description="请联系园务管理员绑定家长账号。" />
          </div>
        )
      ) : (
        <>
          <div className="card filter-card">
            <form method="get" className="filter-form">
              <label className="field compact">
                <span>搜索</span>
                <input name="q" defaultValue={q} placeholder="姓名或学号" />
              </label>
              <label className="field compact">
                <span>班级</span>
                <select name="classId" defaultValue={classId ?? ""}>
                  <option value="">全部班级</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field compact">
                <span>状态</span>
                <select name="status" defaultValue={statusParam}>
                  <option value="ACTIVE">在园</option>
                  <option value="GRADUATED">已毕业</option>
                  <option value="LEFT">已离园</option>
                  <option value="ALL">全部</option>
                </select>
              </label>
              <div className="filter-actions">
                <button type="submit" className="btn btn-primary btn-sm">筛选</button>
                <Link href="/students" className="btn btn-secondary btn-sm">重置</Link>
              </div>
            </form>
          </div>

          <section className="card">
            <div className="card-head">
              <h2>共 {students.length} 名幼儿</h2>
            </div>
            {students.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>学号</th>
                      <th>姓名</th>
                      <th>性别</th>
                      <th>年龄</th>
                      <th>班级</th>
                      <th>家长</th>
                      <th>状态</th>
                      <th className="right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td className="mono">{student.studentNo}</td>
                        <td>
                          <Link href={`/students/${student.id}`} className="table-link">
                            {student.name}
                          </Link>
                        </td>
                        <td>{GENDER_LABELS[student.gender]}</td>
                        <td>{calcAge(student.birthDate)} 岁</td>
                        <td className="muted">{student.class?.name ?? "未分班"}</td>
                        <td className="muted">
                          {student.parent ? (
                            <>
                              {student.parent.name}
                              <span className="small"> · {student.parent.phone ?? student.parent.username}</span>
                            </>
                          ) : (
                            "未绑定"
                          )}
                        </td>
                        <td>
                          <Badge tone={categoryTone(student.status)}>
                            {STUDENT_STATUS_LABELS[student.status]}
                          </Badge>
                        </td>
                        <td className="right">
                          <div className="row-actions">
                            <Link href={`/students/${student.id}`} className="btn btn-secondary btn-sm">
                              查看
                            </Link>
                            {user.role === "ADMIN" ? (
                              <>
                                <Link href={`/students/${student.id}/edit`} className="btn btn-secondary btn-sm">
                                  编辑
                                </Link>
                                <form action={deleteStudent} className="inline-form">
                                  <input type="hidden" name="id" value={student.id} />
                                  <ConfirmButton message={`确定删除 ${student.name} 的档案吗？相关考勤、请假和缴费记录也会一并删除。`}>
                                    删除
                                  </ConfirmButton>
                                </form>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="没有符合条件的幼儿" description="尝试调整筛选条件或新增幼儿档案。" />
            )}
          </section>
        </>
      )}
    </>
  );
}
