import { useCallback, useEffect, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { LandingView } from "@/views/LandingView";
import { ChatView } from "@/views/ChatView";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-8">
      <h2 className="text-xl font-semibold text-destructive-foreground">
        Something went wrong
      </h2>
      <pre className="max-w-lg overflow-auto rounded-md bg-muted p-4 text-sm text-muted-foreground">
        {message}
      </pre>
      <Button variant="outline" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}

export function App() {
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const setSessionId = useAppStore((s) => s.setSessionId);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Cmd+N (Mac) / Ctrl+N: new chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        // Clear session, switch to chat view
        setSessionId(null);
        setCurrentView("chat");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSessionId, setCurrentView]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Layout sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar}>
        {currentView === "landing" ? (
          <LandingView />
        ) : (
          <ChatView sidebarOpen={sidebarOpen} />
        )}
      </Layout>
    </ErrorBoundary>
  );
}
