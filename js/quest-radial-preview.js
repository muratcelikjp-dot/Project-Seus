(() => {
  const viewport = document.getElementById('riff-viewport');
  const stage = document.getElementById('riff-stage');
  const play = stage.querySelector('button');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileWidth = Number(new URLSearchParams(location.search).get('width'));
  const widthLimit = [320, 390, 430].includes(mobileWidth) ? mobileWidth : 430;

  function fitFrame() {
    const width = Math.min(document.documentElement.clientWidth, widthLimit, window.innerHeight * 1080 / 1920);
    viewport.style.width = width + 'px';
    viewport.style.height = width * 1920 / 1080 + 'px';
    stage.style.setProperty('--preview-scale', width / 1080);
  }

  function setPlaying(playing) {
    stage.toggleAttribute('data-paused', !playing);
    play.setAttribute('aria-pressed', String(playing));
    play.setAttribute('aria-label', (playing ? 'Pause' : 'Play') + ' radial menu animation');
  }

  fitFrame();
  window.addEventListener('resize', fitFrame);
  play.addEventListener('click', () => setPlaying(stage.hasAttribute('data-paused')));
  reducedMotion.addEventListener('change', ({matches}) => {
    if (matches) setPlaying(false);
  });
  window.addEventListener('load', () => setPlaying(!reducedMotion.matches), {once: true});
})();
