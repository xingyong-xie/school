import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, teacherClassIds } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { saveAttendance } from "@/actions/attendance";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  categoryTone,
} from "@/lib/constants";
import { fmtDate, todayString } from "@/lib/format";
import { getIntParam, getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

const STATUS_TONE_CLASS: Record<string, string> = {
  PRESENT: "select-green",
  LATE: "select-amber",
  SICK: "select-blue",
  PERSONAL: "select-blue",
  ABSENT: "select-red",
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");
  const today = todayString();

  if (user.role === "PARENT") {
    const month = getParam(searchParams, "month") ?? today.slice(0, 7);
    const children = await prisma.student.findMany({
      where: { parentId: user.id },
      include: { class: true },
      orderBy: { name: "asc" },
    });
    const childIds = children.map((item) => item.id);
    const records = await prisma.attendance.findMany({
      where: {
        studentId: { in: childIds },
        date: { gte: `${month}-01`, lte: `${month}-31` },
      },
      include: { student: { include: { class: true } } },
      orderBy: [{ date: "desc" }, { student: { name: "asc" } }],
    });

    const counts = (["PRESENT", "SICK", "PERSONAL", "ABSENT", "LATE"] as const).map(
      (status) => ({
        status,
        count: records.filter((item) => item.status === status).length,
      }),
    );
    const present = records.filter(
      (item) => item.status === "PRESENT" || item.status === "LATE",
    ).length;

    return (
      <>
        <PageHeader
          title="考勤记录"
          description="查看孩子在园出勤情况，请假可通过「请假管理」提交申请。"
          actions={
            <Link href="/leaves" className="btn btn-primary">
              提交请假
            </Link>
          }
        />
        <Alert error={error} success={success} />

        <div className="stats-grid">
          <StatCard label={`${month} 出勤`} value={`${present} 天`} hint={`共 ${records.length} 条记录`} icon="✓" />
          <StatCard label="病假" value={`${counts.find((item) => item.status === "SICK")?.count ?? 0} 天`} icon="☷" tone="blue" />
          <StatCard label="事假" value={`${counts.find((item) => item.status === "PERSONAL")?.count ?? 0} 天`} icon="◷" tone="amber" />
          <StatCard label="缺勤" value={`${counts.find((item) => item.status === "ABSENT")?.count ?? 0} 天`} icon="!" tone="rose" />
        </div>

        <div className="card filter-card">
          <form method="get" className="filter-form">
            <label className="field compact">
              <span>查看月份</span>
              <input type="month" name="month" defaultValue={month} />
            </label>
            <div className="filter-actions">
              <button type="submit" className="btn btn-primary btn-sm">查询</button>
            </div>
          </form>
        </div>

        <section className="card">
          <div className="card-head">
            <h2>考勤明细</h2>
            <span className="muted small">{children.length} 个孩子</span>
          </div>
          {records.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>幼儿</th>
                    <th>班级</th>
                    <th>状态</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      <td>{record.student.name}</td>
                      <td className="muted">{record.student.class?.name ?? "—"}</td>
                      <td>
                        <Badge tone={categoryTone(record.status)}>
                          {ATTENDANCE_LABELS[record.status]}
                        </Badge>
                      </td>
                      <td className="muted">{record.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="本月暂无考勤记录" description="老师登记考勤后会显示在这里。" />
          )}
        </section>
      </>
    );
  }

  const isAdmin = user.role === "ADMIN";
  const allowedClassIds = isAdmin ? null : await teacherClassIds(user.id);
  const classes = await prisma.schoolClass.findMany({
    where: isAdmin ? undefined : { id: { in: allowedClassIds ?? [] } },
    orderBy: { name: "asc" },
  });

  const date = getParam(searchParams, "date") ?? today;
  const selectedClassId =
    getIntParam(searchParams, "classId") ?? classes[0]?.id ?? null;
  const selectedClass = classes.find((item) => item.id === selectedClassId);

  if (!selectedClass) {
    return (
      <>
        <PageHeader title="考勤登记" description="选择一个班级开始登记今日考勤。" />
        <Alert error={error} success={success} />
        <div className="card">
          <EmptyState
            title={isAdmin ? "请先创建班级" : "暂未分配班级"}
            description={isAdmin ? "前往班级管理创建班级并添加幼儿。" : "请联系园务管理员分配班级。"}
          />
        </div>
      </>
    );
  }

  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { classId: selectedClass.id, status: "ACTIVE" },
      orderBy: { studentNo: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        date,
        student: { classId: selectedClass.id },
      },
    }),
  ]);

  const recordMap = new Map(records.map((record) => [record.studentId, record]));
  const presentCount = records.filter(
    (item) => item.status === "PRESENT" || item.status === "LATE",
  ).length;
  const savedCount = records.length;

  return (
    <>
      <PageHeader
        title="考勤登记"
        description="按班级登记每日出勤，已登记时可随时修改并重新保存。"
        actions={
          <Link href="/leaves" className="btn btn-secondary">
            查看请假
          </Link>
        }
      />
      <Alert error={error} success={success} />

      <div className="stats-grid">
        <StatCard label="班级幼儿" value={students.length} hint={selectedClass.name} icon="☺" />
        <StatCard label="已登记" value={`${savedCount} 人`} hint={`${students.length - savedCount} 人待登记`} icon="✓" tone="blue" />
        <StatCard label="出勤人数" value={`${presentCount} 人`} hint="含迟到" icon="☀" tone="amber" />
        <StatCard
          label="出勤率"
          value={savedCount ? `${Math.round((presentCount / savedCount) * 100)}%` : "—"}
          hint={fmtDate(date)}
          icon="%"
          tone="rose"
        />
      </div>

      <div className="card filter-card">
        <form method="get" className="filter-form">
          <label className="field compact">
            <span>班级</span>
            <select name="classId" defaultValue={selectedClass.id}>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact">
            <span>日期</span>
            <input type="date" name="date" defaultValue={date} />
          </label>
          <div className="filter-actions">
            <button type="submit" className="btn btn-secondary btn-sm">切换</button>
          </div>
        </form>
      </div>

      <form action={saveAttendance} className="card">
        <input type="hidden" name="classId" value={selectedClass.id} />
        <input type="hidden" name="date" value={date} />

        <div className="card-head">
          <h2>
            {selectedClass.name} · {date}
          </h2>
          <div className="head-actions">
            <span className="muted small">{students.length} 名在园幼儿</span>
            <button type="submit" className="btn btn-primary btn-sm">
              保存考勤
            </button>
          </div>
        </div>

        {students.length ? (
          <div className="table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>学号</th>
                  <th>幼儿</th>
                  <th>状态</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const existing = recordMap.get(student.id);
                  return (
                    <tr key={student.id}>
                      <td className="mono">{student.studentNo}</td>
                      <td>
                        <div className="student-cell">
                          <span className="avatar small">{student.name.slice(0, 1)}</span>
                          {student.name}
                        </div>
                      </td>
                      <td>
                        <select
                          name={`status_${student.id}`}
                          defaultValue={existing?.status ?? "PRESENT"}
                          className={`status-select ${STATUS_TONE_CLASS[existing?.status ?? "PRESENT"] ?? ""}`}
                        >
                          {ATTENDANCE_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {ATTENDANCE_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          name={`note_${student.id}`}
                          defaultValue={existing?.note ?? ""}
                          placeholder="可选备注"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="班级暂无幼儿" description="请先在幼儿档案中为该班分配幼儿。" />
        )}

        {students.length ? (
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              保存 {date} 的考勤
            </button>
          </div>
        ) : null}
      </form>
    </>
  );
}
