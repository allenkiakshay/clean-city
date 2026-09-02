import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Chrome for every public page.
 *
 * `(site)` is a route group — the parentheses keep it out of the URL, so these
 * pages still live at `/`, `/map`, `/login` and so on. Putting the header and
 * footer here rather than in each page is what stops them drifting apart: the
 * previous per-page approach had already left `/login`, `/register` and `/me`
 * with no navigation at all.
 *
 * Admin and crew keep their own layouts, because their headers are different.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
