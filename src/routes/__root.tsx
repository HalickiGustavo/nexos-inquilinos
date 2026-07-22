import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { AuthProvider } from "../lib/auth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ConfirmProvider } from "@/components/ui/confirm";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nexo" },
      { name: "description", content: "Sistema completo para controle de imóveis, inquilinos, contratos e finanças." },
      { property: "og:title", content: "Nexo" },
      { name: "twitter:title", content: "Nexo" },

      { property: "og:description", content: "Sistema completo para controle de imóveis, inquilinos, contratos e finanças." },
      { name: "twitter:description", content: "Sistema completo para controle de imóveis, inquilinos, contratos e finanças." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f53b926a-f7b7-4515-9f45-fd9a93697ea7/id-preview-071a7f55--231b8419-e2f6-4a97-8769-d585255d26c4.lovable.app-1780178461559.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f53b926a-f7b7-4515-9f45-fd9a93697ea7/id-preview-071a7f55--231b8419-e2f6-4a97-8769-d585255d26c4.lovable.app-1780178461559.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/__l5e/assets-v1/7968f272-7dbe-4a4f-a051-c97ce34eb6d2/nexo-logo.png" },
      { rel: "apple-touch-icon", href: "/__l5e/assets-v1/7968f272-7dbe-4a4f-a051-c97ce34eb6d2/nexo-logo.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Urbanist:wght@500;600;700;800;900&family=Epilogue:wght@300;400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "https://progressier.app/KaHnwaaTl4brmyedFUG4/progressier.json" },
    ],
    scripts: [
      { defer: true, src: "https://progressier.app/KaHnwaaTl4brmyedFUG4/script.js" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada</p>
        <a href="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground">Voltar ao início</a>
      </div>
    </div>
  ),
});

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-foreground">Algo deu errado</h1>
        <p className="mt-3 text-muted-foreground">
          Não foi possível carregar esta tela. Tente novamente em alguns segundos.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              reset();
              router.invalidate();
            }}
          >
            Tentar novamente
          </button>
          <a className="rounded-md border px-4 py-2 text-sm font-medium text-foreground" href="/">
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
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
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: 1,
        // Only re-render components when the props they actually read change
        notifyOnChangeProps: "all",
      },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ConfirmProvider>
            <Outlet />
            <Toaster richColors position="top-right" />
          </ConfirmProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
