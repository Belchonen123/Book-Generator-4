"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";

export function EnsureProfile() {
  const ensure = useMutation(api.profiles.ensureProfile);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    ensure({}).catch(() => {
      ran.current = false;
    });
  }, [ensure]);
  return null;
}
