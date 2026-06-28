import { useState } from "react";
import { Copy, Download, QrCode, Loader2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";
import { generateBoletoCharge } from "@/lib/pix-split.functions";


export function PixPaymentDialog({
  installment,
  open,
  onOpenChange,
  loading = false,
  error = null,
}: {
  installment: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const [copying, setCopying] = useState(false);
  const [boletoLoading, setBoletoLoading] = useState(false);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(installment?.boleto_url ?? null);
  const [boletoBarcode, setBoletoBarcode] = useState<string | null>(installment?.boleto_barcode ?? installment?.barcode ?? null);
  const [boletoError, setBoletoError] = useState<string | null>(null);
  const genBoleto = useServerFn(generateBoletoCharge);

  if (!installment) return null;

  const amount = Number(installment.split_breakdown?.total ?? installment.amount);
  const pixPayload: string | null = installment.pix_payload ?? null;
  const qrSrc = installment.pix_qrcode
    ? `data:image/png;base64,${installment.pix_qrcode}`
    : null;

  const copy = async () => {
    if (!pixPayload) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(pixPayload);
      toast.success("Código Pix copiado! Cole no aplicativo do seu banco para pagar.");
    } catch {
      toast.error("Não foi possível copiar");
    } finally {
      setTimeout(() => setCopying(false), 600);
    }
  };

  const handleGenerateBoleto = async () => {
    if (!installment?.id) return;
    setBoletoLoading(true);
    setBoletoError(null);
    try {
      const res: any = await genBoleto({ data: { installmentId: installment.id } });
      if (!res?.ok) {
        setBoletoError(res?.error ?? "Falha ao gerar boleto.");
        toast.error(res?.error ?? "Falha ao gerar boleto.");
        return;
      }
      setBoletoUrl(res.url);
      setBoletoBarcode(res.barcode);
      toast.success("Boleto gerado com sucesso!");
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao gerar boleto.";
      setBoletoError(msg);
      toast.error(msg);
    } finally {
      setBoletoLoading(false);
    }
  };

  const copyBarcode = async () => {
    if (!boletoBarcode) return;
    try {
      await navigator.clipboard.writeText(boletoBarcode);
      toast.success("Linha digitável copiada!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" /> Pagar este aluguel
          </DialogTitle>
          <DialogDescription>
            Vencimento {formatDate(installment.due_date)} — escolha Pix ou Boleto.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pix" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="pix"><QrCode className="size-4 mr-1.5" /> Pix</TabsTrigger>
            <TabsTrigger value="boleto"><FileText className="size-4 mr-1.5" /> Boleto</TabsTrigger>
          </TabsList>

          <TabsContent value="pix" className="space-y-4 mt-4">

          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor a pagar</p>
            <p className="text-3xl font-bold text-primary mt-1">{formatBRL(amount)}</p>
            <Badge variant="outline" className="mt-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              Pix com split nativo de 3 vias
            </Badge>
          </div>

          {installment.split_breakdown && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/[0.06] p-3 shadow-[0_0_24px_-12px_rgb(168_85_247)]">
              <p className="text-xs uppercase tracking-wide text-violet-300 font-semibold mb-2">
                Detalhamento do split
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plataforma Nexo</span>
                  <span className="font-medium">{formatBRL(installment.split_breakdown.nexo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Imobiliária (administração)</span>
                  <span className="font-medium">{formatBRL(installment.split_breakdown.agency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proprietário (líquido)</span>
                  <span className="font-medium">{formatBRL(installment.split_breakdown.owner)}</span>
                </div>
                <div className="flex justify-between pt-1 mt-1 border-t border-violet-500/20 font-semibold">
                  <span>Total</span>
                  <span>{formatBRL(installment.split_breakdown.total)}</span>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-8 animate-spin mb-3 text-primary" />
              <p className="text-sm">Gerando QR Code Pix...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="size-8 text-destructive mb-2" />
              <p className="text-sm font-medium text-destructive">Não foi possível gerar o PIX</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && qrSrc && pixPayload && (
            <>
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-lg ring-2 ring-violet-500/60 shadow-[0_0_36px_-6px_rgb(168_85_247)]">
                  <img src={qrSrc} alt="QR Code Pix" className="w-full max-w-[208px] h-auto aspect-square" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pix Copia e Cola</p>
                <div className="font-mono text-xs break-all rounded-md border bg-muted/40 p-3 max-h-20 overflow-auto">
                  {pixPayload}
                </div>
                <Button className="w-full" onClick={copy} disabled={copying}>
                  {copying ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Copy className="size-4 mr-2" />}
                  Copiar Código Copia e Cola
                </Button>
              </div>
            </>
          )}
          </TabsContent>

          <TabsContent value="boleto" className="space-y-4 mt-4">
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor do boleto</p>
              <p className="text-3xl font-bold text-primary mt-1">{formatBRL(amount)}</p>
              <Badge variant="outline" className="mt-2 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                Repasse automático D+1 para imobiliária e proprietário
              </Badge>
            </div>

            {!boletoUrl && !boletoLoading && (
              <Button className="w-full" onClick={handleGenerateBoleto}>
                <FileText className="size-4 mr-2" /> Gerar Boleto
              </Button>
            )}

            {boletoLoading && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="size-8 animate-spin mb-3 text-primary" />
                <p className="text-sm">Emitindo boleto na Efí...</p>
              </div>
            )}

            {boletoError && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <AlertCircle className="size-7 text-destructive mb-2" />
                <p className="text-sm font-medium text-destructive">Não foi possível gerar o boleto</p>
                <p className="text-xs text-muted-foreground mt-1">{boletoError}</p>
              </div>
            )}

            {boletoUrl && (
              <div className="space-y-3">
                <Button variant="outline" className="w-full" asChild>
                  <a href={boletoUrl} target="_blank" rel="noreferrer">
                    <Download className="size-4 mr-2" /> Visualizar Boleto PDF
                  </a>
                </Button>

                {boletoBarcode && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Linha digitável</p>
                    <div className="font-mono text-xs break-all rounded-md border bg-muted/40 p-3 max-h-20 overflow-auto">
                      {boletoBarcode}
                    </div>
                    <Button className="w-full" onClick={copyBarcode}>
                      <Copy className="size-4 mr-2" /> Copiar linha digitável
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

    </Dialog>
  );
}
