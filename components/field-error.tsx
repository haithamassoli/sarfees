/** Submit/mutation-level error line. One a11y-correct alert for every form. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** Inline validation message under a form field (TanStack Form errors). */
export function FieldError({ errors }: { errors: ReadonlyArray<unknown> }) {
  if (errors.length === 0) return null;
  // Zod (Standard Schema) validators surface issue objects; function
  // validators surface plain strings. Render either.
  const first = errors[0];
  const message =
    typeof first === "object" && first !== null && "message" in first
      ? String((first as { message: unknown }).message)
      : String(first);
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
