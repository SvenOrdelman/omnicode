import { Code2, Map, MessageCircle } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import type { AgentMode } from '../../../shared/chat-types';

const modes = [
  { key: 'plan' as const, label: 'Plan', icon: Map },
  { key: 'chat' as const, label: 'Chat', icon: MessageCircle },
  { key: 'code' as const, label: 'Code', icon: Code2 },
];

interface ModeSelectorProps {
  onModeChange?: (mode: AgentMode) => void;
}

export function ModeSelector({ onModeChange }: ModeSelectorProps) {
  const { agentMode, setAgentMode } = useUIStore();

  return (
    <div className="flex items-center rounded-lg border border-border-default bg-surface-2 p-0.5">
      {modes.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => {
            setAgentMode(key);
            onModeChange?.(key);
          }}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            agentMode === key
              ? 'bg-surface-3 text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}
