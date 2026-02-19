"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TOTAL_PAGES } from "@/lib/constants";
import { getPreferences } from "@/lib/preferences";

export default function PageRedirect({
  params,
}: {
  params: { page: string };
}) {
  const router = useRouter();

  useEffect(() => {
    const raw = parseInt(params.page, 10);
    const page = Number.isFinite(raw) ? raw : 1;
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, page));
    const { mushafCode } = getPreferences();
    router.replace(`/${clamped}/${mushafCode}`);
  }, [params.page, router]);

  return null;
}
