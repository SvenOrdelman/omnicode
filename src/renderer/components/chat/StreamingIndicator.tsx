import { Avatar } from '../common/Avatar';

export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar role="assistant" />
      <span className="text-sm text-text-secondary">Claude is thinking</span>
      <span className="dot-pulse flex gap-0.5 text-text-muted">
        <span className="inline-block h-1 w-1 rounded-full bg-current" />
        <span className="inline-block h-1 w-1 rounded-full bg-current" />
        <span className="inline-block h-1 w-1 rounded-full bg-current" />
      </span>
    </div>
  );
}
