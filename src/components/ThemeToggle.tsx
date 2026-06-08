import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ size = "icon", variant = "ghost" }: { size?: "icon" | "sm"; variant?: "ghost" | "outline" }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      title={theme === "dark" ? "Modo claro" : "Modo escuro"}
      className="text-foreground"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {size === "sm" && (
        <span className="ml-2">{theme === "dark" ? "Claro" : "Escuro"}</span>
      )}
    </Button>
  );
}
