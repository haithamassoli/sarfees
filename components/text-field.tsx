import type { AnyFieldApi } from "@tanstack/react-form";
import { FieldError } from "@/components/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The app's labeled text input: Label + Input + inline FieldError, all wired to
 * a TanStack field. Pass the field render-prop plus a label; any extra props
 * (type, dir, autoComplete, placeholder…) pass straight through to the Input.
 * The controlled bindings come last so a stray prop can't unwire the field.
 */
export function TextField({
  field,
  label,
  ...input
}: { field: AnyFieldApi; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        {...input}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={field.state.meta.errors.length > 0 || undefined}
      />
      <FieldError errors={field.state.meta.errors} />
    </div>
  );
}
