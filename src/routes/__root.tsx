import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bay Live — Theo dõi chuyến bay các sân bay Việt Nam" },
      { name: "description", content: "Bảng giờ đến/đi trực tiếp, tìm kiếm chuyến bay, bản đồ máy bay realtime cho các sân bay Việt Nam." },
      { name: "author", content: "Bay Live" },
      { property: "og:title", content: "Bay Live — Theo dõi chuyến bay sân bay Việt Nam" },
      { property: "og:description", content: "FIDS trực tiếp cho SGN, HAN, DAD và toàn bộ sân bay Việt Nam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SiteShell>
        <Outlet />
      </SiteShell>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}

function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 pb-16">{children}</main>
      <SiteTicker />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-foreground/15 bg-background/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex flex-wrap items-baseline justify-between gap-4">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display italic text-2xl md:text-3xl leading-none">Bay Live</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">VN · FIDS</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
          <NavItem to="/">Trang chủ</NavItem>
          <NavItem to="/airports/SGN">Sân bay</NavItem>
          <NavItem to="/map">Bản đồ</NavItem>
          <NavItem to="/stats">Thống kê</NavItem>
        </nav>
      </div>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 rounded-full hover:bg-foreground/5 transition-colors"
      activeProps={{ className: "px-3 py-1.5 rounded-full bg-foreground text-background" }}
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}

function SiteTicker() {
  const items = [
    "Dữ liệu cập nhật mỗi 60 giây",
    "Bay Live theo dõi 19 sân bay dân dụng tại Việt Nam",
    "Bấm vào số hiệu chuyến bay để xem chi tiết hành trình",
    "Bản đồ realtime hiển thị máy bay đang bay trong vùng FIR Hồ Chí Minh và Hà Nội",
  ];
  const line = items.join("  ●  ");
  return (
    <footer className="fixed bottom-0 left-0 w-full bg-foreground text-background py-1.5 overflow-hidden z-30">
      <div className="flex whitespace-nowrap gap-12 font-mono text-[10px] uppercase tracking-[0.25em] animate-ticker">
        <span className="pl-8">{line}</span>
        <span>{line}</span>
      </div>
    </footer>
  );
}
