import Link from "next/link";
import { api } from "@/lib/api";

export function Nav() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
          >
            Velyo
          </span>
          <span className="hidden text-xs text-muted sm:inline">Belgeler, akışında.</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/" className="hover:text-foreground">
            Belgeler
          </Link>
          <Link href="/events" className="hover:text-foreground">
            Etkinlik Günlüğü
          </Link>
          <a href={api.exportAllUrl()} className="hover:text-foreground">
            Tümünü Dışa Aktar
          </a>
        </nav>
      </div>
    </header>
  );
}
