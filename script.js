/*
  Infinite Gradient 3D Carousel - Modified for Designer Promotion
  Original work by Clément Grellier (MIT License)
  Modified: 3D process flow carousel with detail panels

  核心保留能力：
  1. 无限循环的 3D 卡片轮播
  2. 中心卡片放大、两侧卡片旋转并后退的空间效果
  3. 鼠标滚轮切换
  4. 鼠标拖拽切换
  5. 惯性滑动
  6. 当前卡片变化时，背景渐变平滑切换
  7. 响应式布局
  8. GPU 优化与流畅动画
*/

// ============================================================================
// CONFIGURATION
// ============================================================================

// Physics constants
const FRICTION = 0.9;           // Velocity decay (0-1, lower = more friction)
const WHEEL_SENS = 0.6;         // Mouse wheel sensitivity
const DRAG_SENS = 1.0;          // Drag sensitivity

// Visual constants
const MAX_ROTATION = 28;        // Maximum card rotation in degrees
const MAX_DEPTH = 140;          // Maximum Z-axis depth in pixels
const MIN_SCALE = 0.92;         // Minimum card scale
const SCALE_RANGE = 0.1;        // Scale variation range
const GAP = 28;                 // Gap between cards in pixels

// Reduced motion check
const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================================
// DOM REFERENCES
// ============================================================================

const stage = document.querySelector('.stage');
const cardsRoot = document.getElementById('cards');
const bgCanvas = document.getElementById('bg');
const bgCtx = bgCanvas?.getContext('2d', { alpha: false });
const loader = document.getElementById('loader');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modalImg');
const modalClose = document.getElementById('modalClose');
const detailSection = document.getElementById('detail');
const detailAction = document.getElementById('detailAction');
const detailOutput = document.getElementById('detailOutput');
const detailValue = document.getElementById('detailValue');
const stageLabel = document.getElementById('stageLabel');
const progressDots = document.querySelector('.progress__dots');
const currentNum = document.getElementById('currentNum');

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let items = [];                 // Array of {el: HTMLElement, x: number, data: Object}
let positions = [];             // Float32Array for wrapped positions
let activeIndex = -1;           // Currently centered card index
let isEntering = true;          // Prevents interaction during entry animation
let isDetailExpanded = false;   // Whether detail section is expanded

// Layout measurements
let CARD_W = 300;               // Card width (measured dynamically)
let CARD_H = 400;               // Card height (measured dynamically)
let STEP = CARD_W + GAP;        // Distance between card centers
let TRACK = 0;                  // Total carousel track length
let SCROLL_X = 0;               // Current scroll position
let VW_HALF = window.innerWidth * 0.5;

// Physics state
let vX = 0;                     // Velocity in X direction

// Animation frame IDs
let rafId = null;               // Carousel animation frame
let bgRAF = null;               // Background animation frame
let lastTime = 0;               // Last frame timestamp
let lastBgDraw = 0;             // Last background draw time

// Background gradient state
let gradPalette = [];           // Predefined colors from each node
let gradCurrent = {             // Current interpolated gradient colors
  r1: 45, g1: 55, b1: 80,       // First gradient color (RGB)
  r2: 70, g2: 80, b2: 140       // Second gradient color (RGB)
};
let bgFastUntil = 0;            // Timestamp until which to render at high FPS

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mod(n, m) {
  return ((n % m) + m) % m;
}

// ============================================================================
// PROGRESS DOTS
// ============================================================================

function createProgressDots() {
  if (!progressDots) return;
  progressDots.innerHTML = '';
  NODES.forEach((node, i) => {
    const dot = document.createElement('div');
    dot.className = 'progress__dot';
    dot.setAttribute('aria-label', `跳转到第 ${node.number} 步：${node.title}`);
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      goToIndex(i);
    });
    progressDots.appendChild(dot);
  });
}

function updateProgressDots(idx) {
  const dots = progressDots?.querySelectorAll('.progress__dot');
  if (!dots) return;
  dots.forEach((dot, i) => {
    dot.classList.toggle('is-active', i === idx);
  });
  if (currentNum) {
    currentNum.textContent = NODES[idx]?.number || '01';
  }
}

// ============================================================================
// CARDS CREATION
// ============================================================================

function createCards() {
  cardsRoot.innerHTML = '';
  items = [];

  const fragment = document.createDocumentFragment();

  NODES.forEach((node, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.willChange = 'transform, filter';
    card.setAttribute('data-index', i);
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${node.number} ${node.title}`);

    const colors = node.gradientColors;
    const color1 = `rgb(${colors.c1[0]}, ${colors.c1[1]}, ${colors.c1[2]})`;
    const color2 = `rgb(${colors.c2[0]}, ${colors.c2[1]}, ${colors.c2[2]})`;

    card.innerHTML = `
      <div class="card__inner" style="--card-accent1: ${color1}; --card-accent2: ${color2};">
        <img class="card__img" src="${node.image}" alt="${node.title}" decoding="async" loading="eager" />
      </div>
    `;

    card.addEventListener('click', () => {
      handleCardClick(i);
    });

    fragment.appendChild(card);
    items.push({ el: card, x: i * STEP, data: node });
  });

  cardsRoot.appendChild(fragment);
}

function handleCardClick(index) {
  if (isEntering) return;

  if (index === activeIndex) {
    window.openModal(index);
  } else {
    goToIndex(index);
  }
}

// ============================================================================
// MODAL
// ============================================================================

let gifAnimationId = null;

window.openModal = function(index) {
  const modal = document.getElementById('modal');
  const modalCanvas = document.getElementById('modalCanvas');
  const modalImg = document.getElementById('modalImg');
  if (!modal) return;
  const node = NODES[index];
  if (!node) return;

  const modalImgPath = node.modalImage || node.image;

  if (modalCanvas && window.GifReader) {
    modalCanvas.style.display = 'block';
    modalImg.style.display = 'none';
    playGifOnce(modalCanvas, modalImgPath);
  } else {
    modalCanvas.style.display = 'none';
    modalImg.style.display = 'block';
    modalImg.src = modalImgPath;
    modalImg.alt = node.title;
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
};

window.closeModal = function() {
  const modal = document.getElementById('modal');
  const modalCanvas = document.getElementById('modalCanvas');
  const modalImg = document.getElementById('modalImg');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (gifAnimationId) {
    cancelAnimationFrame(gifAnimationId);
    gifAnimationId = null;
  }
  if (modalCanvas) {
    const ctx = modalCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
    modalCanvas.style.display = 'none';
  }
  if (modalImg) {
    modalImg.src = '';
    modalImg.style.display = 'none';
  }
};

function playGifOnce(canvas, src) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const xhr = new XMLHttpRequest();
  xhr.open('GET', src, true);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function() {
    if (xhr.status !== 200) {
      const modalImg = document.getElementById('modalImg');
      if (modalImg) {
        canvas.style.display = 'none';
        modalImg.style.display = 'block';
        modalImg.src = src;
      }
      return;
    }

    const buffer = new Uint8Array(xhr.response);
    const gif = new window.GifReader(buffer);
    const width = gif.width;
    const height = gif.height;
    const numFrames = gif.numFrames();

    canvas.width = width;
    canvas.height = height;

    const rgbaBuffer = new Uint8Array(width * height * 4);
    let currentFrame = 0;
    let lastTime = 0;

    function animate(t) {
      if (!lastTime) lastTime = t;
      const delay = gif.frameInfo(currentFrame).delay * 10;
      if (t - lastTime >= delay) {
        gif.decodeAndBlitFrameRGBA(currentFrame, rgbaBuffer);
        const imageData = ctx.createImageData(width, height);
        imageData.data.set(rgbaBuffer);
        ctx.putImageData(imageData, 0, 0);
        currentFrame++;
        lastTime = t;
      }
      if (currentFrame < numFrames) {
        gifAnimationId = requestAnimationFrame(animate);
      }
    }

    gifAnimationId = requestAnimationFrame(animate);
  };
  xhr.onerror = function() {
    const modalImg = document.getElementById('modalImg');
    if (modalImg) {
      canvas.style.display = 'none';
      modalImg.style.display = 'block';
      modalImg.src = src;
    }
  };
  xhr.send();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('modal');
    if (modal?.classList.contains('is-open')) {
      window.closeModal();
    }
  }
});

function goToIndex(index) {
  if (index < 0 || index >= NODES.length) return;

  const maxScroll = Math.max(0, TRACK - STEP * 0.5);
  const targetX = Math.min(maxScroll, Math.max(0, index * STEP));
  const delta = targetX - SCROLL_X;

  const duration = PREFERS_REDUCED_MOTION ? 0 : 0.6;
  const startX = SCROLL_X;
  const startTime = performance.now();

  function animate(t) {
    const elapsed = (t - startTime) / 1000;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);

    SCROLL_X = startX + delta * eased;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      vX = 0;
    }
  }

  requestAnimationFrame(animate);
}

function toggleDetailExpand() {
  isDetailExpanded = !isDetailExpanded;
  if (detailSection) {
    detailSection.classList.toggle('is-expanded', isDetailExpanded);
  }
}

// ============================================================================
// DETAIL UPDATE
// ============================================================================

function updateDetail(idx) {
  const node = NODES[idx];
  if (!node) return;

  if (stageLabel) {
    stageLabel.textContent = node.stage;
  }

  if (!detailSection) return;

  detailSection.classList.remove('is-visible');

  setTimeout(() => {
    if (detailAction) detailAction.textContent = node.action;
    if (detailOutput) detailOutput.textContent = node.output;
    if (detailValue) detailValue.textContent = node.value;
    detailSection.classList.add('is-visible');
  }, PREFERS_REDUCED_MOTION ? 0 : 150);
}

// ============================================================================
// MEASURE & LAYOUT
// ============================================================================

function measure() {
  const sample = items[0]?.el;
  if (!sample) return;

  const r = sample.getBoundingClientRect();
  CARD_W = r.width || CARD_W;
  CARD_H = r.height || CARD_H;
  STEP = CARD_W + GAP;
  TRACK = items.length * STEP;

  items.forEach((it, i) => {
    it.x = i * STEP;
  });

  positions = new Float32Array(items.length);
}

// ============================================================================
// TRANSFORM CALCULATIONS
// ============================================================================

function computeTransformComponents(screenX) {
  const norm = Math.max(-1, Math.min(1, screenX / VW_HALF));
  const absNorm = Math.abs(norm);
  const invNorm = 1 - absNorm;

  const ry = -norm * MAX_ROTATION;
  const tz = invNorm * MAX_DEPTH;
  const scale = MIN_SCALE + invNorm * SCALE_RANGE;

  return { norm, absNorm, invNorm, ry, tz, scale };
}

function transformForScreenX(screenX) {
  const { ry, tz, scale } = computeTransformComponents(screenX);

  return {
    transform: `translate3d(${screenX}px,-50%,${tz}px) rotateY(${ry}deg) scale(${scale})`,
    z: tz,
  };
}

function updateCarouselTransforms() {
  let closestIdx = -1;
  let closestDist = Infinity;

  for (let i = 0; i < items.length; i++) {
    let pos = items[i].x - SCROLL_X;
    positions[i] = pos;

    const dist = Math.abs(pos);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }

  const prevIdx = Math.max(0, closestIdx - 1);
  const nextIdx = Math.min(items.length - 1, closestIdx + 1);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const pos = positions[i];
    const norm = Math.max(-1, Math.min(1, pos / VW_HALF));
    const absNorm = Math.abs(norm);

    const { transform, z } = transformForScreenX(pos);

    it.el.style.transform = transform;
    it.el.style.zIndex = String(1000 + Math.round(z));

    const isCore = i === closestIdx || i === prevIdx || i === nextIdx;
    const blur = isCore ? 0 : 2 * Math.pow(absNorm, 1.1);
    it.el.style.filter = `blur(${blur.toFixed(2)}px)`;

    const isActive = i === closestIdx;
    it.el.classList.toggle('is-active', isActive);

    const baseOpacity = isActive ? 1 : (isCore ? 0.7 : 0.35);
    const edgeFactor = Math.max(0, 1 - Math.max(0, (absNorm - 0.8) * 3));
    const opacity = baseOpacity * edgeFactor;
    it.el.style.opacity = opacity.toFixed(2);
    it.el.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
  }

  if (closestIdx !== activeIndex && closestIdx >= 0) {
    setActiveGradient(closestIdx);
    updateDetail(closestIdx);
    updateProgressDots(closestIdx);
    if (isDetailExpanded) {
      isDetailExpanded = false;
      detailSection?.classList.remove('is-expanded');
    }
  }
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function tick(t) {
  const dt = lastTime ? (t - lastTime) / 1000 : 0;
  lastTime = t;

  const maxScroll = Math.max(0, TRACK - STEP * 0.5);
  SCROLL_X = SCROLL_X + vX * dt;

  if (SCROLL_X < 0) {
    SCROLL_X = 0;
    if (vX < 0) vX = 0;
  }
  if (SCROLL_X > maxScroll) {
    SCROLL_X = maxScroll;
    if (vX > 0) vX = 0;
  }

  const decay = Math.pow(FRICTION, dt * 60);
  vX *= decay;
  if (Math.abs(vX) < 0.02) vX = 0;

  updateCarouselTransforms();
  rafId = requestAnimationFrame(tick);
}

function startCarousel() {
  cancelCarousel();
  lastTime = 0;
  rafId = requestAnimationFrame((t) => {
    updateCarouselTransforms();
    tick(t);
  });
}

function cancelCarousel() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

// ============================================================================
// GRADIENT PALETTE
// ============================================================================

function buildPalette() {
  gradPalette = NODES.map((node) => ({
    c1: node.gradientColors.c1,
    c2: node.gradientColors.c2,
  }));
}

function setActiveGradient(idx) {
  if (!bgCtx || idx < 0 || idx >= items.length || idx === activeIndex) return;

  activeIndex = idx;
  const pal = gradPalette[idx] || { c1: [45, 55, 80], c2: [70, 80, 140] };
  const to = {
    r1: pal.c1[0],
    g1: pal.c1[1],
    b1: pal.c1[2],
    r2: pal.c2[0],
    g2: pal.c2[1],
    b2: pal.c2[2],
  };

  if (window.gsap && !PREFERS_REDUCED_MOTION) {
    bgFastUntil = performance.now() + 800;
    window.gsap.to(gradCurrent, { ...to, duration: 0.6, ease: 'power2.out' });
  } else {
    Object.assign(gradCurrent, to);
  }
}

// ============================================================================
// BACKGROUND RENDERING
// ============================================================================

function resizeBG() {
  if (!bgCanvas || !bgCtx) return;

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const w = bgCanvas.clientWidth || stage.clientWidth;
  const h = bgCanvas.clientHeight || stage.clientHeight;
  const tw = Math.floor(w * dpr);
  const th = Math.floor(h * dpr);

  if (bgCanvas.width !== tw || bgCanvas.height !== th) {
    bgCanvas.width = tw;
    bgCanvas.height = th;
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function drawBackground() {
  if (!bgCanvas || !bgCtx) return;

  const now = performance.now();
  const minInterval = now < bgFastUntil ? 16 : 50;

  if (now - lastBgDraw < minInterval) {
    bgRAF = requestAnimationFrame(drawBackground);
    return;
  }

  lastBgDraw = now;
  resizeBG();

  const w = bgCanvas.clientWidth || stage.clientWidth;
  const h = bgCanvas.clientHeight || stage.clientHeight;

  bgCtx.fillStyle = '#FFF5EF';
  bgCtx.fillRect(0, 0, w, h);

  const time = PREFERS_REDUCED_MOTION ? 0 : now * 0.00015;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const a1 = Math.min(w, h) * 0.35;
  const a2 = Math.min(w, h) * 0.3;

  const x1 = cx + Math.cos(time) * a1;
  const y1 = cy + Math.sin(time * 0.8) * a1 * 0.4;
  const x2 = cx + Math.cos(-time * 0.9 + 1.2) * a2;
  const y2 = cy + Math.sin(-time * 0.7 + 0.7) * a2 * 0.5;

  const r1 = Math.max(w, h) * 0.75;
  const r2 = Math.max(w, h) * 0.65;

  const g1 = bgCtx.createRadialGradient(x1, y1, 0, x1, y1, r1);
  g1.addColorStop(0, `rgba(${gradCurrent.r1},${gradCurrent.g1},${gradCurrent.b1},0.1)`);
  g1.addColorStop(1, 'rgba(255,245,239,0)');
  bgCtx.fillStyle = g1;
  bgCtx.fillRect(0, 0, w, h);

  const g2 = bgCtx.createRadialGradient(x2, y2, 0, x2, y2, r2);
  g2.addColorStop(0, `rgba(${gradCurrent.r2},${gradCurrent.g2},${gradCurrent.b2},0.1)`);
  g2.addColorStop(1, 'rgba(255,245,239,0)');
  bgCtx.fillStyle = g2;
  bgCtx.fillRect(0, 0, w, h);

  bgRAF = requestAnimationFrame(drawBackground);
}

function startBG() {
  if (!bgCanvas || !bgCtx) return;
  cancelBG();
  bgRAF = requestAnimationFrame(drawBackground);
}

function cancelBG() {
  if (bgRAF) cancelAnimationFrame(bgRAF);
  bgRAF = null;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onResize() {
  const prevStep = STEP || 1;
  const maxScrollPrev = Math.max(0, items.length * prevStep - prevStep * 0.5);
  const ratio = maxScrollPrev > 0 ? SCROLL_X / maxScrollPrev : 0;
  measure();
  VW_HALF = window.innerWidth * 0.5;
  const maxScroll = Math.max(0, TRACK - STEP * 0.5);
  SCROLL_X = ratio * maxScroll;
  updateCarouselTransforms();
  resizeBG();
}

// Mouse wheel scrolling
stage.addEventListener(
  'wheel',
  (e) => {
    if (isEntering) return;

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const maxScroll = Math.max(0, TRACK - STEP * 0.5);

    if (SCROLL_X <= 0 && delta < 0) return;
    if (SCROLL_X >= maxScroll && delta > 0) return;

    if (Math.abs(delta) > Math.abs(e.deltaX) && e.deltaY !== 0) {
      vX += e.deltaY * WHEEL_SENS * 20;
      e.preventDefault();
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      vX += e.deltaX * WHEEL_SENS * 20;
      e.preventDefault();
    }
  },
  { passive: false }
);

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (isEntering) return;

  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const direction = e.key === 'ArrowLeft' ? -1 : 1;
    const nextIdx = activeIndex + direction;
    if (nextIdx >= 0 && nextIdx < NODES.length) {
      goToIndex(nextIdx);
    }
  }

  if (e.key === 'Enter' || e.key === ' ') {
    if (activeIndex >= 0) {
      const activeCard = items[activeIndex]?.el;
      if (activeCard && (document.activeElement === activeCard || document.activeElement === stage)) {
        e.preventDefault();
        toggleDetailExpand();
      }
    }
  }
});

// Prevent default drag behavior
stage.addEventListener('dragstart', (e) => e.preventDefault());

// Drag state
let dragging = false;
let lastX = 0;
let lastT = 0;
let lastDelta = 0;
let dragStartX = 0;
let dragMoved = false;
let dragCardIndex = -1;

// Pointer down - start dragging
stage.addEventListener('pointerdown', (e) => {
  if (isEntering) return;
  if (e.target.closest('.detail') || e.target.closest('.footer') || e.target.closest('.header') || e.target.closest('.modal')) return;

  const card = e.target.closest('.card');
  dragCardIndex = card ? parseInt(card.getAttribute('data-index'), 10) : -1;

  dragging = true;
  dragMoved = false;
  lastX = e.clientX;
  dragStartX = e.clientX;
  lastT = performance.now();
  lastDelta = 0;
  stage.setPointerCapture(e.pointerId);
  stage.classList.add('dragging');
});

// Pointer move - update scroll position
stage.addEventListener('pointermove', (e) => {
  if (!dragging) return;

  const now = performance.now();
  const dx = e.clientX - lastX;
  const dt = Math.max(1, now - lastT) / 1000;
  const maxScroll = Math.max(0, TRACK - STEP * 0.5);

  if (Math.abs(e.clientX - dragStartX) > 5) {
    dragMoved = true;
  }

  SCROLL_X = SCROLL_X - dx * DRAG_SENS;
  if (SCROLL_X < 0) SCROLL_X = 0;
  if (SCROLL_X > maxScroll) SCROLL_X = maxScroll;

  lastDelta = dx / dt;
  lastX = e.clientX;
  lastT = now;
});

// Pointer up - apply momentum or handle click
stage.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  stage.releasePointerCapture(e.pointerId);

  const maxScroll = Math.max(0, TRACK - STEP * 0.5);
  if (dragMoved) {
    const momentum = -lastDelta * DRAG_SENS;
    if ((SCROLL_X <= 0 && momentum < 0) || (SCROLL_X >= maxScroll && momentum > 0)) {
      vX = 0;
    } else {
      vX = momentum;
    }
  } else if (dragCardIndex >= 0) {
    handleCardClick(dragCardIndex);
  }
  dragCardIndex = -1;

  stage.classList.remove('dragging');
});

// Pointer cancel
stage.addEventListener('pointercancel', (e) => {
  if (!dragging) return;
  dragging = false;
  dragCardIndex = -1;
  stage.releasePointerCapture(e.pointerId);
  stage.classList.remove('dragging');
});

// Debounced resize handler
window.addEventListener('resize', () => {
  clearTimeout(onResize._t);
  onResize._t = setTimeout(onResize, 80);
});

// Pause animations when tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelCarousel();
    cancelBG();
  } else {
    startCarousel();
    startBG();
  }
});

// Reduced motion preference change
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  // No restart needed, but could adjust animation speeds
});

// ============================================================================
// ENTRY ANIMATION
// ============================================================================

async function animateEntry(visibleCards) {
  await new Promise((r) => requestAnimationFrame(r));

  const tl = window.gsap.timeline();

  visibleCards.forEach(({ item, screenX }, idx) => {
    const state = { p: 0 };
    const { ry, tz, scale: baseScale } = computeTransformComponents(screenX);

    const START_SCALE = 0.92;
    const START_Y = 40;

    item.el.style.opacity = '0';
    item.el.style.transform =
      `translate3d(${screenX}px,-50%,${tz}px) ` +
      `rotateY(${ry}deg) ` +
      `scale(${START_SCALE}) ` +
      `translateY(${START_Y}px)`;

    tl.to(
      state,
      {
        p: 1,
        duration: 0.6,
        ease: 'power3.out',
        onUpdate: () => {
          const t = state.p;

          const currentScale = START_SCALE + (baseScale - START_SCALE) * t;
          const currentY = START_Y * (1 - t);
          const opacity = t;

          item.el.style.opacity = opacity.toFixed(3);

          if (t >= 0.999) {
            const { transform } = transformForScreenX(screenX);
            item.el.style.transform = transform;
          } else {
            item.el.style.transform =
              `translate3d(${screenX}px,-50%,${tz}px) ` +
              `rotateY(${ry}deg) ` +
              `scale(${currentScale}) ` +
              `translateY(${currentY}px)`;
          }
        },
      },
      idx * 0.05
    );
  });

  await new Promise((resolve) => {
    tl.eventCallback('onComplete', resolve);
  });
}

// ============================================================================
// WARMUP
// ============================================================================

async function warmupCompositing() {
  const originalScrollX = SCROLL_X;
  const maxScroll = Math.max(0, TRACK - STEP * 0.5);
  const stepSize = STEP * 0.5;
  const numSteps = Math.ceil(maxScroll / stepSize) + 1;

  for (let i = 0; i < numSteps; i++) {
    SCROLL_X = Math.min(maxScroll, i * stepSize);
    updateCarouselTransforms();

    if (i % 3 === 0) {
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  SCROLL_X = originalScrollX;
  updateCarouselTransforms();
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  createProgressDots();
  createCards();
  measure();
  updateCarouselTransforms();
  stage.classList.add('carousel-mode');

  buildPalette();

  let closestIdx = 0;
  let closestDist = Infinity;

  for (let i = 0; i < items.length; i++) {
    let pos = items[i].x - SCROLL_X;
    const d = Math.abs(pos);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }

  setActiveGradient(closestIdx);
  updateDetail(closestIdx);
  updateProgressDots(closestIdx);

  resizeBG();
  if (bgCtx) {
    const w = bgCanvas.clientWidth || stage.clientWidth;
    const h = bgCanvas.clientHeight || stage.clientHeight;
    bgCtx.fillStyle = '#f0f2f5';
    bgCtx.fillRect(0, 0, w, h);
  }

  await warmupCompositing();

  if ('requestIdleCallback' in window) {
    await new Promise((r) => requestIdleCallback(r, { timeout: 100 }));
  }

  startBG();
  await new Promise((r) => setTimeout(r, 100));

  const viewportWidth = window.innerWidth;
  const visibleCards = [];

  for (let i = 0; i < items.length; i++) {
    let pos = items[i].x - SCROLL_X;
    const screenX = pos;
    if (Math.abs(screenX) < viewportWidth * 0.6) {
      visibleCards.push({ item: items[i], screenX, index: i });
    }
  }

  visibleCards.sort((a, b) => a.screenX - b.screenX);

  if (loader) loader.classList.add('loader--hide');

  if (window.gsap && !PREFERS_REDUCED_MOTION) {
    await animateEntry(visibleCards);
  } else {
    items.forEach((it) => {
      it.el.style.opacity = '1';
    });
    detailSection?.classList.add('is-visible');
  }

  isEntering = false;

  startCarousel();

  setTimeout(() => {
    detailSection?.classList.add('is-visible');
  }, PREFERS_REDUCED_MOTION ? 0 : 400);
}

// ============================================================================
// START APPLICATION
// ============================================================================

init();
