"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant =
  | "primary"      // jade fill — the one action on the screen
  | "accent"       // alias of primary, kept for older call sites
  | "night"        // dark fill — secondary emphasis on light grounds
  | "outline"      // bordered, neutral
  | "jadeOutline"  // bordered jade pill — per-row "احجز"
  | "ghost"        // text only
  | "danger";      // destructive, bordered not filled

type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
  pill?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:     "btn btn-primary",
  accent:      "btn btn-accent",
  night:       "btn btn-night",
  outline:     "btn btn-outline",
  jadeOutline: "btn btn-jade-outline",
  ghost:       "btn btn-ghost",
  danger:      "btn btn-danger",
};

const sizeClasses: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    isLoading = false,
    fullWidth = false,
    pill = false,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        pill && "btn-pill",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
