import type { Page } from '../App';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '\u2302' },
  { page: 'chat', label: 'Chat', icon: '\u2709' },
  { page: 'agents', label: 'Agents', icon: '\u2663' },
  { page: 'settings', label: 'Settings', icon: '\u2699' },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-56 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
      <div className="p-4 border-b border-[#2a2a2a]">
        <h1 className="text-xl font-bold text-white tracking-tight">Tek</h1>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map(({ page, label, icon }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentPage === page
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#252525]'
            }`}
          >
            <span className="text-lg">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
