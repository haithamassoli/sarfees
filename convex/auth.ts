import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { DataModel } from "./_generated/dataModel";
import { normalizeJordanPhone } from "./lib/shared";
import { isValidName } from "./lib/text";

// Phone + password. The client submits the phone number in the `email` param
// (the Password provider's account key); we normalize it to E.164 so every
// form of the same number (07…, 9627…, +9627…) maps to one account.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        const phone = normalizeJordanPhone(String(params.email ?? ""));
        if (!phone) throw new ConvexError("invalid_phone");
        const name = String(params.name ?? "").trim();
        if (params.flow === "signUp" && !isValidName(name)) {
          throw new ConvexError("invalid_name");
        }
        return {
          email: phone, // account key
          phone,
          name,
          ratingAvg: 0,
          ratingCount: 0,
        };
      },
      validatePasswordRequirements(password: string) {
        if (password.length < 8) throw new ConvexError("weak_password");
      },
    }),
  ],
});
