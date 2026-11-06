/**
 * Which English to show for a field: the owner's own, else the machine
 * translation of their Arabic (lib/translate), else none (the caller
 * then shows the Arabic). Kept apart from lib/translate so client
 * components can use it without pulling in the database or the model.
 */
export function englishOf(owner: string | null | undefined, auto: string | null | undefined): string | null {
  return owner?.trim() || auto?.trim() || null;
}
