import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "奇奥德幼儿园 · 教务管理",
  description: "面向幼儿园的通用教务管理系统：幼儿档案、考勤、请假、课程表与收费管理。",
  icons: {
    icon: "/logo-mark.jpg",
    apple: "/logo-mark.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
