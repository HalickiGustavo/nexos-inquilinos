import nexoLogoLight from "@/assets/nexo-logo.png.asset.json";
import nexoLogoDark from "@/assets/nexo-logo-dark.png.asset.json";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

interface NexoLogoProps {
  className?: string;
  alt?: string;
}

export function NexoLogo({ className, alt = "Nexo" }: NexoLogoProps) {
  const { theme } = useTheme();
  const src = theme === "dark" ? nexoLogoDark.url : nexoLogoLight.url;
  return <img src={src} alt={alt} className={cn("h-7 w-auto", className)} />;
}
