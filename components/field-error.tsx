/** Inline validation message under a form field (TanStack Form errors). */
export function FieldError({ errors }: { errors: ReadonlyArray<unknown> }) {
  if (errors.length === 0) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {String(errors[0])}
    </p>
  );
}
