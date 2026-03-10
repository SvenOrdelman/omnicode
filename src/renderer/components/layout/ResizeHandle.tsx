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
      className={`group relative z-10 flex-shrink-0 transition-colors duration-100 ${
        isH
          ? 'w-2 cursor-col-resize'
          : 'h-2 cursor-row-resize'
      }`}
      onMouseDown={onMouseDown}
    >
      <div
        className={`absolute bg-border-subtle transition-colors group-hover:bg-accent/70 ${
          isH ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2'
        }`}
      />
    </div>
  );
}
