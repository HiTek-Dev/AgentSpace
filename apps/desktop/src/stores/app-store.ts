import { create } from 'zustand';
import type { RuntimeInfo } from '../lib/discovery';
import type { Page } from '../App';
import type { Session } from '../hooks/useSessions';

export interface GatewayState {
  status: 'unknown' | 'running' | 'stopped';
  port: number | null;
  pid: number | null;
  startedAt: string | null;
}

interface AppState {
  gateway: GatewayState;
  setGateway: (info: RuntimeInfo | null) => void;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  resumeSessionId: string | null;
  setResumeSessionId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  gateway: {
    status: 'unknown',
    port: null,
    pid: null,
    startedAt: null,
  },

  setGateway: (info: RuntimeInfo | null) =>
    set({
      gateway: info
        ? {
            status: 'running',
            port: info.port,
            pid: info.pid,
            startedAt: info.startedAt,
          }
        : {
            status: 'stopped',
            port: null,
            pid: null,
            startedAt: null,
          },
    }),

  currentPage: 'dashboard',
  setCurrentPage: (page: Page) => set({ currentPage: page }),

  selectedAgentId: null,
  setSelectedAgentId: (id: string | null) => set({ selectedAgentId: id }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  sessions: [],
  setSessions: (sessions: Session[]) => set({ sessions }),

  resumeSessionId: null,
  setResumeSessionId: (id: string | null) => set({ resumeSessionId: id }),
}));
