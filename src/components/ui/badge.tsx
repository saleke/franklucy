import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "outline";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  children,
  ...props
}) => {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium gap-1";

  const variants = {
    default: "bg-surface-elevated text-text-secondary border border-border",
    success:
      "bg-status-success-subtle text-status-success border border-status-success/30",
    warning:
      "bg-status-warning-subtle text-status-warning border border-status-warning/30",
    danger:
      "bg-status-danger-subtle text-status-danger border border-status-danger/30",
    info: "bg-status-info-subtle text-status-info border border-status-info/30",
    outline: "text-text-secondary border border-border",
  };

  return (
    <span
      className={twMerge(clsx(base, variants[variant], className))}
      {...props}
    >
      {children}
    </span>
  );
};
