import { prisma } from "@/lib/db";
import { requireUser, teacherClassIds } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createSchedule, deleteSchedule } from "@/actions/schedule";
import { WEEKDAYS } from "@/lib/constants";
import { getIntParam, getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");
  const isAdmin = user.role === "ADMIN";

  let classes;
  if (user.role === "ADMIN") {
    classes = await prisma.schoolClass.findMany({ orderBy: { name: "asc" } });
  } else if (user.role === "TEACHER") {
    const ids = await teacherClassIds(user.id);
    classes = await prisma.schoolClass.findMany({
      where: { id: { in: ids } },
      orderBy: { name: "asc" },
    });
  } else {
    classes = await prisma.schoolClass.findMany({
      where: { students: { some: { parentId: user.id } } },
      orderBy: { name: "asc" },
    });
  }

  const selectedClassId =
    getIntParam(searchParams, "classId") ?? classes[0]?.id ?? null;
  const selectedClass = classes.find((item) => item.id === selectedClassId);

  if (!selectedClass) {
    return (
      <>
        <PageHeader title="班级课程表" description="查看班级每周课程安排。" />
        <Alert error={error} success={success} />
        <div className="card">
          <EmptyState
            title={user.role === "PARENT" ? "尚未关联班级" : "暂无可用班级"}
            description={user.role === "PARENT" ? "请联系园务管理员绑定孩子档案。" : "请先创建班级。"}
          />
        </div>
      </>
    );
  }

  const schedules = await prisma.schedule.findMany({
    where: { classId: selectedClass.id },
    orderBy: [{ startTime: "asc" }, { weekday: "asc" }],
  });

  const slots = Array.from(
    new Map(
      schedules.map((item) => [
        `${item.startTime}-${item.endTime}`,
        { startTime: item.startTime, endTime: item.endTime },
      ]),
    ).values(),
  ).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <>
      <PageHeader
        title="班级课程表"
        description={`${selectedClass.name} · ${selectedClass.ageGroup} · 每周课程安排`}
        actions={
          <form method="get" className="inline-form">
            <select
              name="classId"
              defaultValue={selectedClass.id}
              className="compact-select"
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary btn-sm">
              切换班级
            </button>
          </form>
        }
      />
      <Alert error={error} success={success} />

      <section className="card">
        <div className="card-head">
          <h2>{selectedClass.name} · 周课程安排</h2>
          <span className="muted small">共 {schedules.length} 节课</span>
        </div>

        {schedules.length ? (
          <div className="table-wrap">
            <table className="timetable">
              <thead>
                <tr>
                  <th className="time-col">时间</th>
                  {WEEKDAYS.map((day) => (
                    <th key={day.value}>{day.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={`${slot.startTime}-${slot.endTime}`}>
                    <td className="time-col">
                      <strong>{slot.startTime}</strong>
                      <span>{slot.endTime}</span>
                    </td>
                    {WEEKDAYS.map((day) => {
                      const entries = schedules.filter(
                        (item) =>
                          item.weekday === day.value &&
                          item.startTime === slot.startTime &&
                          item.endTime === slot.endTime,
                      );
                      return (
                        <td key={day.value}>
                          {entries.length ? (
                            entries.map((entry) => (
                              <div key={entry.id} className="schedule-cell">
                                <div className="schedule-subject">{entry.subject}</div>
                                {entry.teacherName ? (
                                  <div className="schedule-teacher">
                                    {entry.teacherName}
                                  </div>
                                ) : null}
                                {isAdmin ? (
                                  <form action={deleteSchedule} className="schedule-delete">
                                    <input type="hidden" name="id" value={entry.id} />
                                    <ConfirmButton
                                      message={`确定删除「${entry.subject}」这节课吗？`}
                                      className="icon-btn"
                                    >
                                      ×
                                    </ConfirmButton>
                                  </form>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="本周暂无课程安排" description={isAdmin ? "使用下方表单添加课程。" : "老师添加课程后会显示在这里。"} />
        )}
      </section>

      {isAdmin ? (
        <section className="card form-card">
          <div className="form-section-head">
            <h2>添加课程</h2>
            <p>为 {selectedClass.name} 添加每周固定课程，同一时间段可安排多节课。</p>
          </div>
          <form action={createSchedule}>
            <input type="hidden" name="classId" value={selectedClass.id} />
            <div className="form-grid form-grid-5">
              <label className="field">
                <span>星期 *</span>
                <select name="weekday" defaultValue="1" required>
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>开始时间 *</span>
                <input type="time" name="startTime" defaultValue="08:30" required />
              </label>
              <label className="field">
                <span>结束时间 *</span>
                <input type="time" name="endTime" defaultValue="09:10" required />
              </label>
              <label className="field">
                <span>课程名称 *</span>
                <input name="subject" placeholder="如 语言表达" required />
              </label>
              <label className="field">
                <span>授课教师</span>
                <input name="teacherName" placeholder="可选" />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                添加课程
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
