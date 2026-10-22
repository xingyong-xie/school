"use client";

import type { ReactNode } from "react";

export function ConfirmButton({
  children,
  message = "确定要执行此操作吗？",
  className = "btn btn-danger-ghost btn-sm",
}: {
  children: ReactNode;
  message?: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
