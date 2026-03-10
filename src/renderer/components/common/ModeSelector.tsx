import { Code2, Map, MessageCircle } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';

const modes = [
  { key: 'code' as const, label: 'Code', icon: Code2 },
  { key: 'plan' as const, label: 'Plan', icon: Map },
  { key: 'ask' as const, label: 'Ask', icon: MessageCircle },
];

export function ModeSelector() {
  const { agentMode, setAgentMode } = useUIStore();

  return (
    <div className="flex items-center rounded-lg border border-border-default bg-surface-2 p-1">
      {modes.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setAgentMode(key)}
          className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
            agentMode === key
              ? 'bg-surface-3 text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
