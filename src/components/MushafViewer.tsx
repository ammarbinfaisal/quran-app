"use client";

import type { MushafCode, TranslationCode } from "@/lib/preferences";
import { MushafEngine } from "@/mushaf-engine/components/MushafEngine";

interface MushafViewerProps {
  startPage: number;
  endPage?: number;
  initialAyah?: string;
  routeMushafCode: MushafCode;
  routeTranslationCode: TranslationCode;
}

export function MushafViewer(props: MushafViewerProps) {
  return <MushafEngine {...props} />;
}
