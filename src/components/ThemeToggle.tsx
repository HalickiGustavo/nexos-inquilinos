import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ size = "icon", variant = "ghost", className }: { size?: "icon" | "sm"; variant?: "ghost" | "outline", className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Modo claro" : "Modo escuro"}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        size === "sm" ? "h-8 px-3 gap-2 text-xs font-medium" : "h-9 w-9",
        variant === "outline" 
          ? "border border-border bg-background hover:bg-accent" 
          : "bg-muted/60 hover:bg-muted text-foreground",
        className
      )}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full transition-opacity duration-300",
          isDark ? "opacity-100" : "opacity-0",
          "bg-gradient-to-br from-violet-500/20 to-purple-600/10"
        )}
      />
      <span className="relative flex items-center justify-center">
        <Sun
          className={cn(
            "size-4 transition-all duration-300",
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
            "text-amber-500"
          )}
        />
        <Moon
          className={cn(
            "size-4 absolute transition-all duration-300",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
            "text-violet-400"
          )}
        />
      </span>
      {size === "sm" && (
        <span className="relative hidden sm:inline">
          {isDark ? "Claro" : "Escuro"}
        </span>
      )}
    </button>
  );
}
