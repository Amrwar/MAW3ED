import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "main" | "article";
  narrow?: boolean;
}

export default function Container({
  as: Tag = "div",
  narrow = false,
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <Tag
      className={cn(
        "container-app",
        narrow && "max-w-3xl",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
