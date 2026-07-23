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
  // Default to "light" on both server and first client render to avoid hydration mismatch.
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // After hydration, sync with the user's stored preference (defaults to light).
  useEffect(() => {
    setThemeState(readClientTheme());
    setMounted(true);
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
