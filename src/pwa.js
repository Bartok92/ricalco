// Service worker: funzionamento offline e aggiornamento automatico.
// La nuova versione si scarica da sola; la pagina si ricarica solo quando non
// disturba (schermata iniziale), altrimenti al prossimo avvio.

export function registerServiceWorker(onUpdateReady) {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) onUpdateReady();
  });

  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, 60 * 60 * 1000);
    })
    .catch(() => {});
}
