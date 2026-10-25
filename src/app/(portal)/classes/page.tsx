import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff, teacherClassIds } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteClass } from "@/actions/classes";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function ClassesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireStaff();

  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");
  const isAdmin = user.role === "ADMIN";
  const scope = isAdmin ? undefined : await teacherClassIds(user.id);

  const classes = await prisma.schoolClass.findMany({
    where: isAdmin ? undefined : { id: { in: scope ?? [] } },
    include: {
      teacher: { include: { user: true } },
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });

  const totalStudents = classes.reduce(
    (sum, item) => sum + item._count.students,
    0,
  );

  return (
    <>
      <PageHeader
        title={isAdmin ? "班级管理" : "我的班级"}
        description={
          isAdmin
            ? `全园共 ${classes.length} 个班级、${totalStudents} 名幼儿，可调整班级与主班教师。`
            : `你负责 ${classes.length} 个班级，共 ${totalStudents} 名幼儿。`
        }
        actions={
          isAdmin ? (
            <Link href="/classes/new" className="btn btn-primary">
              + 新增班级
            </Link>
          ) : null
        }
      />
      <Alert error={error} success={success} />

      {classes.length ? (
        <div className="class-grid">
          {classes.map((item) => {
            const fill = Math.min(
              100,
              Math.round((item._count.students / item.capacity) * 100),
            );
            return (
              <section key={item.id} className="card class-card">
                <div className="class-card-head">
                  <div>
                    <h2>{item.name}</h2>
                    <p className="muted small">
                      {item.ageGroup} · {item.room ?? "未分配教室"}
                    </p>
                  </div>
                  <span className="class-count">
                    {item._count.students}
                    <span>/{item.capacity} 人</span>
                  </span>
                </div>
                <div className="progress">
                  <div
                    className={`progress-bar ${fill > 90 ? "amber" : "green"}`}
                    style={{ width: `${fill}%` }}
                  />
                </div>
                <div className="class-meta">
                  <span>主班教师</span>
                  <strong>{item.teacher?.user.name ?? "待分配"}</strong>
                </div>
                <div className="class-meta">
                  <span>教师电话</span>
                  <strong>{item.teacher?.phone ?? item.teacher?.user.phone ?? "—"}</strong>
                </div>
                <div className="class-actions">
                  <Link
                    href={`/students?classId=${item.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    查看幼儿
                  </Link>
                  <Link
                    href={`/schedule?classId=${item.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    课程表
                  </Link>
                  {isAdmin ? (
                    <>
                      <Link
                        href={`/classes/${item.id}/edit`}
                        className="btn btn-secondary btn-sm"
                      >
                        编辑
                      </Link>
                      <form action={deleteClass} className="inline-form">
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmButton
                          message={`确定删除班级「${item.name}」吗？仅当班级内没有幼儿时可删除。`}
                        >
                          删除
                        </ConfirmButton>
                      </form>
                    </>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title={isAdmin ? "尚未创建班级" : "暂未分配班级"}
            description={
              isAdmin
                ? "创建班级后即可为幼儿分班并安排课程。"
                : "请联系园务管理员分配班级。"
            }
          />
        </div>
      )}
    </>
  );
}
