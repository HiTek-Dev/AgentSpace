import type { ReactNode } from 'react';

interface ConfigSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function ConfigSection({ title, description, children }: ConfigSectionProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
      {description && (
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}
