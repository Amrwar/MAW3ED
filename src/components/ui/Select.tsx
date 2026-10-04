import { cn } from "@/lib/utils";
import { type SelectHTMLAttributes, forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, error, hint, id, children, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const describedBy = error
    ? `${selectId}-error`
    : hint
      ? `${selectId}-hint`
      : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="field-label">
          {label}
        </label>
      )}

      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn("select appearance-none pe-11", error && "input-error", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="absolute inset-y-0 end-4 my-auto h-4 w-4 text-[var(--color-subtle)] pointer-events-none"
        />
      </div>

      {error ? (
        <p id={`${selectId}-error`} className="field-error">{error}</p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
});

export default Select;
