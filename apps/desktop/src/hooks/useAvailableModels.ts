import { useState, useCallback, useEffect } from "react";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import {
  createVaultKeysList,
  createProviderModelsList,
  type VaultKeysListResult,
  type ProviderModelsListResult,
} from "@/lib/gateway-client";

export interface ModelOption {
  value: string; // provider:modelId (e.g. "anthropic:claude-sonnet-4-20250514")
  label: string; // provider/display name (e.g. "anthropic/Claude Sonnet 4")
  provider: string; // provider key
  modelId: string; // raw model ID
  tier?: string; // high/standard/budget
}

const SERVICE_KEYS = ["telegram", "brave", "tavily"];

export function useAvailableModels() {
  const { request, connected } = useGatewayRpc();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchModels = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      // Get configured providers
      const listResult = await request<VaultKeysListResult>(
        createVaultKeysList(),
      );
      if (
        listResult.type !== "vault.keys.list.result" ||
        !listResult.providers
      ) {
        setModels([]);
        return;
      }

      const configured = listResult.providers.filter(
        (p) => p.configured && !SERVICE_KEYS.includes(p.provider),
      );

      const allModels: ModelOption[] = [];

      for (const prov of configured) {
        try {
          const result = await request<ProviderModelsListResult>(
            createProviderModelsList(prov.provider),
          );
          if (result.type === "provider.models.list.result" && result.models) {
            for (const m of result.models) {
              allModels.push({
                value: `${prov.provider}:${m.modelId}`,
                label: `${prov.provider}/${m.name}`,
                provider: prov.provider,
                modelId: m.modelId,
                tier: m.tier,
              });
            }
          }
        } catch {
          // Skip provider on error
        }
      }

      setModels(allModels);
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { models, loading, refetch: fetchModels };
}
