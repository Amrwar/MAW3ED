import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  /** Phone numbers, emails and codes read left-to-right inside RTL copy. */
  ltr?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, icon, ltr = false, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
      )}

      <div className="relative">
        {icon && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 start-4 flex items-center text-[var(--color-subtle)] pointer-events-none"
          >
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "input",
            icon && "ps-11",
            ltr && "text-start",
            error && "input-error",
            className,
          )}
          style={ltr ? { direction: "ltr" } : undefined}
          {...props}
        />
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
