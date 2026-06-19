import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstallPwaButtonProps {
  /** When true, renders as floating button above mobile bottom nav (default). When false, renders inline. */
  floating?: boolean;
  /** Extra offset from bottom (px). Useful when there's a mobile bottom navigation bar. */
  bottomOffset?: number;
}

const DISMISSED_KEY = "nexo-pwa-install-dismissed";

export function InstallPwaButton({ floating = true, bottomOffset = 80 }: InstallPwaButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      localStorage.setItem(DISMISSED_KEY, "1");
      setDeferredPrompt(null);
      setIsVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!isVisible) return null;

  const handleInstall = async () => {
    // Hide immediately so the button disappears from the corner on click
    setIsVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      /* ignore */
    }
    setDeferredPrompt(null);
  };

  if (!floating) {
    return (
      <button
        onClick={handleInstall}
        className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-muted"
        aria-label="Instalar aplicativo"
        title="Instalar aplicativo"
      >
        <Download className="size-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleInstall}
      style={{ bottom: `${bottomOffset}px` }}
      className={cn(
        "fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground",
        "px-4 py-2.5 text-sm font-medium shadow-lg shadow-primary/30",
        "hover:opacity-90 active:scale-95 transition",
      )}
      aria-label="Instalar aplicativo"
    >
      <Download className="size-4" />
      Instalar app
    </button>
  );
}
