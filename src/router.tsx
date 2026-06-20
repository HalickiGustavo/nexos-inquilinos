import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-foreground">Algo deu errado</h1>
        <p className="mt-3 text-muted-foreground">Recarregue a página ou volte ao início.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={reset}>
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

export const getRouter = () => {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Prefetch route chunks on hover/focus for instant transitions
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Let React Query own data freshness; router only caches preloaded chunks
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });
};
