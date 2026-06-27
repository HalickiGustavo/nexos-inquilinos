import * as React from "react";
import { AlertTriangle, Trash2, Info, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type ConfirmTone = "destructive" | "warning" | "info";

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Texto que o usuário precisa digitar exatamente para liberar o botão. */
  requireText?: string;
};

type ConfirmContextValue = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

type State = (ConfirmOptions & { resolve: (v: boolean) => void }) | null;

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>(null);
  const [typed, setTyped] = React.useState("");

  const confirm = React.useCallback<ConfirmContextValue>((opts) => {
    setTyped("");
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
    setTyped("");
  };

  const tone: ConfirmTone = state?.tone ?? "destructive";
  const toneStyles = {
    destructive: {
      ring: "ring-destructive/30",
      iconBg: "bg-destructive/10 text-destructive",
      action:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40",
      Icon: Trash2,
    },
    warning: {
      ring: "ring-amber-500/30",
      iconBg: "bg-amber-500/10 text-amber-500",
      action:
        "bg-amber-500 text-white hover:bg-amber-500/90 focus-visible:ring-amber-500/40",
      Icon: AlertTriangle,
    },
    info: {
      ring: "ring-primary/30",
      iconBg: "bg-primary/10 text-primary",
      action: "",
      Icon: Info,
    },
  }[tone];

  const Icon = toneStyles.Icon;
  const needsType = !!state?.requireText;
  const disabled = needsType && typed.trim() !== state!.requireText!.trim();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={!!state}
        onOpenChange={(o) => {
          if (!o) close(false);
        }}
      >
        <AlertDialogContent
          className={cn(
            "border-border/60 bg-background/95 backdrop-blur ring-1",
            toneStyles.ring,
          )}
        >
          <AlertDialogHeader>
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full",
                  toneStyles.iconBg,
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="space-y-1.5 text-left">
                <AlertDialogTitle className="text-base leading-tight">
                  {state?.title}
                </AlertDialogTitle>
                {state?.description && (
                  <AlertDialogDescription asChild>
                    <div className="text-sm text-muted-foreground whitespace-pre-line">
                      {state.description}
                    </div>
                  </AlertDialogDescription>
                )}
              </div>
            </div>

            {needsType && (
              <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldAlert className="size-3.5" />
                  Para confirmar, digite{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {state!.requireText}
                  </span>
                </p>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {state?.cancelLabel ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={disabled}
              className={cn(toneStyles.action, disabled && "opacity-50")}
              onClick={(e) => {
                if (disabled) {
                  e.preventDefault();
                  return;
                }
                close(true);
              }}
            >
              {state?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    // Fallback seguro caso o provider não esteja montado (SSR / testes isolados).
    return async (opts) =>
      typeof window !== "undefined" ? window.confirm(opts.title) : false;
  }
  return ctx;
}
