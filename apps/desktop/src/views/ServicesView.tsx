import { useState } from "react";
import { ArrowLeft, MessageSquare, Search } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TelegramSetup } from "@/components/services/TelegramSetup";
import { BraveSetup } from "@/components/services/BraveSetup";

type ServiceKey = "telegram" | "brave";

interface ServiceInfo {
  key: ServiceKey;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const services: ServiceInfo[] = [
  {
    key: "telegram",
    name: "Telegram",
    description: "Chat interface via Telegram bot with user approval flow",
    icon: MessageSquare,
    category: "Messaging",
  },
  {
    key: "brave",
    name: "Brave Search",
    description: "Web search capabilities powered by Brave Search API",
    icon: Search,
    category: "Search",
  },
];

const SERVICE_LABELS: Record<ServiceKey, string> = {
  telegram: "Telegram Setup",
  brave: "Brave Search Setup",
};

export function ServicesView() {
  const [selectedService, setSelectedService] = useState<ServiceKey | null>(
    null,
  );

  return selectedService ? (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <button
        onClick={() => setSelectedService(null)}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Services
      </button>
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        {SERVICE_LABELS[selectedService]}
      </h2>
      {selectedService === "telegram" ? <TelegramSetup /> : <BraveSetup />}
    </div>
  ) : (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Services</h2>
        <p className="text-sm text-muted-foreground">
          Configure integrations and external service connections.
        </p>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {services.map((service) => {
          const Icon = service.icon;

          return (
            <Card
              key={service.key}
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => setSelectedService(service.key)}
            >
              <CardHeader className="flex-row items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{service.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {service.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {service.description}
                  </p>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
