import { useRef, useState } from "react";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate } from "@/lib/queries";
import { useConfirm } from "@/components/ui/confirm";

interface Props {
  contractId: string;
  currentPath: string | null | undefined;
}

export async function openContractPdf(path: string) {
  const { data, error } = await supabase.storage
    .from("contracts")
    .createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Falha ao abrir PDF");
  window.open(data.signedUrl, "_blank");
}

export function ContractPdfUploader({ contractId, currentPath }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  const confirm = useConfirm();

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx. 15MB).");
      return;
    }
    setBusy(true);
    try {
      // Remove previous file if present
      if (currentPath) {
        await supabase.storage.from("contracts").remove([currentPath]);
      }
      const path = `${contractId}/contrato-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("contracts")
        .upload(path, file, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("contracts")
        .update({ contract_pdf_path: path })
        .eq("id", contractId);
      if (dbErr) throw dbErr;
      toast.success("Contrato enviado!");
      invalidate(["contracts"]);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar contrato");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!currentPath) return;
    const ok = await confirm({
      title: "Remover o PDF anexado deste contrato?",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Remover PDF",
      tone: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await supabase.storage.from("contracts").remove([currentPath]);
      const { error } = await supabase
        .from("contracts")
        .update({ contract_pdf_path: null })
        .eq("id", contractId);
      if (error) throw error;
      toast.success("PDF removido");
      invalidate(["contracts"]);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao remover");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFile(f);
        }}
      />
      {currentPath ? (
        <>
          <Button size="sm" variant="outline" onClick={() => openContractPdf(currentPath).catch((e) => toast.error(e.message))}>
            <FileText className="size-3.5 mr-1.5" />Ver PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Upload className="size-3.5 mr-1.5" />}
            Substituir
          </Button>
          <Button size="sm" variant="ghost" onClick={handleRemove} disabled={busy} title="Remover PDF anexado">
            <Trash2 className="size-3.5 text-destructive mr-1.5" />Remover PDF
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Upload className="size-3.5 mr-1.5" />}
          Anexar contrato (PDF)
        </Button>
      )}
    </div>
  );
}
