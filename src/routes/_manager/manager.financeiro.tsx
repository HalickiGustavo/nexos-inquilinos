import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, formatDate } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_manager/manager/financeiro")({
  component: Financeiro,
});

function Financeiro() {
  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-zinc-500">Recebimentos da imobiliária e repasses aos proprietários</p>
      </header>
      <Tabs defaultValue="recebimentos">
        <TabsList>
          <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
          <TabsTrigger value="repasses">Repasses</TabsTrigger>
        </TabsList>
        <TabsContent value="recebimentos"><Recebimentos /></TabsContent>
        <TabsContent value="repasses"><Repasses /></TabsContent>
      </Tabs>
    </div>
  );
}

function Recebimentos() {
  const [statusF, setStatusF] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const q = useQuery({
    queryKey: ["mgr-receb"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*, contract:contracts(property:properties(code,address,owner_name), tenant:tenants(full_name))")
        .order("due_date", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const rows = (q.data ?? []).filter((i: any) => {
    if (statusF !== "todos" && i.status !== statusF) return false;
    if (from && i.due_date < from) return false;
    if (to && i.due_date > to) return false;
    return true;
  });

  const badge = (s: string) => {
    const map: Record<string, string> = {
      pago: "bg-primary/15 text-primary border-primary/30",
      atrasado: "bg-red-500/15 text-red-700 border-red-500/30",
      pendente: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    };
    return <Badge variant="outline" className={map[s] ?? ""}>{s}</Badge>;
  };

  return (
    <div className="space-y-3 mt-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1"><label className="text-xs">Status</label>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><label className="text-xs">De</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><label className="text-xs">Até</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Vencimento</TableHead>
            <TableHead>Imóvel</TableHead>
            <TableHead>Inquilino</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Pago</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-zinc-500">Sem registros</TableCell></TableRow>}
            {rows.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell>{formatDate(i.due_date)}</TableCell>
                <TableCell className="text-xs font-mono">{i.contract?.property?.code ?? "—"}</TableCell>
                <TableCell>{i.contract?.tenant?.full_name ?? "—"}</TableCell>
                <TableCell className="text-right">{formatBRL(i.amount)}</TableCell>
                <TableCell className="text-right">{formatBRL(i.paid_amount)}</TableCell>
                <TableCell>{badge(i.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function Repasses() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mgr-repasses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*, contract:contracts(property:properties(code,address,owner_name,owner_commission_percent))")
        .eq("status", "pago")
        .order("payment_date", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const confirmRepasse = async (id: string) => {
    const { error } = await supabase.from("installments").update({ payout_status: "repassado", payout_date: new Date().toISOString() } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Repasse confirmado");
    qc.invalidateQueries({ queryKey: ["mgr-repasses"] });
  };

  return (
    <Card className="mt-4"><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Imóvel</TableHead>
          <TableHead>Proprietário</TableHead>
          <TableHead className="text-right">Recebido</TableHead>
          <TableHead className="text-right">Taxa Adm.</TableHead>
          <TableHead className="text-right">A Repassar</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-zinc-500">Nenhum repasse</TableCell></TableRow>}
          {(q.data ?? []).map((i: any) => {
            const fee = Number(i.management_fee_percent ?? 10);
            const pago = Number(i.paid_amount ?? 0);
            const taxa = pago * fee / 100;
            const repasse = pago - taxa;
            const status = (i.payout_status ?? "aguardando");
            return (
              <TableRow key={i.id}>
                <TableCell className="text-xs font-mono">{i.contract?.property?.code ?? "—"}</TableCell>
                <TableCell>{i.contract?.property?.owner_name ?? "—"}</TableCell>
                <TableCell className="text-right">{formatBRL(pago)}</TableCell>
                <TableCell className="text-right text-zinc-500">{formatBRL(taxa)} ({fee}%)</TableCell>
                <TableCell className="text-right font-medium text-primary">{formatBRL(repasse)}</TableCell>
                <TableCell>
                  {status === "repassado"
                    ? <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline">Repassado</Badge>
                    : <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" variant="outline">Aguardando Repasse</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {status !== "repassado" && (
                    <Button size="sm" variant="outline" onClick={() => confirmRepasse(i.id)}>
                      <CheckCircle2 className="size-4 mr-1" /> Confirmar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
