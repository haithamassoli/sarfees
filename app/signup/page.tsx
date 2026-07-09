"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useForm } from "@tanstack/react-form";
import { FormError } from "@/components/field-error";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeJordanPhone } from "@/convex/lib/shared";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { nameSchema, passwordSchema, phoneSchema } from "@/lib/validators";

export default function SignupPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: "", phone: "", password: "" },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const phone = normalizeJordanPhone(value.phone);
      if (phone === null) {
        setSubmitError(t("error_invalid_phone"));
        return;
      }
      try {
        await signIn("password", {
          email: phone,
          password: value.password,
          name: value.name.trim(),
          flow: "signUp",
        });
        router.push("/");
      } catch (error) {
        // Our ConvexErrors carry the ar.json key; a plain error on signup
        // means the account already exists.
        setSubmitError(errorMessage(error, "error_account_exists"));
      }
    },
  });

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {/* Real heading for screen-reader navigation; preflight makes the
                h1 inherit the CardTitle look. */}
            <h1>{t("signup")}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field name="name" validators={{ onSubmit: nameSchema }}>
              {(field) => (
                <TextField
                  field={field}
                  label={t("name")}
                  autoComplete="name"
                  maxLength={60}
                  placeholder={t("name_placeholder")}
                />
              )}
            </form.Field>

            <form.Field name="phone" validators={{ onSubmit: phoneSchema }}>
              {(field) => (
                <TextField
                  field={field}
                  label={t("phone")}
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t("phone_placeholder")}
                />
              )}
            </form.Field>

            <form.Field
              name="password"
              validators={{ onSubmit: passwordSchema }}
            >
              {(field) => (
                <TextField
                  field={field}
                  label={t("password")}
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                />
              )}
            </form.Field>

            <FormError message={submitError} />

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {t("signup")}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link
              href="/login"
              className="inline-block py-2.5 text-primary underline-offset-4 hover:underline"
            >
              {t("have_account")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
