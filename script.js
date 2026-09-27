document.getElementById('year').textContent = new Date().getFullYear();

const visual = document.querySelector('[data-halftone]');
const canvas = visual?.querySelector('canvas');
const image = visual?.querySelector('img');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (visual && canvas && image) {
  const context = canvas.getContext('2d', { alpha: false });
  const sampleCanvas = document.createElement('canvas');
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  let particles = [];
  let animationFrame = 0;
  let startedAt = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;

  const easeOut = (value) => 1 - Math.pow(1 - value, 4);

  function buildParticles() {
    const rect = visual.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const step = width < 560 ? 5 : 6;
    sampleCanvas.width = Math.ceil(width / step);
    sampleCanvas.height = Math.ceil(height / step);

    const imageRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    if (imageRatio > targetRatio) {
      sourceWidth = image.naturalHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = image.naturalWidth / targetRatio;
      sourceY = (image.naturalHeight - sourceHeight) / 2;
    }

    sampleContext.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    sampleContext.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
    const centerX = width * .55;
    const centerY = height * .48;

    particles = [];
    for (let y = 0; y < sampleCanvas.height; y += 1) {
      for (let x = 0; x < sampleCanvas.width; x += 1) {
        const index = (y * sampleCanvas.width + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const luminance = (r * .2126 + g * .7152 + b * .0722) / 255;
        if (luminance < .055 && Math.random() > .06) continue;

        const targetX = (x + .5) * step;
        const targetY = (y + .5) * step;
        const angle = Math.atan2(targetY - centerY, targetX - centerX) + (Math.random() - .5) * 1.2;
        const distance = 45 + Math.random() * Math.max(width, height) * .48;
        particles.push({
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          targetX,
          targetY,
          radius: Math.max(.45, Math.min(step * .47, .45 + luminance * step * .55)),
          color: `rgb(${Math.min(215, r + 20)}, ${Math.min(225, g + 17)}, ${Math.min(255, b + 35)})`,
          delay: Math.random() * 680 + Math.hypot(targetX - centerX, targetY - centerY) * .28
        });
      }
    }
    visual.dataset.dotCount = String(particles.length);
  }

  function draw(timestamp) {
    if (!startedAt) startedAt = timestamp;
    const elapsed = timestamp - startedAt;
    context.fillStyle = '#050508';
    context.fillRect(0, 0, width, height);

    let settled = 0;
    for (const particle of particles) {
      const rawProgress = reducedMotion.matches ? 1 : Math.max(0, Math.min(1, (elapsed - particle.delay) / 1500));
      const progress = easeOut(rawProgress);
      const x = particle.x + (particle.targetX - particle.x) * progress;
      const y = particle.y + (particle.targetY - particle.y) * progress;
      const alpha = Math.min(1, rawProgress * 1.8);
      if (rawProgress >= 1) settled += 1;

      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(x, y, particle.radius * (.45 + progress * .55), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    if (settled < particles.length) {
      visual.dataset.animationState = 'running';
      animationFrame = requestAnimationFrame(draw);
    } else {
      visual.dataset.animationState = 'complete';
      visual.dispatchEvent(new CustomEvent('halftone:complete'));
    }
  }

  function start() {
    cancelAnimationFrame(animationFrame);
    visual.dataset.animationState = 'preparing';
    buildParticles();
    startedAt = 0;
    animationFrame = requestAnimationFrame(draw);
  }

  if (image.complete && image.naturalWidth) start();
  else image.addEventListener('load', start, { once: true });

  image.addEventListener('error', () => {
    visual.dataset.animationState = 'image-error';
    visual.classList.add('image-error');
  }, { once: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 180);
  });
}
