/*
 * Registers the service worker so Cloudy Meadows works offline and is
 * installable. When a new version is ready, it stays waiting until the player
 * chooses to reload, so an update never interrupts a game in progress.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    var updateBanner = document.getElementById('pwa-update-banner');
    var updateButton = document.getElementById('pwa-update-now');
    var laterButton = document.getElementById('pwa-update-later');
    var waitingWorker = null;
    var reloadForUpdate = false;

    function hideUpdate() {
      if (updateBanner) updateBanner.hidden = true;
    }

    function showUpdate(worker) {
      if (!worker || !updateBanner) return;

      waitingWorker = worker;
      updateBanner.hidden = false;
      if (updateButton) updateButton.focus();
    }

    if (laterButton) laterButton.addEventListener('click', hideUpdate);

    if (updateButton) {
      updateButton.addEventListener('click', function () {
        if (!waitingWorker) return;

        reloadForUpdate = true;
        updateButton.disabled = true;
        updateButton.textContent = 'Updating…';
        waitingWorker.postMessage('SKIP_WAITING');
      });
    }

    navigator.serviceWorker
      .register('sw.js')
      .then(function (registration) {
        // A worker may already be waiting if the browser discovered an update
        // before this page was opened.
        if (registration.waiting && navigator.serviceWorker.controller) {
          showUpdate(registration.waiting);
        }

        registration.addEventListener('updatefound', function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              showUpdate(installing);
            }
          });
        });
      })
      .catch(function (err) {
        console.warn('Service worker registration failed:', err);
      });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloadForUpdate) window.location.reload();
    });
  });
})();
