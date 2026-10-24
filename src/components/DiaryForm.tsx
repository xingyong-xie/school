import Link from "next/link";
import type { DiaryMood } from "@prisma/client";
import { DiaryPhotoPicker } from "@/components/DiaryPhotoPicker";
import {
  DiaryTargetPicker,
  type DiaryTargetType,
} from "@/components/DiaryTargetPicker";
import { DIARY_MOODS, DIARY_MOOD_LABELS } from "@/lib/constants";
import { todayString } from "@/lib/format";
import { MAX_PHOTOS } from "@/lib/diary";

type StudentOption = {
  id: number;
  name: string;
  className: string | null;
};

type DiaryFormEntry = {
  id: number;
  studentId: number | null;
  classId: number | null;
  targetLabel: string;
  date: string;
  title: string | null;
  content: string;
  mood: DiaryMood | null;
  photos: { id: number; url: string }[];
};

export function DiaryForm({
  mode,
  action,
  students = [],
  classes = [],
  entry,
  defaultType = "CHILD",
  defaultStudentId,
  defaultClassId,
  returnTo,
}: {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  students?: StudentOption[];
  classes?: { id: number; name: string }[];
  entry?: DiaryFormEntry;
  defaultType?: DiaryTargetType;
  defaultStudentId?: number;
  defaultClassId?: number;
  returnTo: string;
}) {
  return (
    <form action={action} className="card form-card">
      <input type="hidden" name="returnTo" value={returnTo} />
      {mode === "edit" && entry ? (
        <input type="hidden" name="id" value={entry.id} />
      ) : null}

      <div className="form-grid">
        {mode === "create" ? (
          <DiaryTargetPicker
            students={students}
            classes={classes}
            defaultType={defaultType}
            defaultStudentId={defaultStudentId}
            defaultClassId={defaultClassId}
          />
        ) : (
          <div className="field span-2">
            <span>记录对象</span>
            <div className="field-static">{entry?.targetLabel}</div>
          </div>
        )}

        <label className="field">
          <span>日期 *</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={entry?.date ?? todayString()}
          />
        </label>

        <label className="field">
          <span>标题</span>
          <input
            name="title"
            maxLength={60}
            defaultValue={entry?.title ?? ""}
            placeholder="可选，例如：第一次独立完成拼图"
          />
        </label>

        <label className="field">
          <span>心情标签</span>
          <select name="mood" defaultValue={entry?.mood ?? ""}>
            <option value="">未标注</option>
            {DIARY_MOODS.map((mood) => (
              <option key={mood} value={mood}>
                {DIARY_MOOD_LABELS[mood]}
              </option>
            ))}
          </select>
        </label>

        <label className="field span-2">
          <span>日记内容 *</span>
          <textarea
            name="content"
            rows={5}
            maxLength={2000}
            required
            defaultValue={entry?.content ?? ""}
            placeholder="记录孩子今天的表现、进步或需要关注的地方"
          />
        </label>

        <div className="field span-2">
          <span>照片</span>
          <DiaryPhotoPicker
            existing={entry?.photos ?? []}
            maxTotal={MAX_PHOTOS}
          />
        </div>
      </div>

      <div className="form-actions">
        <Link href={returnTo} className="btn btn-secondary">
          取消
        </Link>
        <button type="submit" className="btn btn-primary">
          {mode === "create" ? "发布日记" : "保存修改"}
        </button>
      </div>
    </form>
  );
}
