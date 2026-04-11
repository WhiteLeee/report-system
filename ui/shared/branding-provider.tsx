"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

interface BrandingValue {
  enterpriseName: string;
  logoUrl: string;
}

const BrandingContext = createContext<BrandingValue>({
  enterpriseName: "Report Workspace",
  logoUrl: ""
});

export function BrandingProvider({
  children,
  value
}: {
  children: ReactNode;
  value: BrandingValue;
}) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingValue {
  return useContext(BrandingContext);
}
