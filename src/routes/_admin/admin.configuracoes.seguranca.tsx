import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, Info, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/admin/configuracoes/seguranca")({
  component: SegurancaPage,
});

const SITE_KEY = "recaptcha_site_key";
const SECRET_KEY = "recaptcha_secret_key";

const schema = z.object({
  siteKey: z.string().trim().min(30, "Chave do Site inválida (mínimo 30 caracteres).").max(120),
  secretKey: z.string().trim().min(30, "Chave Secreta inválida (mínimo 30 caracteres).").max(120),
});

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-0 focus-visible:border-violet-500 transition-shadow";

function SegurancaPage() {
  const [siteKey, setSiteKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ siteKey?: string; secretKey?: string }>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key,value")
        .in("key", [SITE_KEY, SECRET_KEY]);
      if (!active) return;
      if (error) {
        toast.error("Não foi possível carregar as configurações.");
      } else if (data) {
        for (const row of data) {
          if (row.key === SITE_KEY) setSiteKey(row.value ?? "");
          if (row.key === SECRET_KEY) setSecretKey(row.value ?? "");
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const parsed = schema.safeParse({ siteKey, secretKey });
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as "siteKey" | "secretKey";
        fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Verifique os campos destacados.");
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      [
        { key: SITE_KEY, value: parsed.data.siteKey, description: "Google reCAPTCHA v2 — Site Key (pública)" },
        { key: SECRET_KEY, value: parsed.data.secretKey, description: "Google reCAPTCHA v2 — Secret Key (privada)" },
      ],
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    toast.success("Configurações de segurança atualizadas com sucesso! O reCAPTCHA já está ativo.");
  }, [saving, siteKey, secretKey]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Card className="border-border/60 bg-card/60 shadow-[0_0_0_1px_rgba(139,92,246,0.06),0_20px_60px_-20px_rgba(139,92,246,0.25)]">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg grid place-items-center bg-violet-500/10 border border-violet-500/30 text-violet-300 shadow-[0_0_24px_-6px_rgba(139,92,246,0.6)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">Proteção contra Bots (Google reCAPTCHA v2)</CardTitle>
              <CardDescription>
                Configure as credenciais do reCAPTCHA para proteger o cadastro e login da plataforma.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-10 grid place-items-center">
              <Loader2 className="size-5 animate-spin text-violet-400" />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="site-key" className="text-sm">Chave do Site (Pública)</Label>
                <p className="text-xs text-muted-foreground">
                  Usada pelo frontend para renderizar o widget do reCAPTCHA.
                </p>
                <Input
                  id="site-key"
                  type="text"
                  placeholder="6L..."
                  autoComplete="off"
                  spellCheck={false}
                  value={siteKey}
                  onChange={(e) => setSiteKey(e.target.value)}
                  disabled={saving}
                  className={cn(focusRing, errors.siteKey && "border-destructive focus-visible:ring-destructive")}
                />
                {errors.siteKey && <p className="text-xs text-destructive">{errors.siteKey}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret-key" className="text-sm">Chave Secreta (Privada)</Label>
                <p className="text-xs text-muted-foreground">
                  Usada no servidor para validar as respostas do reCAPTCHA. Nunca exponha publicamente.
                </p>
                <div className="relative">
                  <Input
                    id="secret-key"
                    type={showSecret ? "text" : "password"}
                    placeholder="6L..."
                    autoComplete="off"
                    spellCheck={false}
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    disabled={saving}
                    className={cn(
                      "pr-11",
                      focusRing,
                      errors.secretKey && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((s) => !s)}
                    aria-label={showSecret ? "Ocultar chave secreta" : "Mostrar chave secreta"}
                    className="absolute inset-y-0 right-0 px-3 grid place-items-center text-muted-foreground hover:text-violet-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.secretKey && <p className="text-xs text-destructive">{errors.secretKey}</p>}
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-violet-500/30 bg-violet-500/[0.06] p-4">
                <Info className="size-4 text-violet-300 mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed text-violet-100/80">
                  <span className="font-semibold text-violet-200">Nota de Segurança:</span>{" "}
                  Para que a validação nativa de cadastros do Supabase funcione, certifique-se também
                  de injetar estes mesmos tokens nas chaves secretas do seu painel Supabase
                  (Auth → Providers → CAPTCHA).
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_24px_-6px_rgba(139,92,246,0.8)] disabled:opacity-70"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-white" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Salvar Configurações
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
