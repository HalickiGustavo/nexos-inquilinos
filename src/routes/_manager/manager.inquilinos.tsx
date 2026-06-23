import { createFileRoute } from "@tanstack/react-router";
import { TenantsManagement } from "@/components/TenantsManagement";

export const Route = createFileRoute("/_manager/manager/inquilinos")({
  head: () => ({ meta: [{ title: "Inquilinos — NEXO Imobiliária" }] }),
  component: TenantsManagement,
});
