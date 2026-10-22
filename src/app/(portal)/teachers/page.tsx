import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteTeacher } from "@/actions/teachers";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function TeachersPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireAdmin();
  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");

  const teachers = await prisma.teacher.findMany({
    include: {
      user: true,
      classes: { select: { id: true, name: true } },
    },
    orderBy: { employeeNo: "asc" },
  });

  return (
    <>
      <PageHeader
        title="教师管理"
        description={`共 ${teachers.length} 名教师。创建账号后，教师可登录管理自己班级的考勤与请假。`}
        actions={
          <Link href="/teachers/new" className="btn btn-primary">
            + 新增教师
          </Link>
        }
      />
      <Alert error={error} success={success} />

      <section className="card">
        {teachers.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>工号</th>
                  <th>姓名</th>
                  <th>专业特长</th>
                  <th>负责班级</th>
                  <th>联系方式</th>
                  <th>登录账号</th>
                  <th className="right">操作</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className="mono">{teacher.employeeNo}</td>
                    <td>{teacher.user.name}</td>
                    <td className="muted">{teacher.specialty ?? "—"}</td>
                    <td>
                      {teacher.classes.length ? (
                        <div className="tag-list">
                          {teacher.classes.map((item) => (
                            <span key={item.id} className="tag">
                              {item.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">未分配</span>
                      )}
                    </td>
                    <td className="muted">{teacher.phone ?? teacher.user.phone ?? "—"}</td>
                    <td className="mono">{teacher.user.username}</td>
                    <td className="right">
                      <div className="row-actions">
                        <Link
                          href={`/teachers/${teacher.id}/edit`}
                          className="btn btn-secondary btn-sm"
                        >
                          编辑
                        </Link>
                        <form action={deleteTeacher} className="inline-form">
                          <input type="hidden" name="id" value={teacher.id} />
                          <ConfirmButton
                            message={`确定删除教师「${teacher.user.name}」及其登录账号吗？`}
                          >
                            删除
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="暂无教师" description="新增教师后即可分配班级。" />
        )}
      </section>
    </>
  );
}
