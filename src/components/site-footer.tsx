import Link from "next/link";

const LINKS = [
  { href: "/report", label: "Report waste" },
  { href: "/map", label: "Live map" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground">
        <span>CleanCity — municipal waste reporting</span>
        <nav className="flex flex-wrap gap-4">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
