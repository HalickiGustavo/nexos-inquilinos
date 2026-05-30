export const formatBRL = (value: number | string | null | undefined) => {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(n) ? (n as number) : 0);
};

export const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  // Use UTC parts for plain dates (YYYY-MM-DD) to avoid timezone shift
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, day] = value.split("-");
    return `${day}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat("pt-BR").format(d);
};

export const parseNumber = (v: string) => {
  if (!v) return 0;
  const cleaned = v.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

export const today = () => new Date().toISOString().slice(0, 10);

export const monthRange = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1).toISOString().slice(0, 10);
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { start, end };
};
