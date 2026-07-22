import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PHONE = "5541997234401";
const MESSAGE = "Olá! Preciso de ajuda com a Nexo.";
const STORAGE_KEY = "nexo:support-wpp:seen";

export interface SupportWhatsAppButtonProps {
  /** Distance from bottom in px (to avoid overlap with PWA install / mobile nav). */
  bottomOffset?: number;
}

export function SupportWhatsAppButton({ bottomOffset = 24 }: SupportWhatsAppButtonProps) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setShowHint(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, []);

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  const href = `https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <div
      className="fixed right-4 z-50 flex flex-col items-end gap-2"
      style={{ bottom: bottomOffset }}
    >
      {showHint && (
        <div className="relative max-w-[16rem] rounded-xl bg-card border border-border shadow-lg p-3 pr-8 text-sm animate-in fade-in slide-in-from-bottom-2">
          <button
            type="button"
            onClick={dismissHint}
            aria-label="Fechar"
            className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground rounded-md p-1"
          >
            <X className="size-3.5" />
          </button>
          <p className="font-semibold text-foreground leading-tight">Precisa de ajuda?</p>
          <p className="text-muted-foreground text-xs mt-1 leading-snug">
            Fale com o suporte da Nexo direto pelo WhatsApp. Estamos aqui para te ajudar.
          </p>
        </div>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismissHint}
        aria-label="Falar com o suporte da Nexo no WhatsApp"
        className={cn(
          "flex items-center justify-center size-14 rounded-full shadow-lg transition-transform hover:scale-105",
          "bg-[#25D366] text-white hover:bg-[#1ebe57] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366]",
        )}
      >
        <MessageCircle className="size-7" strokeWidth={2.2} />
      </a>
    </div>
  );
}
