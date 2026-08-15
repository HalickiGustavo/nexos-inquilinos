import { createFileRoute } from "@tanstack/react-router";
import { AgencyReportsPage } from "@/components/agency/AgencyReportsPage";

export const Route = createFileRoute("/_manager/manager/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios Administrativos — NEXO" }] }),
  component: AgencyReportsPage,
});
