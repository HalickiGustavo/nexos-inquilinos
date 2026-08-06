import { useState, useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, LogOut, ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { NexoLogo } from "@/components/NexoLogo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/useUserRole";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTotalUnread } from "@/lib/chat";

export interface MobileDrawerProps {
  brand: { to: string; subtitle?: string };
  navGroups: {
    label?: string | null;
    items: {
      to: string;
      label: string;
      icon: LucideIcon;
      exact?: boolean;
      tour?: string;
      subItems?: { to: string; label: string }[];
    }[];
  }[];
  alerts?: {
    alerts: any[];
    seeAllHref: string;
  };
  onSignOut?: () => void;
}

export function MobileDrawer({ brand, navGroups, alerts, onSignOut }: MobileDrawerProps) {
  const { user, signOut } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = useTotalUnread();
  const [open, setOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const doSignOut = async () => {
    setOpen(false);
    if (onSignOut) {
      onSignOut();
    } else {
      await signOut();
      navigate({ to: "/login", replace: true });
    }
  };

  // Close sheet on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const roleLabels: Record<string, string> = {
    manager: "Imobiliária",
    landlord: "Proprietário",
    tenant: "Inquilino",
    owner: "Administrador",
  };

  return (
    <div className="md:hidden sticky top-0 z-40 w-full h-14 bg-background/80 backdrop-blur-md border-b border-border px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Menu className="size-6" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] sm:w-[320px] flex flex-col h-full border-r border-border">
            {/* User Profile Info at the top of drawer */}
            <div className="p-6 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-primary/10">
                  <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/5 text-primary">
                    {user?.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate text-foreground">
                    {user?.user_metadata?.full_name || user?.email?.split("@")[0]}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {roleLabels[role || ""] || "Usuário"}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation items */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-hide">
              {navGroups.map((group, gi) => (
                <div key={gi} className="space-y-1">
                  {group.label && (
                    <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      {group.label}
                    </div>
                  )}
                  {group.items.map((item) => {
                    const active = isActive(item.to, item.exact);
                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    const isExpanded = expandedItems[item.label];
                    const Icon = item.icon;

                    return (
                      <div key={item.to} className="space-y-0.5">
                        <div className="flex items-center">
                          <Link
                            to={item.to as any}
                            className={cn(
                              "flex-1 flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 group",
                              active
                                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                                : "text-foreground/80 hover:bg-muted active:bg-muted/80"
                            )}
                            onClick={() => {
                              if (!hasSubItems) setOpen(false);
                            }}
                          >
                            <Icon className={cn("size-5 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.to.includes("/chat") && unread > 0 && (
                              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                                {unread > 9 ? "9+" : unread}
                              </span>
                            )}
                          </Link>
                          {hasSubItems && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleExpand(item.label);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-4 text-muted-foreground" />
                              )}
                            </Button>
                          )}
                        </div>

                        {hasSubItems && isExpanded && (
                          <div className="ml-11 flex flex-col gap-0.5 border-l border-border pl-2 py-1">
                            {item.subItems?.map((sub) => (
                              <Link
                                key={sub.to}
                                to={sub.to as any}
                                className={cn(
                                  "px-3 py-2 rounded-md text-xs transition-colors",
                                  pathname === sub.to
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                                onClick={() => setOpen(false)}
                              >
                                {sub.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Logout button at the bottom */}
            <div className="p-4 border-t border-border mt-auto">
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={doSignOut}
              >
                <LogOut className="size-5 mr-3" />
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        
        <Link to={brand.to as any} className="flex items-center">
          <NexoLogo className="h-8 w-auto" />
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle size="icon" variant="ghost" className="h-10 w-10" />
        <Avatar className="h-8 w-8 ml-2 border border-border">
          <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
          <AvatarFallback className="bg-primary/5 text-primary text-[10px]">
            {user?.email?.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
