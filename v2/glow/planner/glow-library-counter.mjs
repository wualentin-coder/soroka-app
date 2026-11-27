const counterStyle = document.createElement('style');
counterStyle.textContent = `
  .library-counter > .halo, .library-counter .fill { display: none; }
  .library-counter > .plate {
    background: linear-gradient(158deg, rgba(255,255,255,.15), rgba(255,255,255,.035) 55%, rgba(0,0,0,.19));
    -webkit-backdrop-filter: blur(16px) saturate(1.22);
    backdrop-filter: blur(16px) saturate(1.22);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.37), inset 0 0 0 1px rgba(255,255,255,.12),
      inset 0 -12px 20px rgba(0,0,0,.12), 0 9px 23px rgba(0,0,0,.18);
  }
  #lfocus .big { gap: 12px; }
  #lfocus .big span { color: rgba(255,250,244,.92); }
  .library-counter b.library-counter-number {
    position: relative;
    display: block;
    font-weight: 550;
    line-height: .9;
  }
  .library-counter [data-counter-motion] {
    background-image: linear-gradient(to bottom, #fffaf5 54%, transparent 96%);
  }
  .library-counter .counter-motion {
    position: absolute;
    top: 0;
    pointer-events: none;
  }
  @media (forced-colors: active) {
    .library-counter b.library-counter-number { background: none; color: CanvasText; }
    .library-counter .counter-motion { display: none; }
  }
`;
document.head.append(counterStyle);

const blurStart = .54;
const blurEnd = .96;
const diagonal = { '1': -.05, '2': -.14, '4': -.05, '7': -.52, '9': -.15 };
const exposureSteps = 35;
const exposure = Array.from({ length: exposureSteps }, (_, index) => {
  const progress = index / (exposureSteps - 1);
  return { progress, weight: (1 - progress * .92) ** 1.4 };
});
const exposureWeight = exposure.reduce((sum, sample) => sum + sample.weight, 0);

// Deposit each sample subpixel-accurately to avoid bands at mobile sizes.
function addExposure(buffer, width, x, y, alpha) {
  const left = Math.floor(x);
  const top = Math.floor(y);
  if (left < 0 || left + 1 >= width || top < 0 || (top + 2) * width > buffer.length) return;
  const u = x - left;
  const v = y - top;
  const index = top * width + left;
  buffer[index] += alpha * (1 - u) * (1 - v);
  buffer[index + 1] += alpha * u * (1 - v);
  buffer[index + width] += alpha * (1 - u) * v;
  buffer[index + width + 1] += alpha * u * v;
}

function drawCounterMotion(counter) {
  const width = counter.offsetWidth;
  const text = counter.firstChild;
  if (!width || text?.nodeType !== Node.TEXT_NODE) return;

  const styles = getComputedStyle(counter);
  const fontSize = parseFloat(styles.fontSize);
  const line = parseFloat(styles.lineHeight);
  const letterSpacing = parseFloat(styles.letterSpacing) || 0;
  const density = Math.min(devicePixelRatio || 1, 2);
  const maxTravel = fontSize * .32;
  const padding = Math.ceil(fontSize * .26);
  const canvas = counter.querySelector('.counter-motion') || document.createElement('canvas');
  const key = [text.data, width, line, fontSize, styles.fontFamily, styles.fontWeight, letterSpacing, density, fontRevision].join('|');
  if (canvas.dataset.renderKey === key) return;
  const mask = document.createElement('canvas');
  const sourceWidth = Math.ceil((width + padding * 2) * density);
  const sourceHeight = Math.ceil((line + 4) * density);
  mask.width = sourceWidth;
  mask.height = sourceHeight;
  const pen = mask.getContext('2d');
  const render = canvas.getContext('2d');
  if (!pen || !render) return;

  // Use the live text position for each glyph, including spacing in prices.
  pen.scale(density, density);
  pen.font = styles.fontWeight + ' ' + fontSize + 'px ' + styles.fontFamily;
  pen.fillStyle = '#fff';
  const font = pen.measureText('0');
  const ascent = font.fontBoundingBoxAscent ?? fontSize * .8;
  const descent = font.fontBoundingBoxDescent ?? fontSize * .2;
  const baseline = (line + ascent - descent) / 2;
  const range = document.createRange();
  const bounds = counter.getBoundingClientRect();
  const scale = bounds.width / width || 1;
  const slopes = new Float32Array(sourceWidth).fill(-.05);
  for (let index = 0; index < text.length; index++) {
    const digit = text.data[index];
    if (!/[0-9]/.test(digit)) continue;
    range.setStart(text, index);
    range.setEnd(text, index + 1);
    const glyph = range.getBoundingClientRect();
    const left = padding + (glyph.left - bounds.left) / scale;
    const advance = glyph.width / scale;
    const natural = pen.measureText(digit).width;
    pen.save();
    pen.translate(left, 0);
    pen.scale((advance - letterSpacing) / natural, 1);
    pen.fillText(digit, 0, baseline);
    pen.restore();
    slopes.fill(diagonal[digit] ?? -.05, Math.floor(left * density), Math.ceil((left + advance) * density));
  }

  const alpha = pen.getImageData(0, 0, sourceWidth, sourceHeight).data;
  canvas.width = sourceWidth;
  canvas.height = Math.ceil((line + maxTravel + 6) * density);
  const accumulation = new Float32Array(canvas.width * canvas.height);
  const start = line * density * blurStart;
  const spreadLength = line * density * (blurEnd - blurStart);
  for (let y = Math.floor(start); y < sourceHeight; y++) {
    const mix = Math.min(1, Math.max(0, (y - start) / spreadLength));
    const travel = maxTravel * density * mix ** 1.36;
    for (let x = 0; x < sourceWidth; x++) {
      const coverage = alpha[(y * sourceWidth + x) * 4 + 3] * mix;
      if (coverage < .4) continue;
      for (const { progress, weight } of exposure) {
        const shift = progress * travel;
        const sampleX = x + shift * slopes[x];
        const sampleY = y + shift;
        const spread = .25 * shift;
        const energy = coverage * weight / exposureWeight;
        addExposure(accumulation, sourceWidth, sampleX, sampleY, energy * .56);
        addExposure(accumulation, sourceWidth, sampleX - spread, sampleY, energy * .22);
        addExposure(accumulation, sourceWidth, sampleX + spread, sampleY, energy * .22);
      }
    }
  }

  const bitmap = render.createImageData(canvas.width, canvas.height);
  for (let pixel = 0; pixel < accumulation.length; pixel++) {
    const nearby = (accumulation[pixel - sourceWidth] || 0) + (accumulation[pixel + sourceWidth] || 0);
    const farther = (accumulation[pixel - 2 * sourceWidth] || 0) + (accumulation[pixel + 2 * sourceWidth] || 0);
    const opacity = (6 * accumulation[pixel] + 4 * nearby + farther) / 16;
    if (opacity < .5) continue;
    const index = pixel * 4;
    bitmap.data[index] = 255;
    bitmap.data[index + 1] = 250;
    bitmap.data[index + 2] = 245;
    bitmap.data[index + 3] = opacity;
  }
  render.putImageData(bitmap, 0, 0);
  canvas.className = 'counter-motion';
  canvas.dataset.renderKey = key;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.left = -padding + 'px';
  canvas.style.width = canvas.width / density + 'px';
  canvas.style.height = canvas.height / density + 'px';
  counter.dataset.counterMotion = '';
  if (!canvas.parentNode) counter.append(canvas);
}

let refreshFrame = 0;
let fontRevision = 0;
function refreshCounterMotion() {
  cancelAnimationFrame(refreshFrame);
  refreshFrame = requestAnimationFrame(() => {
    for (const counter of $$('.screen.on .library-counter-number')) drawCounterMotion(counter);
  });
}
window.addEventListener('resize', refreshCounterMotion);
document.fonts?.addEventListener('loadingdone', () => {
  fontRevision++;
  refreshCounterMotion();
});

export function paintLibraryCounter(counter) {
  if (!counter) return;
  counter.classList.add('library-counter-number');
  counter.closest('.plate-w')?.classList.add('library-counter');
  const value = counter.textContent;
  if (counter.dataset.count !== value || !counter.querySelector('.counter-motion')) {
    counter.dataset.count = value;
    if (counter.isConnected) drawCounterMotion(counter);
  }
}
