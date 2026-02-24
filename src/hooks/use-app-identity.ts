"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getOrCreateGuestId } from "@/lib/guest-identity";

export function useAppIdentity() {
  const { isSignedIn, userId, orgId } = useAuth();
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      setGuestId(null);
      return;
    }

    setGuestId(getOrCreateGuestId());
  }, [isSignedIn]);

  return useMemo(
    () => ({
      mode: isSignedIn ? ("user" as const) : ("guest" as const),
      userId: isSignedIn ? userId ?? null : null,
      organizationId: isSignedIn ? orgId ?? null : null,
      guestId: isSignedIn ? null : guestId,
      ready: isSignedIn || !!guestId,
    }),
    [guestId, isSignedIn, orgId, userId]
  );
}
