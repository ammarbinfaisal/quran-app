"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";

interface DocsNavItem {
  id: string;
  title: string;
}

interface DocsNavSection extends DocsNavItem {
  items?: readonly DocsNavItem[];
}

function DocsNavigationLinks({
  sections,
  onNavigate,
}: {
  sections: readonly DocsNavSection[];
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Docs sections" className="space-y-5">
      {sections.map((section) => (
        <div key={section.id}>
          <a
            href={`#${section.id}`}
            onClick={onNavigate}
            className="block rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-bg)]"
          >
            {section.title}
          </a>
          {section.items?.length ? (
            <div className="mt-1 space-y-1 pl-3">
              {section.items.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={onNavigate}
                  className="block rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                >
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

export function DocsSidebarNavigation({ sections }: { sections: readonly DocsNavSection[] }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-6 rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-4 shadow-sm">
        <p className="px-3 text-xs font-semibold uppercase text-[var(--color-muted)]">
          On This Page
        </p>
        <div className="mt-3">
          <DocsNavigationLinks sections={sections} />
        </div>
      </div>
    </aside>
  );
}

export function DocsMobileNavigation({ sections }: { sections: readonly DocsNavSection[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open docs navigation"
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text)] transition active:scale-[0.98] active:opacity-80 lg:hidden"
        >
          <Menu className="h-4 w-4" />
          Sections
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-[70] max-h-[78dvh] rounded-t-3xl border border-[var(--color-muted)]/20 bg-[var(--color-surface)] p-5 shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
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
            <DocsNavigationLinks sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
