import type { FallbackProps } from 'react-error-boundary';

export function PageErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="text-4xl text-red-400">!</div>
      <h2 className="text-xl font-semibold text-red-400">Something went wrong</h2>
      <pre className="max-w-md overflow-auto whitespace-pre-wrap text-sm text-gray-400">
        {error.message}
      </pre>
      <button
        onClick={resetErrorBoundary}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>
  );
}
