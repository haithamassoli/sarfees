/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as dev from "../dev.js";
import type * as http from "../http.js";
import type * as lib_deepLink from "../lib/deepLink.js";
import type * as lib_privacy from "../lib/privacy.js";
import type * as lib_shared from "../lib/shared.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_validators from "../lib/validators.js";
import type * as matching from "../matching.js";
import type * as notifications from "../notifications.js";
import type * as push from "../push.js";
import type * as pushActions from "../pushActions.js";
import type * as ratings from "../ratings.js";
import type * as requests from "../requests.js";
import type * as trips from "../trips.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bookings: typeof bookings;
  dev: typeof dev;
  http: typeof http;
  "lib/deepLink": typeof lib_deepLink;
  "lib/privacy": typeof lib_privacy;
  "lib/shared": typeof lib_shared;
  "lib/text": typeof lib_text;
  "lib/validators": typeof lib_validators;
  matching: typeof matching;
  notifications: typeof notifications;
  push: typeof push;
  pushActions: typeof pushActions;
  ratings: typeof ratings;
  requests: typeof requests;
  trips: typeof trips;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
