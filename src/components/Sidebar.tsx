"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/constants";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "工作台", icon: "⌂", roles: ["ADMIN", "TEACHER", "PARENT"] },
  { href: "/students", label: "幼儿档案", icon: "☺", roles: ["ADMIN", "TEACHER", "PARENT"] },
  { href: "/classes", label: "班级管理", icon: "▤", roles: ["ADMIN", "TEACHER"] },
  { href: "/teachers", label: "教师管理", icon: "✎", roles: ["ADMIN"] },
  { href: "/attendance", label: "考勤管理", icon: "✓", roles: ["ADMIN", "TEACHER", "PARENT"] },
  { href: "/leaves", label: "请假管理", icon: "◷", roles: ["ADMIN", "TEACHER", "PARENT"] },
  { href: "/schedule", label: "班级课程表", icon: "▦", roles: ["ADMIN", "TEACHER", "PARENT"] },
  { href: "/diaries", label: "成长日记", icon: "✿", roles: ["ADMIN", "TEACHER", "PARENT"] },
  { href: "/fees", label: "收费管理", icon: "¥", roles: ["ADMIN", "TEACHER", "PARENT"] },
];

export function Sidebar({
  user,
  logoutAction,
}: {
  user: { name: string; role: Role };
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Image src="/logo-mark.jpg" alt="" width={42} height={42} />
        </div>
        <div>
          <div className="brand-name">奇奥德幼儿园</div>
          <div className="brand-sub">教务管理系统</div>
        </div>
      </div>

      <div className="sidebar-section">功能导航</div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.filter((item) => item.roles.includes(user.role)).map((item) => {
          const label =
            item.href === "/students" && user.role === "PARENT"
              ? "我的孩子"
              : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive(item.href) ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="avatar">{user.name.slice(0, 1)}</div>
          <div className="user-meta">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{ROLE_LABELS[user.role]}</div>
          </div>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="logout-btn">
            退出登录
          </button>
        </form>
      </div>
    </aside>
  );
}
