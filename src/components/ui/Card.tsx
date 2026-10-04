import { cn } from "@/lib/utils";
import { type ElementType, type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  /** Lifts the card off the page — for the one panel that leads. */
  elevated?: boolean;
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-7",
};

export default function Card({
  as: Tag = "div",
  hover = false,
  padding = "md",
  elevated = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        "card",
        hover && "card-hover",
        elevated && "shadow-[var(--shadow-float)]",
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
