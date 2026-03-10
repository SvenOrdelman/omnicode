import { User, Bot } from 'lucide-react';

interface AvatarProps {
  role: 'user' | 'assistant';
}

export function Avatar({ role }: AvatarProps) {
  const isUser = role === 'user';
  return (
    <div
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${
        isUser
          ? 'bg-accent/18 text-accent ring-accent/35'
          : 'bg-surface-2 text-text-secondary ring-border-default/70'
      }`}
    >
      {isUser ? <User size={15} /> : <Bot size={15} />}
    </div>
  );
}
