import { useState } from "react";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Troca de senha exigindo apenas a senha ATUAL (reautenticação) + a nova senha.
 * A senha atual é validada no servidor de auth via signInWithPassword.
 */
export function ChangePasswordCard() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = user?.email;
    if (!email) return;

    if (!current) { toast.error("Informe sua senha atual."); return; }
    
    // 3/4 password complexity validation
    const hasLength = next.length >= 8;
    const hasUpper = /[A-Z]/.test(next);
    const hasNumber = /\d/.test(next);
    const hasSpecial = /[^A-Za-z0-9]/.test(next);
    const score = Number(hasLength) + Number(hasUpper) + Number(hasNumber) + Number(hasSpecial);
    const isValid = hasLength && score >= 3;

    if (!isValid) { 
      toast.error("A nova senha deve ter 8+ caracteres e atender 3 dos 4 critérios (Maiúscula, Número, Símbolo)."); 
      return; 
    }
    if (next !== confirm) { toast.error("A confirmação não confere com a nova senha."); return; }
    if (next === current) { toast.error("A nova senha deve ser diferente da atual."); return; }

    setSaving(true);
    try {
      // 1) Reautentica com a senha atual
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (authError) {
        toast.error("Senha atual incorreta.");
        return;
      }

      // 2) Atualiza para a nova senha
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        toast.error(error.message || "Não foi possível alterar a senha.");
        return;
      }

      toast.success("Senha alterada com sucesso!");
      setCurrent("");
      setNext("");
      setConfirm("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          Alterar senha
        </CardTitle>
        <CardDescription>
          Basta informar sua senha atual e definir a nova — sem e-mail de confirmação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="current_password">Senha atual</Label>
            <div className="relative">
              <Input
                id="current_password"
                type={show ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                placeholder="Sua senha atual"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? "Ocultar senhas" : "Mostrar senhas"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="new_password">Nova senha</Label>
            <Input
              id="new_password"
              type={show ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <Label htmlFor="confirm_password">Confirmar nova senha</Label>
            <Input
              id="confirm_password"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <KeyRound className="size-4 mr-2" />}
              Alterar senha
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
