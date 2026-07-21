/*
 * Service worker for Cloudy Meadows: Deluxe Edition.
 *
 * Strategy:
 *   - Precache the "app shell" (HTML, scripts, styles, font, manifest, icons,
 *     dialogue JSON) so the game can boot with no network.
 *   - Everything else (the ~400 sprite images, audio, the p5.js CDN, Google
 *     Fonts) is cached on first use with a cache-first strategy. After a single
 *     online play session the whole game is available offline, without having
 *     to hand-maintain a list of every asset.
 *
 * Bump CACHE_VERSION whenever the app shell changes so clients pick up the new
 * files instead of serving stale ones forever.
 */

const CACHE_VERSION = 'v40';
const SHELL_CACHE = `cloudy-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `cloudy-runtime-${CACHE_VERSION}`;

// Core files needed for the game to start. Query strings are kept so the
// requests match what index.html actually asks for.
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=2',
  './manifest.webmanifest',
  './localDataStorage-3.0.0.min.js',
  './i18n.js?v=1',
  './i18n/es.json',
  './i18n/fr.json',
  './i18n/de.json',
  './i18n/pt.json',
  './i18n/ja.json',
  './pwa-register.js',
  './loading.js?v=1',
  './dialouge_list.json',
  './pixelFont.ttf',
  // The loading screen's own art. Unlike the other ~400 sprites it can't wait
  // for the runtime cache, since it has to render before the game boots.
  './images/ui/Title_Screen.gif',
  './images/player/Side_Move.png',
  './images/player/SideMove2.png',
  './classes/Sound.js',
  './classes/Cloud.js',
  './classes/item.js?v=11',
  './classes/level.js?v=12',
  './classes/quest.js?v=8',
  './classes/dialouge.js?v=8',
  './classes/tile_classes/tile.js?v=8',
  './classes/tile_classes/plant.js?v=8',
  './classes/tile_classes/entity.js?v=8',
  './classes/tile_classes/moveable-entity.js?v=8',
  './classes/tile_classes/player.js?v=12',
  './classes/tile_classes/grid-move-entity.js?v=8',
  './classes/tile_classes/free-move-entity.js?v=8',
  './classes/tile_classes/light-move-entity.js?v=8',
  './classes/tile_classes/pay-to-move-entity.js?v=8',
  './classes/tile_classes/npc.js?v=8',
  './classes/tile_classes/shop.js?v=9',
  './classes/tile_classes/chest.js?v=8',
  './classes/tile_classes/robot.js?v=8',
  './classes/tile_classes/farm-robot.js?v=8',
  './classes/tile_classes/air_ballon.js?v=8',
  './classes/cooperative-exchange.js?v=8',
  './classes/time-rewind.js?v=1',
  './config/constants.js?v=8',
  './config/items.js?v=9',
  './config/tiles.js?v=10',
  './classes/raycaster3d.js?v=18',
  './classes/ui/display.js?v=1',
  './classes/weather-system.js?v=1',
  './miscfunctions.js?v=11',
  './preload.js?v=14',
  './gamepad.js?v=8',
  './sketch.js?v=14',
  './images/pwa/icon-192.png',
  './images/pwa/icon-512.png',
  './images/pwa/icon-maskable-512.png',
  './images/pwa/apple-touch-icon.png',
  './images/pwa/favicon-32.png',
];

// Install: precache the app shell. addAll is atomic — if any file 404s the whole
// install fails, so missing-file mistakes surface loudly during development.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete caches from older versions, then take control of open pages.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Allow the page to tell a waiting worker to activate immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET requests are cacheable; let everything else hit the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // For top-level navigations, try the network first so deployed updates show
  // up promptly, but fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Everything else: cache-first, then network, then store the result. Works for
  // same-origin assets and cross-origin CDN requests (which come back as opaque
  // responses — still fine to cache and replay).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Don't cache error responses (but do cache opaque cross-origin ones,
          // whose status reads as 0).
          if (!response || (response.status !== 200 && response.type !== 'opaque')) {
            return response;
          }
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
