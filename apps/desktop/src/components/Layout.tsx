import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { GatewayStatus } from "@/components/GatewayStatus";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const gateway = useAppStore((s) => s.gateway);
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header bar */}
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {currentView === "chat" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCurrentView("landing")}
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Tek
          </span>
        </div>
        <GatewayStatus
          status={gateway.status}
          port={gateway.port}
          compact
        />
      </header>

      <Separator />

      {/* Content area */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
