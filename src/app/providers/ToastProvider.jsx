import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
const DEFAULT_DURATION = 4000;

const TOAST_STYLE_BY_TYPE = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800'
};

function createToastId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ type = 'info', message, duration = DEFAULT_DURATION, title }) => {
      if (!message) {
        return;
      }

      const id = createToastId();
      const toast = {
        id,
        type,
        message,
        title: title ?? null
      };

      setToasts((current) => [...current, toast]);

      if (duration > 0) {
        window.setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  const contextValue = useMemo(
    () => ({
      pushToast,
      success: (message, options = {}) =>
        pushToast({ ...options, message, type: 'success' }),
      error: (message, options = {}) => pushToast({ ...options, message, type: 'error' }),
      info: (message, options = {}) => pushToast({ ...options, message, type: 'info' }),
      warning: (message, options = {}) =>
        pushToast({ ...options, message, type: 'warning' }),
      dismiss: dismissToast
    }),
    [dismissToast, pushToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-card ${TOAST_STYLE_BY_TYPE[toast.type] ?? TOAST_STYLE_BY_TYPE.info}`}
            role="status"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                {toast.title ? <p className="text-xs font-semibold uppercase">{toast.title}</p> : null}
                <p>{toast.message}</p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold opacity-70 transition hover:opacity-100"
                onClick={() => dismissToast(toast.id)}
              >
                Dismiss
              </button>
            </div>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return context;
}
