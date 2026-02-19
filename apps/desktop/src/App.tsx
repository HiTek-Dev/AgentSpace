import { useState } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ChatPage } from './pages/ChatPage';
import { AgentsPage } from './pages/AgentsPage';
import { SettingsPage } from './pages/SettingsPage';

export type Page = 'dashboard' | 'chat' | 'agents' | 'settings';

const pages: Record<Page, () => JSX.Element> = {
  dashboard: DashboardPage,
  chat: ChatPage,
  agents: AgentsPage,
  settings: SettingsPage,
};

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const ActivePage = pages[currentPage];

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      <ActivePage />
    </Layout>
  );
}
