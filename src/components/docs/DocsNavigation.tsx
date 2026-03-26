"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { cn } from "@/lib/utils";

interface DocsNavItem {
  id: string;
  title: string;
}

interface DocsNavSection extends DocsNavItem {
  items?: readonly DocsNavItem[];
}

function flattenSections(sections: readonly DocsNavSection[]): DocsNavItem[] {
  return sections.flatMap((section) => [section, ...(section.items ?? [])]);
}

function useActiveDocsSection(sections: readonly DocsNavSection[], scrollRootId?: string) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useMountEffect(() => {
    const sectionIds = flattenSections(sections).map((section) => section.id);
    if (sectionIds.length === 0) return;

    const scrollRoot = scrollRootId ? document.getElementById(scrollRootId) : null;
    const scrollTarget: Window | HTMLElement = scrollRoot ?? window;
    let rafId = 0;

    const updateActiveSection = () => {
      const rootTop = scrollRoot?.getBoundingClientRect().top ?? 0;
      const rootHeight = scrollRoot?.clientHeight ?? window.innerHeight;
      const threshold = Math.min(rootHeight * 0.28, 180);
      let nextActiveId = sectionIds[0];

      for (const sectionId of sectionIds) {
        const sectionNode = document.getElementById(sectionId);
        if (!sectionNode) continue;

        const sectionTop = sectionNode.getBoundingClientRect().top - rootTop;
        if (sectionTop <= threshold) {
          nextActiveId = sectionId;
          continue;
        }

        break;
      }

      setActiveId((currentId) => (currentId === nextActiveId ? currentId : nextActiveId));
    };

    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateActiveSection();
      });
    };

    updateActiveSection();
    scrollTarget.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      scrollTarget.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  });

  return { activeId, setActiveId };
}

function DocsNavigationLinks({
  sections,
  activeId,
  onNavigate,
  onSelect,
}: {
  sections: readonly DocsNavSection[];
  activeId: string;
  onNavigate?: () => void;
  onSelect?: (id: string) => void;
}) {
  return (
    <nav aria-label="Docs sections" className="space-y-3.5">
      {sections.map((section) => (
        <div key={section.id}>
          <a
            href={`#${section.id}`}
            onClick={() => {
              onSelect?.(section.id);
              onNavigate?.();
            }}
            aria-current={activeId === section.id ? "location" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-sm font-semibold transition duration-150 ease-out",
              activeId === section.id
                ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                : "text-[var(--color-text)] hover:bg-[var(--color-bg)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full bg-[var(--color-accent)] transition-transform duration-150 ease-out",
                activeId === section.id ? "scale-100" : "scale-0",
              )}
            />
            {section.title}
          </a>
          {section.items?.length ? (
            <div className="mt-0.5 space-y-0.5 pl-2">
              {section.items.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => {
                    onSelect?.(item.id);
                    onNavigate?.();
                  }}
                  aria-current={activeId === item.id ? "location" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-2xl px-2.5 py-1.5 text-sm transition duration-150 ease-out",
                    activeId === item.id
                      ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 rounded-full bg-[var(--color-accent)]/80 transition-opacity duration-150 ease-out",
                      activeId === item.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {item.title}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebarNavigation({
  sections,
  scrollRootId,
}: {
  sections: readonly DocsNavSection[];
  scrollRootId?: string;
}) {
  const { activeId, setActiveId } = useActiveDocsSection(sections, scrollRootId);

  return (
    <aside className="hidden lg:block lg:self-start">
      <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto">
        <div className="rounded-[1.75rem] border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-3.5 shadow-sm">
          <p className="px-2.5 text-xs font-semibold uppercase text-[var(--color-muted)]">
            On this page
          </p>
          <div className="mt-3">
            <DocsNavigationLinks
              sections={sections}
              activeId={activeId}
              onSelect={setActiveId}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

export function DocsMobileNavigation({
  sections,
  scrollRootId,
}: {
  sections: readonly DocsNavSection[];
  scrollRootId?: string;
}) {
  const [open, setOpen] = useState(false);
  const { activeId, setActiveId } = useActiveDocsSection(sections, scrollRootId);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open docs navigation"
          className="fixed z-40 inline-flex size-14 items-center justify-center rounded-full border border-[var(--color-muted)]/20 bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm transition active:scale-[0.98] active:opacity-80 lg:hidden"
          style={{
            right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
          }}
        >
          <Menu className="h-5 w-5" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] rounded-t-3xl border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-4 pt-4 shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--color-muted)]/20" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-semibold text-[var(--color-text)]">
              Sections
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close docs navigation"
                className="flex size-11 items-center justify-center rounded-full border border-[var(--color-muted)]/15 bg-[var(--color-bg)] text-[var(--color-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto">
            <DocsNavigationLinks
              sections={sections}
              activeId={activeId}
              onSelect={setActiveId}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
