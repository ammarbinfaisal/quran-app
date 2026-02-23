"use client";


import { loadMushafPage, preloadAdjacentPages, getCachedMushafPage } from "@/lib/mushaf/loader";
import { isQcfCode, loadQcfFont, preloadAdjacentFonts, loadUnicodeFont, isFontLoaded, getFontFamily } from "@/lib/mushaf/fonts";
import { MushafCode, MushafPagePayload } from "@/lib/types";
import { useEffect, useState } from "react";

interface UseMushafPageResult {
  pageData: MushafPagePayload | null;
  loading: boolean;
  fontReady: boolean;
  error: string | null;
}

/**
 * Hook that loads mushaf page data and the corresponding QCF font (if needed).
 * Also preloads adjacent pages' fonts.
 */
 export function useMushafPage(code: MushafCode, pageNum: number) {
   const cached = getCachedMushafPage(code, pageNum);
 
   const [pageData, setPageData] = useState<MushafPagePayload | null>(() => cached);
   const [loading, setLoading] = useState<boolean>(() => !cached);
   const [fontReady, setFontReady] = useState<boolean>(() => {
     const fam = getFontFamily(code, pageNum);
     return isFontLoaded(fam);
   });
   const [error, setError] = useState<string | null>(null);
 
   useEffect(() => {
     let cancelled = false;
 
     async function load() {
       try {
         setError(null);
 
         // ✅ sync cache check on every navigation
         const now = getCachedMushafPage(code, pageNum);
         if (now) {
           setPageData(now);
           setLoading(false);
         } else {
           setPageData(null);
           setLoading(true);
         }
 
         // sync font status
         const fam = getFontFamily(code, pageNum);
         setFontReady(isFontLoaded(fam));
 
         // ensure data (deduped, may be instant)
         const data = await loadMushafPage(code, pageNum);
         if (!cancelled) {
           setPageData(data);
           setLoading(false);
         }
 
         // font load (async)
         const fp = isQcfCode(code) ? loadQcfFont(code, pageNum) : loadUnicodeFont(code);
         fp.then(() => {
           if (!cancelled) setFontReady(true);
         }).catch((err) => console.error("Font loading failed", err));
       } catch (err) {
         if (!cancelled) {
           setError(err instanceof Error ? err.message : "Failed to load page");
           setLoading(false);
         }
       }
     }
 
     load();
     preloadAdjacentPages(code, pageNum, 6);
     if (isQcfCode(code)) preloadAdjacentFonts(code, pageNum);
 
     return () => {
       cancelled = true;
     };
   }, [code, pageNum]);
 
   return { pageData, loading, fontReady, error };
 }
