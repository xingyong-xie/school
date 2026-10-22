import Link from "next/link";
import { createClass, updateClass } from "@/actions/classes";

type ClassValues = {
  id?: number;
  name: string;
  ageGroup: string;
  capacity: number;
  room: string | null;
  teacherId: number | null;
};

export function ClassForm({
  mode,
  schoolClass,
  teachers,
}: {
  mode: "create" | "edit";
  schoolClass?: ClassValues;
  teachers: { id: number; name: string; employeeNo: string }[];
}) {
  const action = mode === "create" ? createClass : updateClass;

  return (
    <form action={action} className="card form-card">
      {mode === "edit" && schoolClass?.id ? (
        <input type="hidden" name="id" value={schoolClass.id} />
      ) : null}

      <div className="form-section">
        <div className="form-section-head">
          <h2>班级信息</h2>
          <p>班级名称需唯一，主班教师可在教师管理中维护。</p>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>班级名称 *</span>
            <input
              name="name"
              defaultValue={schoolClass?.name ?? ""}
              placeholder="如：小班·向日葵班"
              required
            />
          </label>
          <label className="field">
            <span>年龄段 *</span>
            <input
              name="ageGroup"
              defaultValue={schoolClass?.ageGroup ?? ""}
              placeholder="如：小班（3-4岁）"
              required
            />
          </label>
          <label className="field">
            <span>班级容量 *</span>
            <input
              type="number"
              name="capacity"
              min={1}
              max={60}
              defaultValue={schoolClass?.capacity ?? 25}
              required
            />
          </label>
          <label className="field">
            <span>教室</span>
            <input
              name="room"
              defaultValue={schoolClass?.room ?? ""}
              placeholder="如：A101"
            />
          </label>
          <label className="field span-2">
            <span>主班教师</span>
            <select name="teacherId" defaultValue={schoolClass?.teacherId ?? ""}>
              <option value="">暂不分配</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}（{teacher.employeeNo}）
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="form-actions">
        <Link href="/classes" className="btn btn-secondary">
          取消
        </Link>
        <button type="submit" className="btn btn-primary">
          {mode === "create" ? "创建班级" : "保存修改"}
        </button>
      </div>
    </form>
  );
}
