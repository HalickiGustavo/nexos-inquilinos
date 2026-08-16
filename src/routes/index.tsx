import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    title: "Nexos — Inteligência Imobiliária",
    meta: [
      {
        name: "description",
        content: "A plataforma inteligente para gestão de imóveis e locação.",
      },
    ],
  }),
  component: () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Nexos</h1>
        <p className="text-xl text-muted-foreground">
          Inteligência Imobiliária de Ponta a Ponta.
        </p>
        <div className="pt-8">
          <a
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Entrar no Sistema
          </a>
        </div>
      </div>
    </div>
  ),
});
