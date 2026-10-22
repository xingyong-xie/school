import Link from "next/link";
import type { Gender, StudentStatus } from "@prisma/client";
import { createStudent, updateStudent } from "@/actions/students";

type StudentFormValues = {
  id?: number;
  studentNo: string;
  name: string;
  gender: Gender;
  birthDate: string;
  status: StudentStatus;
  classId: number | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  parentId: number | null;
};

type Option = { id: number; name: string };

export function StudentForm({
  mode,
  student,
  classes,
  parents,
}: {
  mode: "create" | "edit";
  student?: StudentFormValues;
  classes: Option[];
  parents: (Option & { phone: string | null; username: string })[];
}) {
  const action = mode === "create" ? createStudent : updateStudent;

  return (
    <form action={action} className="card form-card">
      {mode === "edit" && student?.id ? (
        <input type="hidden" name="id" value={student.id} />
      ) : null}

      <div className="form-section">
        <div className="form-section-head">
          <h2>幼儿基本信息</h2>
          <p>带 * 的字段为必填项。</p>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>学号 *</span>
            <input
              name="studentNo"
              defaultValue={student?.studentNo ?? ""}
              placeholder="如 2026013"
              required
            />
          </label>
          <label className="field">
            <span>姓名 *</span>
            <input
              name="name"
              defaultValue={student?.name ?? ""}
              placeholder="幼儿姓名"
              required
            />
          </label>
          <label className="field">
            <span>性别 *</span>
            <select name="gender" defaultValue={student?.gender ?? "FEMALE"} required>
              <option value="FEMALE">女</option>
              <option value="MALE">男</option>
            </select>
          </label>
          <label className="field">
            <span>出生日期 *</span>
            <input
              type="date"
              name="birthDate"
              defaultValue={student?.birthDate ?? ""}
              required
            />
          </label>
          <label className="field">
            <span>所在班级</span>
            <select name="classId" defaultValue={student?.classId ?? ""}>
              <option value="">暂不分班</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>在园状态</span>
            <select name="status" defaultValue={student?.status ?? "ACTIVE"}>
              <option value="ACTIVE">在园</option>
              <option value="GRADUATED">已毕业</option>
              <option value="LEFT">已离园</option>
            </select>
          </label>
          <label className="field">
            <span>联系电话</span>
            <input
              name="phone"
              defaultValue={student?.phone ?? ""}
              placeholder="可选，一般为家长手机号"
            />
          </label>
          <label className="field">
            <span>家庭住址</span>
            <input
              name="address"
              defaultValue={student?.address ?? ""}
              placeholder="可选"
            />
          </label>
          <label className="field span-2">
            <span>备注</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={student?.notes ?? ""}
              placeholder="过敏史、饮食禁忌、接送安排等"
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-head">
          <h2>家长账号</h2>
          <p>
            选择已有家长账号；若家长首次入园，可直接填写手机号与姓名新建账号，
            初始密码为 <code>123456</code>。
          </p>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>关联已有家长</span>
            <select name="parentId" defaultValue={student?.parentId ?? ""}>
              <option value="">不关联 / 新建家长</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}（{parent.phone ?? parent.username}）
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="field-spacer" />
            <div className="hint-box">
              若同时填写下方新家长信息，将优先创建并绑定新账号。
            </div>
          </div>
          <label className="field">
            <span>新家长手机号</span>
            <input name="newParentPhone" placeholder="将作为家长登录账号" />
          </label>
          <label className="field">
            <span>新家长姓名</span>
            <input name="newParentName" placeholder="家长姓名" />
          </label>
        </div>
      </div>

      <div className="form-actions">
        <Link href={mode === "create" ? "/students" : `/students/${student?.id}`} className="btn btn-secondary">
          取消
        </Link>
        <button type="submit" className="btn btn-primary">
          {mode === "create" ? "保存幼儿档案" : "保存修改"}
        </button>
      </div>
    </form>
  );
}
