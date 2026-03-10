import React, { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

export function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const startPos = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

      const onMouseMove = (e: MouseEvent) => {
        const current = direction === 'horizontal' ? e.clientX : e.clientY;
        onResize(current - startPos.current);
        startPos.current = current;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, onResize]
  );

  const isH = direction === 'horizontal';

  return (
    <div
      className={`flex-shrink-0 transition-colors duration-100 ${
        isH
          ? 'w-px cursor-col-resize hover:bg-accent/50'
          : 'h-px cursor-row-resize hover:bg-accent/50'
      } bg-border-subtle`}
      onMouseDown={onMouseDown}
    />
  );
}
