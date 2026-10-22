import { requireUser } from "@/lib/guards";
import { logoutAction } from "@/actions/auth";
import { Sidebar } from "@/components/Sidebar";
import { todayString } from "@/lib/format";
import { WEEKDAYS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const today = new Date();
  const weekday = WEEKDAYS.find((item) => item.value === today.getDay())?.label;

  return (
    <div className="app-shell">
      <Sidebar
        user={{ name: user.name, role: user.role }}
        logoutAction={logoutAction}
      />
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-context">
            <span className="topbar-dot" />
            2026 秋季学期 · 园务管理
          </div>
          <div className="topbar-right">
            <span className="semester-pill">正常运营</span>
            <span className="topbar-date">
              {todayString(today)}
              {weekday ? ` ${weekday}` : ""}
            </span>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
