// Primitives — the vocabulary every screen is built from.
// Import from here rather than reaching for a file directly.

// Foundations
export { default as Container } from "./Container";
export { default as Num } from "./Num";

// Form controls
export { default as Button } from "./Button";
export { default as Input } from "./Input";
export { default as Select } from "./Select";
export { default as Textarea } from "./Textarea";
export { default as TimeSlot } from "./TimeSlot";

// Surfaces
export { default as Card } from "./Card";
export { default as Modal } from "./Modal";
export { default as Dropdown, DropdownItem, DropdownDivider } from "./Dropdown";

// Navigation
export { default as Tabs } from "./Tabs";
export type { TabItem } from "./Tabs";
export { default as Pagination } from "./Pagination";

// Data display
export { Table, THead, TBody, TR, TH, TD } from "./Table";
export { default as Badge } from "./Badge";
export { default as Chip } from "./Chip";
export { default as StatusBadge, statusStripe } from "./StatusBadge";
export type { BookingStatusKey } from "./StatusBadge";
export { default as Avatar } from "./Avatar";
export { default as SectionHeading } from "./SectionHeading";

// Feedback
export { default as Alert } from "./Alert";
export { ToastProvider, useToast } from "./Toast";
export type { ToastTone, ToastInput } from "./Toast";
export { default as Skeleton } from "./Skeleton";
export { default as EmptyState } from "./EmptyState";
