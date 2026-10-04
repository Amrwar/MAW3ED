import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

type BadgeVariant =
  | "default"
  | "brand"
  | "accent"
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "badge badge-default",
  brand:   "badge badge-brand",
  accent:  "badge badge-accent",
  success: "badge badge-success",
  warning: "badge badge-warning",
  info:    "badge badge-info",
  danger:  "badge badge-danger",
  outline: "badge badge-outline",
};

export default function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(variantClasses[variant], className)} {...props}>
      {children}
    </span>
  );
}
