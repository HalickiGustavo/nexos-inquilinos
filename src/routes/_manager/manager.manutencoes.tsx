import { createFileRoute } from "@tanstack/react-router";
import { MaintenancesPage } from "@/routes/_authenticated/maintenances";

export const Route = createFileRoute("/_manager/manager/manutencoes")({
  head: () => ({ meta: [{ title: "Manutenções — Imobiliária NEXO" }] }),
  component: MaintenancesPage,
});
