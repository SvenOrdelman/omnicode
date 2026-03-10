import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
}

export function SidebarSection({ title, children, action, defaultOpen = true }: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${open ? '' : '-rotate-90'}`}
          />
          {title}
        </button>
        {action}
      </div>
      {open && children}
    </div>
  );
}
