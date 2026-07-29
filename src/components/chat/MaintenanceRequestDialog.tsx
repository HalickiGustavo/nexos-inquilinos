import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EvidenceUploader } from "@/components/EvidenceUploader";

export const MAINTENANCE_CATEGORIES = [
  { value: "hidraulica", label: "Hidráulica" },
  { value: "eletrica", label: "Elétrica" },
  { value: "pintura", label: "Pintura" },
  { value: "estrutural", label: "Estrutural" },
  { value: "limpeza", label: "Limpeza" },
  { value: "outros", label: "Outros" },
] as const;

const PRIORITIES = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
] as const;

export function MaintenanceRequestDialog({
  contractId,
  propertyId,
}: {
  contractId: string | null;
  propertyId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("outros");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("media");
  const [evidence, setEvidence] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const reset = () => {
    setTitle("");
    setCategory("outros");
    setDescription("");
    setPriority("media");
    setEvidence([]);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!propertyId) throw new Error("Conversa sem imóvel vinculado");
      if (title.trim().length < 3) throw new Error("Informe um título válido");

      let ownerUserId: string | null = null;
      let tenantId: string | null = null;

      if (contractId) {
        const { data: contract, error } = await supabase
          .from("contracts")
          .select("user_id, tenant_id")
          .eq("id", contractId)
          .maybeSingle();
        if (error) throw error;
        ownerUserId = contract?.user_id ?? null;
        tenantId = contract?.tenant_id ?? null;
      }
      if (!ownerUserId) {
        const { data: u } = await supabase.auth.getUser();
        ownerUserId = u.user?.id ?? null;
      }
      if (!ownerUserId) throw new Error("Não autenticado");

      const { error } = await supabase.from("maintenances").insert({
        user_id: ownerUserId,
        property_id: propertyId,
        contract_id: contractId,
        tenant_id: tenantId,
        title: title.trim(),
        description: description.trim() || null,
        category,
        priority,
        status: "pendente",
        evidence_urls: evidence,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação registrada em Manutenções");
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      queryClient.invalidateQueries({ queryKey: ["maintenances"] });
      reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível enviar a solicitação"),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Wrench className="size-4" />
        Solicitar Manutenção
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar manutenção</DialogTitle>
            <DialogDescription>
              A solicitação é registrada no módulo de Manutenções e vinculada ao imóvel e ao contrato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mt-title">Título do problema</Label>
              <Input
                id="mt-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Vazamento na pia da cozinha"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grau de urgência</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mt-desc">Descrição detalhada</Label>
              <Textarea
                id="mt-desc"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o problema, quando começou e o que já foi tentado."
              />
            </div>

            <div className="space-y-2">
              <Label>Fotos e vídeos</Label>
              <EvidenceUploader value={evidence} onChange={setEvidence} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
