import { useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { ConfigSection } from '../components/ConfigSection';

export function SettingsPage() {
  const { config, loading, error, modified, updateField, save, reload } = useConfig();
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasModel, setNewAliasModel] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await save();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addAlias = () => {
    if (!newAliasName.trim() || !newAliasModel.trim()) return;
    const aliases = { ...(config?.modelAliases ?? {}), [newAliasName.trim()]: newAliasModel.trim() };
    updateField('modelAliases', aliases);
    setNewAliasName('');
    setNewAliasModel('');
  };

  const removeAlias = (name: string) => {
    const aliases = { ...(config?.modelAliases ?? {}) };
    delete aliases[name];
    updateField('modelAliases', aliases);
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-5 bg-gray-700 rounded w-1/4 mb-3" />
              <div className="h-4 bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          <p className="font-semibold">Failed to load configuration</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={reload}
            className="mt-3 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const providers = config?.configuredProviders ?? [];
  const aliases: Record<string, string> = (config?.modelAliases && typeof config.modelAliases === 'object' && !Array.isArray(config.modelAliases))
    ? config.modelAliases
    : {};
  const mcpServers = config?.mcpServers ?? {};
  const mcpEntries = Object.entries(mcpServers);

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* General */}
      <ConfigSection title="General" description="Core application settings">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Default Model</label>
            <input
              type="text"
              value={config?.defaultModel ?? ''}
              onChange={(e) => updateField('defaultModel', e.target.value)}
              placeholder="e.g. anthropic:claude-sonnet-4-5-20250514"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Security Mode</label>
            <span className={`inline-block px-2.5 py-1 rounded text-xs font-medium ${
              config?.securityMode === 'limited'
                ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                : 'bg-green-900/50 text-green-300 border border-green-700'
            }`}>
              {config?.securityMode ?? 'full'}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              Change via CLI: <code className="text-gray-400">tek init</code>
            </p>
          </div>
          {config?.securityMode === 'limited' && config?.workspaceDir && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Workspace Directory</label>
              <p className="text-sm text-gray-300 font-mono">{config.workspaceDir}</p>
            </div>
          )}
        </div>
      </ConfigSection>

      {/* Providers */}
      <ConfigSection title="Providers" description="Configured AI model providers">
        {providers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => (
              <span
                key={provider}
                className="px-2.5 py-1 bg-gray-700 rounded text-sm text-gray-200"
              >
                {provider}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No providers configured</p>
        )}
        <p className="text-xs text-gray-500 mt-3">
          API keys are managed securely via the CLI. Run <code className="text-gray-400">tek keys</code> to manage.
        </p>
        {providers.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {providers.length} provider{providers.length !== 1 ? 's' : ''} configured
          </p>
        )}
      </ConfigSection>

      {/* Model Aliases */}
      <ConfigSection title="Model Aliases" description="Shortcuts for model names">
        {Object.keys(aliases).length > 0 ? (
          <div className="space-y-2 mb-4">
            {Object.entries(aliases).map(([name, model]) => (
              <div key={name} className="flex items-center gap-3 bg-gray-900 rounded px-3 py-2">
                <span className="text-sm font-medium text-blue-300 min-w-[80px]">{name}</span>
                <span className="text-gray-500 text-xs">-&gt;</span>
                <span className="text-sm text-gray-300 flex-1 font-mono truncate">{model}</span>
                <button
                  onClick={() => removeAlias(name)}
                  className="text-gray-500 hover:text-red-400 text-sm px-1"
                  title="Remove alias"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">No aliases defined</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newAliasName}
            onChange={(e) => setNewAliasName(e.target.value)}
            placeholder="Alias name"
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 w-32 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            value={newAliasModel}
            onChange={(e) => setNewAliasModel(e.target.value)}
            placeholder="Target model"
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 flex-1 focus:border-blue-500 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && addAlias()}
          />
          <button
            onClick={addAlias}
            disabled={!newAliasName.trim() || !newAliasModel.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Changes apply on save</p>
      </ConfigSection>

      {/* MCP Servers */}
      <ConfigSection title="MCP Servers" description="Model Context Protocol server configurations">
        {mcpEntries.length > 0 ? (
          <div className="space-y-2">
            {mcpEntries.map(([name, server]) => (
              <div key={name} className="bg-gray-900 rounded px-3 py-2">
                <span className="text-sm font-medium text-purple-300">{name}</span>
                <p className="text-xs text-gray-400 font-mono mt-1">
                  {server.command}{server.args?.length ? ` ${server.args.join(' ')}` : ''}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No MCP servers configured</p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          MCP servers are managed via the config file or CLI
        </p>
      </ConfigSection>

      {/* Gateway Info */}
      <ConfigSection title="Gateway Info" description="File paths and connection info">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Config file</span>
            <span className="text-gray-300 font-mono text-xs">~/.config/tek/config.json</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Database</span>
            <span className="text-gray-300 font-mono text-xs">~/.config/tek/tek.db</span>
          </div>
        </div>
      </ConfigSection>

      {/* Footer Actions */}
      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-800">
        <button
          onClick={handleSave}
          disabled={!modified}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            modified
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Save Changes
        </button>
        <button
          onClick={reload}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          Reload
        </button>
        {saved && (
          <span className="text-green-400 text-sm">Changes saved</span>
        )}
        {modified && !saved && (
          <span className="text-yellow-400 text-sm">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
