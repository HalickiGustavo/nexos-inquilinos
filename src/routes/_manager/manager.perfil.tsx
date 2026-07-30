import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, User as UserIcon, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_manager/manager/perfil")({
  component: PerfilPage,
});

function maskDoc(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}
function validateCpf(c: string) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let d = (s * 10) % 11; if (d === 10) d = 0; if (d !== +c[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0; return d2 === +c[10];
}
function validateCnpj(c: string) {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (b: string, w: number[]) => { const s = w.reduce((a, x, i) => a + +b[i] * x, 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const d1 = calc(c.slice(0, 12), w1), d2 = calc(c.slice(0, 12) + d1, w2);
  return d1 === +c[12] && d2 === +c[13];
}

// O banco aceita apenas: cpf | cnpj | email | phone | random
const PIX_KEY_TYPES = ["cpf", "cnpj", "email", "phone", "random"] as const;
function normalizePixKeyType(value?: string | null): string {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v === "evp" || v === "aleatoria" || v === "aleatória") return "random";
  return (PIX_KEY_TYPES as readonly string[]).includes(v) ? v : "";
}

function PerfilPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [document_type, setDocumentType] = useState<"CPF" | "CNPJ">("CPF");
  const [pix_key, setPixKey] = useState("");
  const [pix_key_type, setPixKeyType] = useState<string>("");

  const [birth_date, setBirthDate] = useState("");
  const [income_value, setIncomeValue] = useState<string>("");
  const [postal_code, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [address_number, setAddressNumber] = useState("");
  const [address_complement, setAddressComplement] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone, document, document_type, pix_key, pix_key_type, birth_date, income_value, postal_code, address, address_number, address_complement, province, city, state")
        .eq("id", user.id)
        .maybeSingle();
      if (error) toast.error("Erro ao carregar perfil: " + error.message);
      if (data) {
        setFullName(data.full_name ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ? maskPhone(data.phone) : "");
        setDocument(data.document ? maskDoc(data.document) : "");
        setDocumentType((data.document_type as "CPF" | "CNPJ") ?? (((data.document ?? "").replace(/\D/g, "").length === 14) ? "CNPJ" : "CPF"));
        setPixKey(data.pix_key ?? "");
        setPixKeyType(normalizePixKeyType(data.pix_key_type));
        setBirthDate((data as any).birth_date ?? "");
        setIncomeValue((data as any).income_value != null ? String((data as any).income_value) : "");
        setPostalCode((data as any).postal_code ? maskCep((data as any).postal_code) : "");
        setAddress((data as any).address ?? "");
        setAddressNumber((data as any).address_number ?? "");
        setAddressComplement((data as any).address_complement ?? "");
        setProvince((data as any).province ?? "");
        setCity((data as any).city ?? "");
        setStateUf((data as any).state ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  async function lookupCep(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const j = await res.json();
      if (j?.erro) { toast.error("CEP não encontrado."); return; }
      setAddress(j.logradouro ?? address);
      setProvince(j.bairro ?? province);
      setCity(j.localidade ?? "");
      setStateUf(j.uf ?? "");
    } catch {
      toast.error("Falha ao buscar CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const docDigits = document.replace(/\D/g, "");
    if (docDigits) {
      const ok = document_type === "CPF" ? validateCpf(docDigits) : validateCnpj(docDigits);
      if (!ok) { toast.error(`${document_type} inválido. Confira os dígitos.`); return; }
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      toast.error("Telefone deve ter 10 ou 11 dígitos (com DDD)."); return;
    }
    const cepDigits = postal_code.replace(/\D/g, "");
    if (cepDigits && cepDigits.length !== 8) { toast.error("CEP deve ter 8 dígitos."); return; }
    const income = income_value ? Number(income_value) : null;
    if (income_value && !(income! > 0)) { toast.error("Faturamento mensal inválido."); return; }

    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: full_name.trim(),
      phone: phoneDigits || null,
      document: docDigits || null,
      document_type: docDigits ? document_type : null,
      pix_key: pix_key.trim() || null,
      pix_key_type: normalizePixKeyType(pix_key_type) || null,
      birth_date: birth_date || null,
      income_value: income,
      postal_code: cepDigits || null,
      address: address.trim() || null,
      address_number: address_number.trim() || null,
      address_complement: address_complement.trim() || null,
      province: province.trim() || null,
      city: city.trim() || null,
      state: stateUf.trim() || null,
    } as any).eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Perfil atualizado!");
  }

  if (loading) {
    return <div className="p-8 grid place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><UserIcon className="size-6 text-primary" />Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Informações usadas no cadastro Asaas, contratos e comunicações.</p>
      </div>

      <form onSubmit={onSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
            <CardDescription>Mantenha CPF/CNPJ e telefone corretos — são exigidos pelo gateway de pagamentos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="full_name">Nome completo / Razão social</Label>
              <Input id="full_name" value={full_name} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={email} disabled />
              <p className="text-[11px] text-muted-foreground mt-1">Para alterar e-mail, use a tela de login.</p>
            </div>
            <div>
              <Label htmlFor="phone">Celular (com DDD)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Tipo de documento</Label>
              <Select value={document_type} onValueChange={(v) => setDocumentType(v as "CPF" | "CNPJ")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="document">{document_type}</Label>
              <Input id="document" value={document} onChange={(e) => setDocument(maskDoc(e.target.value))} placeholder={document_type === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"} />
            </div>
            {document_type === "CPF" && (
              <div>
                <Label htmlFor="birth_date">Data de nascimento</Label>
                <Input id="birth_date" type="date" value={birth_date} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="income_value">Faturamento mensal (R$)</Label>
              <Input id="income_value" type="number" min="1" step="0.01" value={income_value} onChange={(e) => setIncomeValue(e.target.value)} placeholder="10000" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="size-5" />Endereço</CardTitle>
            <CardDescription>Endereço comercial/residencial enviado ao cadastro Asaas. Sem placeholders — use seus dados reais.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-6">
            <div className="md:col-span-2">
              <Label htmlFor="postal_code">CEP</Label>
              <div className="relative">
                <Input
                  id="postal_code"
                  value={postal_code}
                  onChange={(e) => setPostalCode(maskCep(e.target.value))}
                  onBlur={(e) => lookupCep(e.target.value)}
                  placeholder="00000-000"
                  inputMode="numeric"
                />
                {cepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="md:col-span-4">
              <Label htmlFor="address">Endereço (rua/avenida)</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="address_number">Número</Label>
              <Input id="address_number" value={address_number} onChange={(e) => setAddressNumber(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address_complement">Complemento</Label>
              <Input id="address_complement" value={address_complement} onChange={(e) => setAddressComplement(e.target.value)} placeholder="Apto, sala, etc." />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="province">Bairro</Label>
              <Input id="province" value={province} onChange={(e) => setProvince(e.target.value)} />
            </div>
            <div className="md:col-span-4">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="state">UF</Label>
              <Input id="state" value={stateUf} maxLength={2} onChange={(e) => setStateUf(e.target.value.toUpperCase())} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chave PIX para repasses</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Tipo de chave PIX</Label>
              <Select value={pix_key_type || "none"} onValueChange={(v) => setPixKeyType(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Aleatória (EVP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pix_key">Chave PIX</Label>
              <Input id="pix_key" value={pix_key} onChange={(e) => setPixKey(e.target.value)} placeholder="Sua chave PIX" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      </form>

      <ChangePasswordCard />

    </div>
  );
}
