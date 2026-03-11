import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../common/Avatar';

interface StreamingIndicatorProps {
  activityLines: string[];
}

export function StreamingIndicator({ activityLines }: StreamingIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const latestLine = useMemo(() => activityLines[activityLines.length - 1] ?? null, [activityLines]);

  useEffect(() => {
    if (activityLines.length <= 1) {
      setExpanded(false);
    }
  }, [activityLines.length]);

  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <Avatar role="assistant" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Thinking...</span>
          <span className="dot-pulse flex flex-shrink-0 gap-0.5 text-text-muted">
            <span className="inline-block h-1 w-1 rounded-full bg-current" />
            <span className="inline-block h-1 w-1 rounded-full bg-current" />
            <span className="inline-block h-1 w-1 rounded-full bg-current" />
          </span>
          {activityLines.length > 1 && (
            <button
              onClick={() => setExpanded((prev) => !prev)}
              className="ml-auto flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text-secondary transition-colors"
            >
              {expanded ? 'Hide activity' : 'Show activity'}
            </button>
          )}
        </div>

        {latestLine && (
          <div className="mt-0.5 truncate text-[11px] text-text-muted">{latestLine}</div>
        )}

        {expanded && activityLines.length > 1 && (
          <div className="mt-1.5 space-y-1 rounded-md border border-border-subtle bg-surface-1/70 px-2 py-1.5">
            {activityLines.map((line, index) => (
              <div key={`${index}-${line}`} className="truncate text-[11px] text-text-muted">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
