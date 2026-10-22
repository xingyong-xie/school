import type { ReactNode } from "react";

export function Badge({
  tone = "gray",
  children,
}: {
  tone?: string;
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
