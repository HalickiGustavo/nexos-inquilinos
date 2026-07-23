import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readClientTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("nexo-theme") as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with "dark" on both server and first client render to avoid hydration mismatch.
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // After hydration, sync with the user's actual preference (localStorage or system).
  useEffect(() => {
    setThemeState(readClientTheme());
    setMounted(true);
  }, []);

  // Follow system preference changes when no explicit choice is stored.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("nexo-theme");
      if (stored !== "light" && stored !== "dark") {
        setThemeState(e.matches ? "dark" : "light");
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    if (mounted) localStorage.setItem("nexo-theme", theme);
  }, [theme, mounted]);

  const toggleTheme = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));
  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
