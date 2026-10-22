import Link from "next/link";
import { createTeacher, updateTeacher } from "@/actions/teachers";

type TeacherValues = {
  id?: number;
  name: string;
  employeeNo: string;
  specialty: string | null;
  phone: string | null;
  username: string;
};

export function TeacherForm({
  mode,
  teacher,
}: {
  mode: "create" | "edit";
  teacher?: TeacherValues;
}) {
  const action = mode === "create" ? createTeacher : updateTeacher;

  return (
    <form action={action} className="card form-card">
      {mode === "edit" && teacher?.id ? (
        <input type="hidden" name="id" value={teacher.id} />
      ) : null}

      <div className="form-section">
        <div className="form-section-head">
          <h2>教师信息</h2>
          <p>
            教师账号用于登录系统；创建后可登录登记本班考勤、审批请假。
          </p>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>教师姓名 *</span>
            <input name="name" defaultValue={teacher?.name ?? ""} required />
          </label>
          <label className="field">
            <span>工号 *</span>
            <input
              name="employeeNo"
              defaultValue={teacher?.employeeNo ?? ""}
              placeholder="如 T004"
              required
            />
          </label>
          <label className="field">
            <span>手机号</span>
            <input name="phone" defaultValue={teacher?.phone ?? ""} />
          </label>
          <label className="field">
            <span>专业特长</span>
            <input
              name="specialty"
              defaultValue={teacher?.specialty ?? ""}
              placeholder="如 学前教育、音乐律动"
            />
          </label>
          {mode === "create" ? (
            <label className="field">
              <span>登录账号 *</span>
              <input name="username" placeholder="留空则使用手机号/工号" />
            </label>
          ) : (
            <div className="field">
              <span>登录账号</span>
              <input value={teacher?.username ?? ""} disabled />
            </div>
          )}
          <label className="field">
            <span>{mode === "create" ? "初始密码" : "重置密码"}</span>
            <input
              name="password"
              type="password"
              placeholder={mode === "create" ? "留空默认为 123456" : "留空则不修改密码"}
              autoComplete="new-password"
            />
          </label>
        </div>
      </div>

      <div className="form-actions">
        <Link href="/teachers" className="btn btn-secondary">
          取消
        </Link>
        <button type="submit" className="btn btn-primary">
          {mode === "create" ? "创建教师账号" : "保存修改"}
        </button>
      </div>
    </form>
  );
}
