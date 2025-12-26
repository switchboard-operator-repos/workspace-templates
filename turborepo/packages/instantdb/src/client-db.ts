import { init } from "@instantdb/react";
import schema from "./instant.schema";

export const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  schema,
});

// Re-export client-side id helper for convenience
export { id } from "@instantdb/react";
