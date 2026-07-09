/*
 * Boot loading screen.
 *
 * The game spends its startup inside p5's blocking preload(), pulling ~390
 * sprites off the network before a single frame is drawn. This script covers
 * that gap with a logo, a walking farmer and a progress bar.
 *
 * Progress is measured, not faked: loadImage/loadFont are wrapped so every
 * asset reports back when it settles. The denominator isn't known up front
 * (preload() is still queuing requests while the early ones resolve), so the
 * bar shows completed/queued, which only ever moves forward. That ratio is
 * then eased toward in the animation loop so the bar glides instead of jumping.
 *
 * Loads before p5's preload() runs, so it must not touch p5 globals at parse
 * time beyond the two functions it wraps.
 */
(function () {
  var queued = 0;
  var settled = 0;
  var finished = false;

  /*
   * p5 signature: loadImage(path, successCallback, failureCallback).
   * preload() calls these with the path only, but pass through anything the
   * caller supplied rather than assuming that stays true.
   *
   * Injecting a successCallback is safe: p5 calls it and then decrements its
   * own preload counter regardless, so setup() still waits for every asset.
   * Injecting a failureCallback is not free — p5 logs the load error only when
   * no failureCallback was given, so ours has to log in its place.
   */
  function track(name) {
    var original = window[name];
    if (typeof original !== 'function') return;

    window[name] = function (path, success, failure) {
      queued++;
      var counted = false;
      // Count each asset exactly once, whichever way it settles.
      function settle(cb, isFailure) {
        return function (arg) {
          if (!counted) {
            counted = true;
            settled++;
          }
          if (typeof cb === 'function') {
            cb(arg);
          } else if (isFailure) {
            // Stand in for the console.error p5 would have emitted.
            console.error('Failed to load ' + path, arg);
          }
        };
      }
      return original.call(this, path, settle(success, false), settle(failure, true));
    };
  }

  // Wrap at parse time: this script sits between p5 and preload.js, which is
  // the only window where the functions exist but haven't been called yet.
  // Needs no DOM, so it must not wait for DOMContentLoaded.
  track('loadImage');
  track('loadFont');

  function startUI() {
    var root = document.getElementById('boot-loader');
    if (!root) return;

    var bar = document.getElementById('boot-loader-bar');
    var farmer = document.getElementById('boot-loader-farmer');
    var pct = document.getElementById('boot-loader-pct');

    // Eased position vs. where it's heading; both 0..1.
    var shown = 0;
    var target = 0;

    // Held short of full until the first frame renders, otherwise the bar reads
    // as "done" while the game is still building several hundred DOM nodes.
    var CEILING = 0.97;

    function tick() {
      if (queued > 0) target = Math.min(settled / queued, CEILING);
      if (finished) target = 1;

      // Ease toward the target; the constant is a feel value, not a rate.
      shown += (target - shown) * 0.12;
      if (finished && 1 - shown < 0.001) shown = 1;

      var percent = Math.round(shown * 100);
      bar.style.width = percent + '%';
      // The farmer rides the leading edge of the fill, pulled back by half his
      // width so he stands on it rather than ahead of it.
      farmer.style.left = 'calc(' + percent + '% - 16px)';
      pct.textContent = percent + '%';

      if (finished && shown === 1) {
        root.classList.add('boot-loader-done');
        // Outlast the CSS fade before removing, so the game isn't rendering
        // behind a still-opaque overlay.
        setTimeout(function () {
          root.remove();
        }, 600);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startUI);
  } else {
    startUI();
  }

  /*
   * The honest "game is up" signal is the first rendered frame, not the end of
   * setup() — setup() still has hundreds of lines of DOM building left after
   * the canvas exists. Hook draw() on its first call, then restore it.
   *
   * Read window.draw on 'load', not at parse time: sketch.js defines it after
   * this script runs.
   */
  window.addEventListener('load', function () {
    var originalDraw = window.draw;
    if (typeof originalDraw !== 'function') {
      // No draw() to hook: don't strand the player behind the overlay.
      finished = true;
      return;
    }
    window.draw = function () {
      var result = originalDraw.apply(this, arguments);
      finished = true;
      window.draw = originalDraw;
      return result;
    };
  });

  // Nothing above may trap the player on the loading screen. If an asset hangs
  // without calling back, or draw() never runs, surrender and let them in.
  setTimeout(function () {
    finished = true;
  }, 30000);
})();
