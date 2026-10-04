import { cn } from "@/lib/utils";
import { type TextareaHTMLAttributes, forwardRef, useId } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, error, hint, id, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const taId = id ?? autoId;
  const describedBy = error ? `${taId}-error` : hint ? `${taId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={taId} className="field-label">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={taId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("textarea", error && "textarea-error", className)}
        {...props}
      />
      {error ? (
        <p id={`${taId}-error`} className="field-error">{error}</p>
      ) : hint ? (
        <p id={`${taId}-hint`} className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
});

export default Textarea;
