import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from './cn';

interface ToastApi {
  show: (message: string, tone?: 'info' | 'error') => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DURATION_MS = 3200;

/** La conferma dell'app ("Attività aggiunta"): una pillola in basso, che sparisce da sola. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'info' | 'error' } | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    counter.current += 1;
    setToast({ id: counter.current, message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4 lg:bottom-8"
      >
        {toast ? (
          <div
            key={toast.id}
            className={cn(
              'animate-rise rounded-chip border bg-ink-900/95 px-5 py-3 text-[13.5px] font-bold shadow-card backdrop-blur',
              toast.tone === 'error' ? 'border-danger/50 text-danger' : 'border-ink-700 text-bone',
            )}
          >
            {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast va usato dentro <ToastProvider />');
  return toast;
}
