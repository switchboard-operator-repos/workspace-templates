"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { db } from "./client-db";

export function SignedIn({ children }: { children: React.ReactNode }) {
  return <db.SignedIn>{children}</db.SignedIn>;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  return <db.SignedOut>{children}</db.SignedOut>;
}

export function Redirect({ to }: { to: Route }) {
  const router = useRouter();

  useEffect(() => {
    router.push(to);
  }, [router, to]);

  return null;
}

export function RedirectSignedOut({ to }: { to: Route }) {
  return (
    <SignedOut>
      <Redirect to={to} />
    </SignedOut>
  );
}

export function RedirectSignedIn({ to }: { to: Route }) {
  return (
    <SignedIn>
      <Redirect to={to} />
    </SignedIn>
  );
}

export const { sendMagicCode, signInWithMagicCode } = db.auth;
