(function (global) {
    'use strict';

    let listenersBound = false;

    function resizeCanvas() {
        const canvas = document.querySelector('#game-container canvas');
        if (!canvas || typeof canvasWidth === 'undefined' || typeof canvasHeight === 'undefined') return;
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement;
        const scaleX = window.innerWidth / canvasWidth;
        const scaleY = window.innerHeight / canvasHeight;
        const isMobileSize = window.innerWidth <= 768 || window.innerHeight <= 600;
        const scaleFactor = isFullscreen ? 0.98 : (isMobileSize ? 0.90 : 0.85);
        const scale = Math.min(scaleX, scaleY) * scaleFactor;

        canvas.style.width = (canvasWidth * scale) + 'px';
        canvas.style.height = (canvasHeight * scale) + 'px';
        canvas.style.position = 'absolute';
        canvas.style.left = '50%';
        canvas.style.top = isMobileSize && typeof isMobile !== 'undefined' && isMobile && !isFullscreen ? '42%' : '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
    }

    function onFullscreenChange() {
        setTimeout(() => {
            resizeCanvas();
            if (typeof updateMobileStatus === 'function') updateMobileStatus();
        }, 100);
    }

    function toggleFullscreen() {
        const root = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement &&
            !document.mozFullScreenElement && !document.msFullscreenElement) {
            const request = root.requestFullscreen ? root.requestFullscreen() :
                (root.webkitRequestFullscreen ? root.webkitRequestFullscreen() :
                    (root.mozRequestFullScreen ? root.mozRequestFullScreen() :
                        (root.msRequestFullscreen ? root.msRequestFullscreen() : null)));
            if (request && request.catch) request.catch(() => {});
        } else if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }

    function setup() {
        toggleFullscreen();
        resizeCanvas();
        if (listenersBound) return;
        listenersBound = true;
        document.addEventListener('keydown', event => {
            if (event.key === 'F11') {
                event.preventDefault();
                toggleFullscreen();
            }
        });
        window.addEventListener('resize', resizeCanvas);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange);
        document.addEventListener('mozfullscreenchange', onFullscreenChange);
        document.addEventListener('MSFullscreenChange', onFullscreenChange);
    }

    global.CloudyDisplay = { setup, resizeCanvas, toggleFullscreen, onFullscreenChange };
})(window);
