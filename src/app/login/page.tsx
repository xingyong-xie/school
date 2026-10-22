import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Alert } from "@/components/Alert";
import { loginAction } from "@/actions/auth";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const error = getParam(searchParams, "error");

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-brand">
          <div className="brand-mark large">
            <Image src="/logo-mark.jpg" alt="奇奥德幼儿园" width={54} height={54} priority />
          </div>
          <div>
            <div className="login-brand-name">奇奥德幼儿园</div>
            <div className="login-brand-sub">Kindergarten Administration</div>
          </div>
        </div>
        <h1 className="login-title">
          让园务管理
          <br />
          更简单、更安心
        </h1>
        <p className="login-copy">
          一套系统统一管理幼儿档案、班级教师、日常考勤、请假审批、课程安排与收费记录，
          让老师把更多时间留给孩子。
        </p>
        <div className="login-features">
          <div className="login-feature">
            <span className="feature-icon">☺</span>
            <div>
              <strong>幼儿与班级档案</strong>
              <p>学籍、家长、班级信息一处维护</p>
            </div>
          </div>
          <div className="login-feature">
            <span className="feature-icon">✓</span>
            <div>
              <strong>考勤与请假闭环</strong>
              <p>教师登记、家长申请、园方审批</p>
            </div>
          </div>
          <div className="login-feature">
            <span className="feature-icon">¥</span>
            <div>
              <strong>收费清晰可追溯</strong>
              <p>收费项目、缴费记录、欠费一目了然</p>
            </div>
          </div>
        </div>
        <div className="login-decor decor-one" />
        <div className="login-decor decor-two" />
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>欢迎回来</h2>
          <p className="login-sub">请使用园所分配的账号登录</p>

          <Alert error={error} />

          <form action={loginAction} className="login-form">
            <label className="field">
              <span>登录账号</span>
              <input
                name="username"
                type="text"
                placeholder="请输入账号"
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              <span>登录密码</span>
              <input
                name="password"
                type="password"
                placeholder="请输入密码"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" className="btn btn-primary btn-block">
              登录系统
            </button>
          </form>

          <div className="demo-accounts">
            <div className="demo-title">演示账号</div>
            <div className="demo-row">
              <span>管理员</span>
              <code>admin / admin123</code>
            </div>
            <div className="demo-row">
              <span>教师</span>
              <code>t001 / teacher123</code>
            </div>
            <div className="demo-row">
              <span>家长</span>
              <code>p001 / parent123</code>
            </div>
          </div>
        </div>
        <p className="login-foot">© 2026 奇奥德幼儿园 · 教务管理系统</p>
      </section>
    </div>
  );
}
