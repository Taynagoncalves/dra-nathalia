import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Base visual compartilhada por input, select e textarea. */
export const controlClass = cn(
  'w-full rounded-lg border border-border bg-bg px-3 text-sm text-text',
  'placeholder:text-text-muted',
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-[invalid=true]:border-error aria-[invalid=true]:focus:ring-error/30',
);

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(controlClass, 'h-10', className)} {...props} />;
}

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(controlClass, 'min-h-24 py-2', className)} {...props} />;
}

export function Select({
  className,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select ref={ref} className={cn(controlClass, 'h-10 pr-8', className)} {...props} />;
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  /** recebe o id gerado para ligar label ↔ campo */
  children: (id: string, describedBy?: string) => ReactNode;
}

/** Rótulo + campo + mensagem de erro/ajuda, já acessível. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
      </label>
      {children(id, error || hint ? msgId : undefined)}
      {error ? (
        <p id={msgId} className="text-xs text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
