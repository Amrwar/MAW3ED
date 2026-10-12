import { cn } from "@/lib/utils";
import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

/**
 * Table shell. Wide tables scroll inside their own box rather than
 * pushing the page sideways, which is what breaks a layout on a phone.
 *
 * Cells align to the inline start, so the same markup reads correctly
 * in Arabic and English.
 */
export function Table({
  children,
  minWidth = "40rem",
  className,
  label,
}: {
  children: ReactNode;
  minWidth?: string;
  className?: string;
  /** Names the scroll region for screen readers. */
  label?: string;
}) {
  // `relative` matters as much as `overflow-x-auto`. An absolutely
  // positioned descendant — the sr-only label on an actions column — is
  // laid out against the nearest positioned ancestor, and clipped only
  // by scroll boxes inside that ancestor. Without it the label escaped
  // this box and widened the page itself: /dashboard/branches was 549px
  // wide on a 375px phone in Arabic, where that overflow is scrollable.
  //
  // tabIndex: on a phone the table is wider than its box, and a box that
  // scrolls must be reachable by keyboard or its hidden columns are
  // unreachable without a pointer (WCAG 2.1.1; axe: scrollable-region-
  // focusable, found on /pricing at 375px).
  return (
    <div
      tabIndex={0}
      role={label ? "region" : undefined}
      aria-label={label}
      className={cn(
        "relative w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-jade)]",
        className,
      )}
    >
      <table className="w-full border-collapse" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-[var(--color-line)] bg-[var(--color-ground)]">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  selected = false,
  onClick,
  className,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      aria-selected={onClick ? selected : undefined}
      className={cn(
        "border-b border-[var(--color-line)] transition-colors last:border-b-0",
        selected ? "bg-[var(--color-jade-tint)]" : "hover:bg-[var(--color-surface-2)]",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-5 py-3 text-start text-[0.71875rem] font-bold text-[var(--color-subtle)]",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <td className={cn("px-5 py-3.5 text-start align-middle", className)} {...rest}>
      {children}
    </td>
  );
}
