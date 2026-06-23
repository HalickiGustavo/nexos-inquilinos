import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth";

export interface TourStep {
  /** value of the data-tour attribute to highlight */
  target: string;
  title: string;
  description: string;
}

interface Props {
  /** unique key per role / flow so each tour is shown only once */
  tourKey: string;
  steps: TourStep[];
}

const PADDING = 8;
const BUBBLE_W_MAX = 320;
const BUBBLE_GAP = 14;
function getBubbleWidth() {
  if (typeof window === "undefined") return BUBBLE_W_MAX;
  return Math.min(BUBBLE_W_MAX, window.innerWidth - 32);
}

function storageKey(userId: string | undefined, tourKey: string) {
  return `nexo-tour-done:${tourKey}:${userId ?? "anon"}`;
}

export function OnboardingTour({ tourKey, steps }: Props) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Decide whether to open on first mount per user
  useEffect(() => {
    if (loading || !user) return;
    try {
      const done = localStorage.getItem(storageKey(user.id, tourKey));
      if (!done) {
        // small delay so layout settles
        const t = setTimeout(() => setOpen(true), 400);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore storage errors */
    }
  }, [loading, user, tourKey]);

  // Listen for manual restart events: window.dispatchEvent(new Event(`tour:restart:${tourKey}`))
  useEffect(() => {
    const handler = () => {
      setStepIdx(0);
      setOpen(true);
    };
    window.addEventListener(`tour:restart:${tourKey}`, handler);
    return () => window.removeEventListener(`tour:restart:${tourKey}`, handler);
  }, [tourKey]);

  const current = steps[stepIdx];

  // Measure target element
  useLayoutEffect(() => {
    if (!open || !current) return;
    let raf = 0;
    let didInitialScroll = false;
    const findEl = () => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-tour="${current.target}"]`),
      );
      return (
        candidates.find((c) => {
          const r = c.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }) ?? candidates[0] ?? null
      );
    };
    const measure = () => {
      const el = findEl();
      if (!el) {
        setRect(null);
        return;
      }
      if (!didInitialScroll) {
        didInitialScroll = true;
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      }
      const next = el.getBoundingClientRect();
      setRect((prev) => {
        if (
          prev &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        ) {
          return prev;
        }
        return next;
      });
    };
    measure();
    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    const interval = setInterval(measure, 800); // catch async layout shifts
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      clearInterval(interval);
    };
  }, [open, current]);

  const finish = (skipped: boolean) => {
    try {
      localStorage.setItem(
        storageKey(user?.id, tourKey),
        skipped ? "skipped" : "done",
      );
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  // Bubble position
  const bubbleStyle = useMemo<React.CSSProperties>(() => {
    const BUBBLE_W = getBubbleWidth();
    if (!rect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: BUBBLE_W,
      };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Prefer right side; fallback below; fallback above
    const spaceRight = vw - rect.right;
    const spaceBelow = vh - rect.bottom;
    if (spaceRight > BUBBLE_W + BUBBLE_GAP + 16) {
      const top = Math.min(
        Math.max(rect.top, 12),
        vh - 240,
      );
      return {
        top,
        left: rect.right + BUBBLE_GAP,
        width: BUBBLE_W,
      };
    }
    if (spaceBelow > 200) {
      return {
        top: rect.bottom + BUBBLE_GAP,
        left: Math.min(Math.max(rect.left, 12), Math.max(12, vw - BUBBLE_W - 12)),
        width: BUBBLE_W,
      };
    }
    return {
      top: Math.max(rect.top - 220, 12),
      left: Math.min(Math.max(rect.left, 12), Math.max(12, vw - BUBBLE_W - 12)),
      width: BUBBLE_W,
    };
  }, [rect]);

  if (!open || !current) return null;

  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* Spotlight overlay using inset box-shadow */}
      {rect ? (
        <div
          className="fixed pointer-events-none transition-all duration-200 rounded-lg"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
            outline: "2px solid hsl(var(--primary))",
            outlineOffset: 0,
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/65" />
      )}

      {/* Click catcher to prevent interaction with underlying UI */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Bubble */}
      <div
        className="fixed bg-card text-card-foreground border border-border rounded-xl shadow-xl p-4 z-[101]"
        style={bubbleStyle}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="text-xs text-muted-foreground">
              Passo {stepIdx + 1} de {steps.length}
            </div>
            <h3 className="text-base font-semibold mt-0.5">{current.title}</h3>
          </div>
          <button
            onClick={() => finish(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar tutorial"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {current.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => finish(true)}
          >
            Pular tutorial
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isFirst}
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            >
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (isLast) finish(false);
                else setStepIdx((i) => i + 1);
              }}
            >
              {isLast ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
