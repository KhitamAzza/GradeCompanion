import { useRegisterSW } from 'virtual:pwa-register/react';
import { X, RefreshCw } from 'lucide-react';

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <>
      {(offlineReady || needRefresh) && (
        <div className="fixed bottom-4 right-4 z-[70] flex items-center gap-3 rounded-lg border border-line bg-card p-3 shadow-lg">
          <div className="text-sm">
            {offlineReady ? (
              <span>App ready to work offline</span>
            ) : (
              <span>New content available, click on reload button to update.</span>
            )}
          </div>
          {needRefresh && (
            <button
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
              onClick={() => updateServiceWorker(true)}
            >
              <RefreshCw size={14} />
              Reload
            </button>
          )}
          <button
            onClick={close}
            className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted hover:bg-muted"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}

export default ReloadPrompt;