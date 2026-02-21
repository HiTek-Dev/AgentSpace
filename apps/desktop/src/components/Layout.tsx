import type { ReactNode } from 'react';
import type { Page } from '../App';
import { Sidebar } from './Sidebar';
import { useAppStore } from '../stores/app-store';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}

export function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const sessions = useAppStore((s) => s.sessions);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const setResumeSessionId = useAppStore((s) => s.setResumeSessionId);

  const handleSelectSession = (sessionId: string) => {
    setResumeSessionId(sessionId);
    setCurrentPage('chat');
  };

  return (
    <div className="flex h-full">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        sessions={sessions}
        onSelectSession={handleSelectSession}
      />
      <main key={currentPage} className="flex-1 overflow-y-auto animate-fade-in">
        {children}
      </main>
    </div>
  );
}
