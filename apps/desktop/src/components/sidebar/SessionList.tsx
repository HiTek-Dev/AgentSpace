import type { Session } from '../../hooks/useSessions';
import { Skeleton } from '../ui/Skeleton';
import { Badge } from '../ui/Badge';

interface SessionListProps {
  sessions: Session[];
  loading: boolean;
  collapsed: boolean;
  onSelectSession: (sessionId: string) => void;
  onRefresh?: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function SessionList({ sessions, loading, collapsed, onSelectSession, onRefresh }: SessionListProps) {
  if (collapsed) return null;

  return (
    <div className="flex flex-col px-2 py-2">
      {/* Section header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Recent Sessions
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-text-muted hover:text-text-secondary transition-colors"
            title="Refresh sessions"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-2 px-1">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <p className="text-xs text-text-muted px-2 py-2">No sessions yet</p>
      )}

      {/* Session list */}
      {!loading && sessions.length > 0 && (
        <div className="space-y-0.5">
          {[...sessions]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 10)
            .map((session) => (
              <button
                key={session.sessionId}
                onClick={() => onSelectSession(session.sessionId)}
                className="w-full text-left px-2 py-2 rounded-lg hover:bg-surface-elevated transition-colors group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-text-primary truncate max-w-[120px]">
                    {session.sessionKey || session.sessionId.slice(0, 20)}
                  </span>
                  <Badge>{session.messageCount}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted truncate max-w-[100px]">
                    {session.model}
                  </span>
                  <span className="text-xs text-text-muted">
                    {timeAgo(session.createdAt)}
                  </span>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
