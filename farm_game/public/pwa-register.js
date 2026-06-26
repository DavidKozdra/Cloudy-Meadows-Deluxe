/*
 * Registers the service worker so Cloudy Meadows works offline and is
 * installable. Kept tiny and dependency-free; runs after load so it never
 * competes with the game's own startup for bandwidth.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('sw.js')
      .then(function (registration) {
        // When a new worker has installed and there's already a controller,
        // an update is ready. Activate it immediately so the next load is fresh.
        registration.addEventListener('updatefound', function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              installing.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch(function (err) {
        console.warn('Service worker registration failed:', err);
      });

    // Reload once when the active worker changes, so an updated app shell is
    // applied without the player having to manually refresh twice.
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
})();
