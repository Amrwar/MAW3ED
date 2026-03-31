import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: "start" | "end";
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, iconPosition = "start", id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && iconPosition === "start" && (
            <span className="absolute inset-y-0 end-3 flex items-center text-[var(--color-text-muted)] pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              "input",
              icon && iconPosition === "start" && "pe-10",
              icon && iconPosition === "end" && "ps-10",
              error && "border-red-400 focus:border-red-500",
              className
            )}
            {...props}
          />
          {icon && iconPosition === "end" && (
            <span className="absolute inset-y-0 start-3 flex items-center text-[var(--color-text-muted)] pointer-events-none">
              {icon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
