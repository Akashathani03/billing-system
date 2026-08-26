import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Wraps vite-plugin-pwa's registration API (registerType: 'prompt' in
 * vite.config.js). A waiting service worker never activates on its own —
 * onNeedRefresh only flips a flag; applyUpdate() is the one and only path
 * that actually swaps it in, and it's only ever called from an explicit
 * button tap (see UpdateBanner). No invoice entry should ever be
 * interrupted by an update the user didn't ask for.
 */
export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSWRef = useRef(null);

  useEffect(() => {
    updateSWRef.current = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisterError(error) {
        console.error('[pwa] service worker registration failed:', error);
      },
    });
  }, []);

  function applyUpdate() {
    updateSWRef.current?.(true);
  }

  return { needRefresh, applyUpdate };
}
