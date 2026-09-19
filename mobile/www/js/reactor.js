// Builds the reactor SVG markup and drives its motion with a small
// physics loop rather than CSS keyframes. Swapping a CSS animation's
// `animation-duration` (the old approach) snaps to the new speed
// instantly — visibly jarring. Easing angular velocity and pulse
// frequency toward a target each frame reads as acceleration/
// deceleration instead, which is what makes it feel built rather than
// just switched.
//
// Ring composition is modeled directly on the film's JARVIS boot-screen
// emblem: a dense tick bezel, a ring of scattered small circuit-node
// rectangles, a thick partial ring with gaps, a thin dashed ring, and
// the wordmark centered with short flanking tick marks — calm and
// mostly negative space, not a busy dashboard.

const REACTOR_CYAN = "#35D8E8";
const REACTOR_BRIGHT = "#EAFBFF";

function renderReactor(size) {
  const c = size / 2;

  // Dense tick bezel — every 6th tick longer/brighter, like a watch face.
  const tickR = c * 0.8;
  const tickCount = 72;
  let ticks = "";
  for (let i = 0; i < tickCount; i++) {
    const angle = (360 / tickCount) * i;
    const major = i % 6 === 0;
    const len = major ? c * 0.1 : c * 0.055;
    const width = major ? 1.6 : 0.8;
    const opacity = major ? 0.85 : 0.4;
    ticks += `<line x1="${c}" y1="${c - tickR}" x2="${c}" y2="${c - tickR + len}" stroke="${REACTOR_CYAN}" stroke-width="${width}" opacity="${opacity}" transform="rotate(${angle} ${c} ${c})"/>`;
  }

  // Scattered circuit-node rectangles — irregular placement, not evenly
  // spaced, so it reads as circuitry rather than a decorative pattern.
  const nodeR = c * 0.62;
  const nodeAngles = [12, 58, 96, 149, 188, 224, 271, 312];
  let nodes = "";
  nodeAngles.forEach((angle, i) => {
    const w = i % 3 === 0 ? 5 : 3;
    const h = i % 2 === 0 ? 3 : 5;
    nodes += `<rect x="${c - w / 2}" y="${c - nodeR - h / 2}" width="${w}" height="${h}" fill="${REACTOR_CYAN}" opacity="0.7" transform="rotate(${angle} ${c} ${c})"/>`;
  });

  const outerR = c * 0.94;
  const thickR = c * 0.46;
  const thinR = c * 0.34;
  const thickCirc = 2 * Math.PI * thickR;
  const thinCirc = 2 * Math.PI * thinR;

  const fontSize = Math.max(10, c * 0.15);
  const flankGap = fontSize * 2.6;
  const flankLen = c * 0.12;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible;">
      <circle cx="${c}" cy="${c}" r="${outerR}" fill="none" stroke="${REACTOR_CYAN}" stroke-width="0.6" opacity="0.22"/>
      <g class="reactor-ticks" style="transform-origin:${c}px ${c}px;">${ticks}</g>
      <g class="reactor-dial2" style="transform-origin:${c}px ${c}px;">${nodes}</g>
      <circle class="reactor-dial" cx="${c}" cy="${c}" r="${thickR}" fill="none" stroke="${REACTOR_CYAN}"
        stroke-width="${size * 0.028}" stroke-linecap="round"
        stroke-dasharray="${thickCirc * 0.3} ${thickCirc * 0.04} ${thickCirc * 0.32} ${thickCirc * 0.04} ${thickCirc * 0.26} ${thickCirc * 0.04}"
        opacity="0.9" style="transform-origin:${c}px ${c}px;"/>
      <circle class="reactor-dash" cx="${c}" cy="${c}" r="${thinR}" fill="none" stroke="${REACTOR_CYAN}"
        stroke-width="1" stroke-dasharray="2 5" opacity="0.45" style="transform-origin:${c}px ${c}px;"/>
      <line x1="${c - flankGap}" y1="${c}" x2="${c - flankGap + flankLen}" y2="${c}" stroke="${REACTOR_CYAN}" stroke-width="1" opacity="0.8"/>
      <line x1="${c + flankGap}" y1="${c}" x2="${c + flankGap - flankLen}" y2="${c}" stroke="${REACTOR_CYAN}" stroke-width="1" opacity="0.8"/>
      <text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central"
        font-family="'Orbitron', sans-serif" font-weight="500" font-size="${fontSize}"
        letter-spacing="${fontSize * 0.28}" fill="${REACTOR_BRIGHT}"
        style="filter:drop-shadow(0 0 6px ${REACTOR_CYAN});">JARVIS</text>
    </svg>`;
}

const ReactorEngine = (() => {
  const instances = new Set();
  let rafId = null;
  let lastTime = null;

  function ease(dt, rate) {
    return 1 - Math.exp(-dt * rate);
  }

  function loop(now) {
    if (lastTime == null) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    for (const inst of instances) {
      if (!inst.el.isConnected) {
        instances.delete(inst);
        continue;
      }
      inst.tick(dt);
    }

    rafId = instances.size ? requestAnimationFrame(loop) : null;
    if (!rafId) lastTime = null;
  }

  function ensureLoop() {
    if (rafId == null) rafId = requestAnimationFrame(loop);
  }

  class ReactorInstance {
    constructor(el) {
      this.el = el;
      this.active = false;
      this.dialAngle = 0;
      this.tickAngle = 0;
      this.dashAngle = 0;
      this.dialVel = 8;
      this.tickVel = -5;
      this.dashVel = -14;
      this.pulsePhase = 0;
      this.pulseFreq = 0.35;
      this.dialEl = el.querySelector(".reactor-dial");
      this.dial2El = el.querySelector(".reactor-dial2");
      this.tickEl = el.querySelector(".reactor-ticks");
      this.dashEl = el.querySelector(".reactor-dash");
    }

    setActive(active) {
      this.active = active;
    }

    tick(dt) {
      // Calm at rest — this is a boot emblem, not a spinning gauge — and
      // still visibly picks up when the app is speaking/listening.
      const targetDialVel = this.active ? 42 : 8;
      const targetTickVel = this.active ? -20 : -5;
      const targetDashVel = this.active ? -34 : -14;
      const targetPulseFreq = this.active ? 1.4 : 0.35;
      const rate = ease(dt, 2.2);

      this.dialVel += (targetDialVel - this.dialVel) * rate;
      this.tickVel += (targetTickVel - this.tickVel) * rate;
      this.dashVel += (targetDashVel - this.dashVel) * rate;
      this.pulseFreq += (targetPulseFreq - this.pulseFreq) * rate;

      this.dialAngle = (this.dialAngle + this.dialVel * dt) % 360;
      this.tickAngle = (this.tickAngle + this.tickVel * dt) % 360;
      this.dashAngle = (this.dashAngle + this.dashVel * dt) % 360;
      this.pulsePhase += dt * this.pulseFreq * Math.PI * 2;

      const glowRadius = this.active ? 14 : 6;
      const glowAlpha = this.active ? 0.75 : 0.4;

      if (this.dialEl) {
        this.dialEl.style.transform = `rotate(${this.dialAngle}deg)`;
        this.dialEl.style.filter = `drop-shadow(0 0 ${glowRadius}px rgba(53,216,232,${glowAlpha}))`;
      }
      if (this.tickEl) this.tickEl.style.transform = `rotate(${this.tickAngle}deg)`;
      if (this.dashEl) this.dashEl.style.transform = `rotate(${this.dashAngle}deg)`;
      if (this.dial2El) this.dial2El.style.transform = `rotate(${-this.dashAngle * 0.6}deg)`;
    }
  }

  return {
    create(el) {
      const inst = new ReactorInstance(el);
      instances.add(inst);
      ensureLoop();
      return inst;
    },
    destroy(inst) {
      if (inst) instances.delete(inst);
    },
  };
})();

// Each reactor host's previous engine instance is tracked here so that
// re-mounting (e.g. re-rendering the brief replaces the SVG children)
// retires the old instance instead of leaving it ticking forever against
// detached elements — `container` itself usually stays connected even
// when its children are replaced, so the loop's own isConnected check
// can't catch this case.
const reactorInstances = new WeakMap();

function mountReactor(container, size, active) {
  ReactorEngine.destroy(reactorInstances.get(container));

  container.classList.add("reactor-wrap");
  container.style.width = size + "px";
  container.style.height = size + "px";
  container.innerHTML = renderReactor(size);

  const instance = ReactorEngine.create(container);
  instance.setActive(!!active);
  container.classList.toggle("active", !!active);
  reactorInstances.set(container, instance);
}

// Changes speed without remounting the SVG, so the reactor keeps
// spinning continuously through the transition rather than snapping
// back to angle zero.
function setReactorActive(container, active) {
  const inst = reactorInstances.get(container);
  if (inst) inst.setActive(!!active);
  container.classList.toggle("active", !!active);
}
