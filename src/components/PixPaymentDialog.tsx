import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Loader2, AlertCircle, CheckCircle2, Download, ExternalLink, QrCode, FileText } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatBRL, formatDate } from "@/lib/format";
import { checkPixPayment } from "@/lib/pix-split.functions";

/**
 * Modal de pagamento — PIX + Boleto (abas), compacto, sem scroll.
 */
export function PixPaymentDialog({
  installment,
  open,
  onOpenChange,
  loading = false,
  error = null,
  debug: _debug = null,
  onPaid,
}: {
  installment: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loading?: boolean;
  error?: string | null;
  debug?: unknown | null;
  onPaid?: () => void;
}) {
  const [copying, setCopying] = useState(false);
  const [copyingBoleto, setCopyingBoleto] = useState(false);
  const [paid, setPaid] = useState(false);
  const [qrFallback, setQrFallback] = useState<string | null>(null);
  const [tab, setTab] = useState<"pix" | "boleto">("pix");
  const checkPaid = useServerFn(checkPixPayment);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  // Polling confirmação.
  useEffect(() => {
    if (!open || !installment?.id || !installment?.pix_payload || paid) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res: any = await checkPaid({ data: { installmentId: installment.id } });
        if (!cancelled && res?.paid) {
          setPaid(true);
          toast.success("Pagamento confirmado com sucesso.");
          onPaidRef.current?.();
          setTimeout(() => onOpenChange(false), 1600);
        }
      } catch { /* ignora */ }
    };
    const id = setInterval(tick, 5000);
    tick();
    return () => { cancelled = true; clearInterval(id); };
  }, [open, installment?.id, installment?.pix_payload, paid, checkPaid, onOpenChange]);

  useEffect(() => {
    if (!open) { setPaid(false); setQrFallback(null); setTab("pix"); }
  }, [open]);

  const amount = Number(installment?.split_breakdown?.total ?? installment?.amount ?? 0);
  const pixPayload: string | null = installment?.pix_payload ?? null;
  const qrFromServer = installment?.pix_qrcode
    ? `data:image/png;base64,${installment.pix_qrcode}`
    : null;
  const qrSrc = qrFromServer ?? qrFallback;
  const boletoUrl: string | null = installment?.boleto_url ?? null;
  const boletoLine: string | null = installment?.barcode ?? null;

  // Fallback local QR.
  useEffect(() => {
    if (!open || qrFromServer || !pixPayload) return;
    let cancelled = false;
    QRCode.toDataURL(pixPayload, { margin: 1, width: 440, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setQrFallback(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, qrFromServer, pixPayload]);

  if (!installment) return null;

  const copyPix = async () => {
    if (!pixPayload) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(pixPayload);
      toast.success("PIX copiado com sucesso.");
    } catch { toast.error("Não foi possível copiar"); }
    finally { setTimeout(() => setCopying(false), 600); }
  };

  const copyBoleto = async () => {
    if (!boletoLine) return;
    setCopyingBoleto(true);
    try {
      await navigator.clipboard.writeText(boletoLine);
      toast.success("Linha digitável copiada.");
    } catch { toast.error("Não foi possível copiar"); }
    finally { setTimeout(() => setCopyingBoleto(false), 600); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:max-w-[520px] p-0 gap-0 border-border block">
        <div className="p-5 sm:p-6 min-w-0 w-full max-w-full">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base font-semibold">Pagamento da parcela</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Escolha entre PIX ou Boleto para concluir o pagamento.
            </DialogDescription>
          </DialogHeader>

          {/* Valor */}
          <div className="mt-4 flex items-baseline justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Valor a pagar</p>
              <p className="text-3xl font-bold tabular-nums mt-0.5">{formatBRL(amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Vencimento</p>
              <p className="text-sm font-medium mt-0.5">{formatDate(installment.due_date)}</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "pix" | "boleto")} className="mt-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="pix"><QrCode className="size-4 mr-1.5" />PIX</TabsTrigger>
              <TabsTrigger value="boleto"><FileText className="size-4 mr-1.5" />Boleto</TabsTrigger>
            </TabsList>

            {/* PIX */}
            <TabsContent value="pix" className="mt-4">
              {loading && (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="size-6 animate-spin text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Gerando código PIX…</p>
                </div>
              )}

              {!loading && error && (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <AlertCircle className="size-6 text-destructive" />
                  <p className="text-sm font-medium">Não foi possível gerar o PIX</p>
                  <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
                </div>
              )}

              {!loading && !error && !pixPayload && (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium">Seu PIX está sendo gerado</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Aguarde alguns instantes ou tente novamente em seguida.
                  </p>
                </div>
              )}

              {!loading && !error && pixPayload && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="rounded-lg border border-border bg-white p-3">
                      {qrSrc ? (
                        <img
                          src={qrSrc}
                          alt="QR Code PIX"
                          className="block h-[200px] w-[200px] sm:h-[220px] sm:w-[220px]"
                        />
                      ) : (
                        <div className="h-[200px] w-[200px] sm:h-[220px] sm:w-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="size-5 animate-spin" />
                          <p className="text-[11px] text-center px-2">QR Code sendo gerado…</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">PIX Copia e Cola</p>
                    <div className="flex items-stretch gap-2 min-w-0">
                      <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2">
                        <p className="font-mono text-[11px] leading-tight text-muted-foreground truncate">
                          {pixPayload}
                        </p>
                      </div>
                      <Button onClick={copyPix} disabled={copying || paid} size="sm" className="shrink-0 px-3">
                        {copying ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
                        <span className="ml-1.5 hidden sm:inline">Copiar código</span>
                      </Button>
                    </div>
                  </div>

                  {paid ? (
                    <div className="flex items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                      <CheckCircle2 className="size-4 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Pagamento confirmado com sucesso.
                      </p>
                    </div>
                  ) : (
                    <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Aguardando confirmação do pagamento…
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* BOLETO */}
            <TabsContent value="boleto" className="mt-4">
              {!boletoUrl && !boletoLine ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium">Boleto sendo gerado</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    O boleto ficará disponível em instantes. Enquanto isso, utilize o PIX para pagamento imediato.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {boletoLine && (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Linha digitável</p>
                      <div className="flex items-stretch gap-2 min-w-0">
                        <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2">
                          <p className="font-mono text-[11px] leading-tight text-muted-foreground truncate">
                            {boletoLine}
                          </p>
                        </div>
                        <Button onClick={copyBoleto} disabled={copyingBoleto} size="sm" className="shrink-0 px-3">
                          {copyingBoleto ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
                          <span className="ml-1.5 hidden sm:inline">Copiar linha</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {boletoUrl ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button variant="outline" asChild>
                        <a href={boletoUrl} target="_blank" rel="noreferrer" download>
                          <Download className="size-4 mr-2" /> Baixar PDF
                        </a>
                      </Button>
                      <Button asChild>
                        <a href={boletoUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4 mr-2" /> Abrir boleto
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> PDF do boleto sendo gerado…
                    </p>
                  )}

                  <p className="text-[11px] text-muted-foreground text-center">
                    Pagamentos por boleto podem levar até 2 dias úteis para serem compensados.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
