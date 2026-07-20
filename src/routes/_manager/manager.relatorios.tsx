import { createFileRoute } from "@tanstack/react-router";
import { LandlordRelatoriosPage } from "@/routes/_authenticated/relatorios";

export const Route = createFileRoute("/_manager/manager/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — NEXO" }] }),
  component: LandlordRelatoriosPage,
});
