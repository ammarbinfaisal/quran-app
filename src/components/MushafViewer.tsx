"use client";

import type { MushafCode, TranslationCode } from "@/lib/preferences";
import type { MushafPagePayload } from "@/lib/mushaf/proto";
import { MushafEngine } from "@/mushaf-engine/components/MushafEngine";

interface MushafViewerProps {
  startPage: number;
  endPage?: number;
  initialAyah?: string;
  routeMushafCode: MushafCode;
  routeTranslationCode: TranslationCode;
  initialData?: MushafPagePayload | null;
  initialFontStyles?: string;
}

export function MushafViewer(props: MushafViewerProps) {
  return <MushafEngine {...props} />;
}
