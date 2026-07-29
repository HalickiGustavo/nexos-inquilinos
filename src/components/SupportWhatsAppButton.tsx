import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const PHONE = "5541997234401";
const MESSAGE = "Olá! Preciso de ajuda com a Nexo.";

export interface SupportWhatsAppButtonProps {
  /** Distance from bottom in px (to avoid overlap with PWA install / mobile nav). */
  bottomOffset?: number;
}

export function SupportWhatsAppButton({ bottomOffset = 24 }: SupportWhatsAppButtonProps) {
  const href = `https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <div className="fixed right-4 z-50 group" style={{ bottom: bottomOffset }}>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100"
      >
        Suporte NEXO
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Suporte NEXO no WhatsApp"
        title="Suporte NEXO"
        className={cn(
          "flex items-center justify-center size-11 rounded-full border border-border/60 shadow-sm transition-all",
          "bg-card/90 backdrop-blur text-muted-foreground hover:text-foreground hover:shadow-md",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <MessageCircle className="size-5" strokeWidth={2} />
      </a>
    </div>
  );
}
