import { type TextareaHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ label, className, ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</label>}
      <textarea
        ref={ref}
        className={clsx(
          'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors resize-none',
          className
        )}
        {...props}
      />
    </div>
  );
});

TextArea.displayName = 'TextArea';
