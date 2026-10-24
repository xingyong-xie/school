import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, teacherClassIds } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteDiary } from "@/actions/diaries";
import { categoryTone, DIARY_MOOD_LABELS } from "@/lib/constants";
import { fmtDate, fmtDateTime, todayString } from "@/lib/format";
import { signMediaToken } from "@/lib/auth";
import {
  diaryMediaUrl,
  diaryScopeWhere,
  diaryTargetWhere,
  DIARY_MONTH_PATTERN,
} from "@/lib/diary";
import { getIntParam, getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function DiariesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  const error = getParam(searchParams, "error");
  const success = getParam(searchParams, "success");

  const monthParamValue = getParam(searchParams, "month");
  const month =
    monthParamValue && DIARY_MONTH_PATTERN.test(monthParamValue)
      ? monthParamValue
      : todayString().slice(0, 7);

  const isParent = user.role === "PARENT";
  const isStaff = !isParent;
  const mediaToken = signMediaToken(user);
  const studentId = getIntParam(searchParams, "studentId");
  const classId = isStaff ? getIntParam(searchParams, "classId") : undefined;

  const teacherClasses =
    user.role === "TEACHER" ? await teacherClassIds(user.id) : [];

  const classes = isStaff
    ? await prisma.schoolClass.findMany({
        where: user.role === "TEACHER" ? { id: { in: teacherClasses } } : {},
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const and: Prisma.DiaryEntryWhereInput[] = [
    { date: { gte: `${month}-01`, lte: `${month}-31` } },
  ];
  const scope = diaryScopeWhere(user);
  if (scope) and.push(scope);
  and.push(...diaryTargetWhere({ studentId, classId }));

  const entries = await prisma.diaryEntry.findMany({
    where: { AND: and },
    include: {
      student: {
        select: { id: true, name: true, classId: true, class: { select: { name: true } } },
      },
      class: { select: { id: true, name: true } },
      author: { select: { name: true } },
      photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const photoCount = entries.reduce((sum, entry) => sum + entry.photos.length, 0);
  const attentionCount = entries.filter(
    (entry) => entry.mood === "NEEDS_ATTENTION",
  ).length;

  const query = new URLSearchParams({ month });
  if (classId) query.set("classId", String(classId));
  if (studentId) query.set("studentId", String(studentId));
  const currentUrl = `/diaries?${query.toString()}`;
  const selectedStudentName = entries.find(
    (entry) => entry.studentId === studentId,
  )?.student?.name;

  const createQuery = new URLSearchParams({ returnTo: currentUrl });
  if (studentId) createQuery.set("studentId", String(studentId));
  if (classId) createQuery.set("classId", String(classId));
  const createHref = `/diaries/new?${createQuery.toString()}`;

  function canEditEntry(entry: (typeof entries)[number]): boolean {
    if (user.role === "ADMIN") return true;
    if (user.role !== "TEACHER") return false;
    if (entry.authorId === user.id) return true;
    if (entry.classId !== null && teacherClasses.includes(entry.classId)) {
      return true;
    }
    return (
      entry.student?.classId !== null &&
      entry.student?.classId !== undefined &&
      teacherClasses.includes(entry.student.classId)
    );
  }

  return (
    <>
      <PageHeader
        title="成长日记"
        description={
          isParent
            ? "查看老师为孩子和班级记录的成长点滴，照片与文字会按月整理。"
            : "可记录单个幼儿或整个班级的表现与活动，家长可在 Web 端和小程序中查看。"
        }
        actions={
          isStaff ? (
            <Link href={createHref} className="btn btn-primary">
              写一篇日记
            </Link>
          ) : (
            <Link href="/students" className="btn btn-secondary">
              我的孩子
            </Link>
          )
        }
      />
      <Alert error={error} success={success} />

      <div className="stats-grid">
        <StatCard label="本月日记" value={entries.length} hint={`${month} 共记录`} icon="✿" />
        <StatCard label="照片" value={photoCount} hint="记录精彩瞬间" icon="▣" tone="blue" />
        <StatCard label="需关注" value={attentionCount} hint="标记为需关注的日记" icon="!" tone="amber" />
      </div>

      <section className="card filter-card">
        <form method="get" className="filter-form">
          <label className="field compact">
            <span>月份</span>
            <input type="month" name="month" defaultValue={month} />
          </label>
          {isStaff ? (
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
          ) : null}
          {studentId ? (
            <>
              <input type="hidden" name="studentId" value={studentId} />
              <div className="muted small filter-note">
                当前仅看：{selectedStudentName ?? "指定幼儿"}
              </div>
            </>
          ) : null}
          <div className="filter-actions">
            <button type="submit" className="btn btn-secondary btn-sm">
              查询
            </button>
            <Link href="/diaries" className="btn btn-secondary btn-sm">
              重置
            </Link>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{month} 的成长记录</h2>
          <span className="muted small">{entries.length} 篇</span>
        </div>

        {entries.length ? (
          <div className="diary-list">
            {entries.map((entry) => (
              <article key={entry.id} className="diary-item">
                <div className="diary-meta">
                  <time>{fmtDate(entry.date)}</time>
                  {isStaff ? (
                    entry.classId !== null ? (
                      <span>全班 · {entry.class?.name ?? "未分班"}</span>
                    ) : (
                      <span>
                        {entry.student?.name}
                        <span className="muted">
                          {" "}
                          · {entry.student?.class?.name ?? "未分班"}
                        </span>
                      </span>
                    )
                  ) : null}
                  {entry.classId !== null ? (
                    <Badge tone="blue">班级</Badge>
                  ) : null}
                  <Badge tone={entry.mood ? categoryTone(entry.mood) : "gray"}>
                    {entry.mood ? DIARY_MOOD_LABELS[entry.mood] : "未标注"}
                  </Badge>
                  <span className="muted">
                    {entry.author?.name ? `${entry.author.name} 老师` : "园务"} ·{" "}
                    {fmtDateTime(entry.updatedAt)}
                  </span>
                </div>

                {entry.title ? <h3 className="diary-title">{entry.title}</h3> : null}
                <div className="diary-content">{entry.content}</div>

                {entry.photos.length ? (
                  <div className="diary-photos">
                    {entry.photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={diaryMediaUrl(photo.id, mediaToken)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={diaryMediaUrl(photo.id, mediaToken)}
                          alt="成长日记照片"
                          className="diary-photo"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}

                {canEditEntry(entry) ? (
                  <div className="row-actions diary-actions">
                    <Link
                      href={`/diaries/${entry.id}/edit`}
                      className="btn btn-secondary btn-sm"
                    >
                      编辑
                    </Link>
                    <form action={deleteDiary} className="inline-form">
                      <input type="hidden" name="id" value={entry.id} />
                      <input type="hidden" name="returnTo" value={currentUrl} />
                      <ConfirmButton message="确定删除这篇成长日记吗？">
                        删除
                      </ConfirmButton>
                    </form>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="本月暂无成长日记"
            description={
              isStaff
                ? "点击右上角「写一篇日记」，记录孩子或班级的成长瞬间。"
                : "老师记录后会在这里显示，可切换月份查看历史日记。"
            }
          />
        )}
      </section>
    </>
  );
}
