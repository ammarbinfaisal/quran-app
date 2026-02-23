import Link from "next/link";
import { AlertCircle } from "lucide-react";

export function InvalidPathMessage({ message }: { message: string }) {
    return (
        <main className="flex h-[100dvh] w-full flex-col items-center justify-center bg-[var(--color-bg)] p-6 text-center text-[var(--color-text)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mb-6 text-[var(--color-accent)]">
                <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold mb-3 tracking-tight">Invalid Route</h2>
            <p className="text-[var(--color-muted)] mb-8 max-w-sm">
                {message}
            </p>
            <Link
                href="/"
                className="rounded-xl bg-[var(--color-surface)] ring-1 ring-[var(--color-muted)]/20 px-6 py-3 text-sm font-semibold active:scale-[0.97] transition"
                replace
            >
                Return Home
            </Link>
        </main>
    );
}
