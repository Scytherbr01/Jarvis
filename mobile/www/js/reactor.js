// Builds the reactor SVG markup and drives its motion with a small
// physics loop rather than CSS keyframes. Swapping a CSS animation's
// `animation-duration` (the old approach) snaps to the new speed
// instantly — visibly jarring. Easing angular velocity and pulse
// frequency toward a target each frame reads as acceleration/
// deceleration instead, which is what makes it feel built rather than
// just switched.

function renderReactor(size) {
  const c = size / 2;
  const majorTicks = [0, 90, 180, 270];
  const minorTicks = [22.5, 45, 67.5, 112.5, 135, 157.5, 202.5, 225, 247.5, 292.5, 315, 337.5];
  const CYAN = "#3FE0FF";

  let ticks = "";
  for (const angle of majorTicks) {
    ticks += `<line x1="${c}" y1="4" x2="${c}" y2="19" stroke="${CYAN}" stroke-width="2.6" transform="rotate(${angle} ${c} ${c})"/>`;
  }
  for (const angle of minorTicks) {
    ticks += `<line x1="${c}" y1="4" x2="${c}" y2="14" stroke="${CYAN}" stroke-width="1.2" opacity="0.5" transform="rotate(${angle} ${c} ${c})"/>`;
  }
  // A bright orbiting marker riding the tick ring — the "satellite dot"
  // that sells the targeting-dial look at a glance.
  ticks += `<circle cx="${c}" cy="${c - c * 0.86}" r="${size * 0.017}" fill="#BFF6FF" style="filter:drop-shadow(0 0 5px ${CYAN});"/>`;

  const outerR = c * 0.97;
  const dialR = c * 0.82;
  const dial2R = c * 0.7;
  const dashR = c * 0.56;
  const coreR = c * 0.31;
  const haloR = c * 0.38;
  const dialCirc = 2 * Math.PI * dialR;
  const dial2Circ = 2 * Math.PI * dial2R;
  const gradId = "coreGrad" + Math.random().toString(36).slice(2, 8);

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible;">
      <defs>
        <radialGradient id="${gradId}" cx="35%" cy="35%">
          <stop offset="0%" stop-color="#F2FFFF"/>
          <stop offset="45%" stop-color="${CYAN}"/>
          <stop offset="100%" stop-color="#0C8FAE" stop-opacity="0.08"/>
        </radialGradient>
      </defs>
      <circle cx="${c}" cy="${c}" r="${outerR}" fill="none" stroke="${CYAN}" stroke-width="0.6" stroke-dasharray="1.2 5" opacity="0.3"/>
      <g class="reactor-ticks" style="transform-origin:${c}px ${c}px;">${ticks}</g>
      <circle class="reactor-dial" cx="${c}" cy="${c}" r="${dialR}" fill="none" stroke="${CYAN}"
        stroke-width="${size * 0.045}" stroke-linecap="round"
        stroke-dasharray="${dialCirc * 0.76} ${dialCirc * 0.24}" opacity="0.92"
        style="transform-origin:${c}px ${c}px;"/>
      <circle class="reactor-dial2" cx="${c}" cy="${c}" r="${dial2R}" fill="none" stroke="#8FF0FF"
        stroke-width="${size * 0.013}" stroke-linecap="round"
        stroke-dasharray="${dial2Circ * 0.16} ${dial2Circ * 0.84}" opacity="0.6"
        style="transform-origin:${c}px ${c}px;"/>
      <circle class="reactor-dash" cx="${c}" cy="${c}" r="${dashR}" fill="none" stroke="${CYAN}"
        stroke-width="1" stroke-dasharray="3 6" opacity="0.5" style="transform-origin:${c}px ${c}px;"/>
      <circle class="reactor-halo" cx="${c}" cy="${c}" r="${haloR}" fill="none" stroke="${CYAN}" stroke-width="1" opacity="0.35" style="transform-origin:${c}px ${c}px;"/>
      <circle class="reactor-core" cx="${c}" cy="${c}" r="${coreR}" fill="url(#${gradId})" style="transform-origin:${c}px ${c}px;"/>
      <line x1="${c}" y1="${c - coreR * 0.55}" x2="${c}" y2="${c + coreR * 0.55}" stroke="#000305" stroke-width="1" opacity="0.5"/>
      <line x1="${c - coreR * 0.55}" y1="${c}" x2="${c + coreR * 0.55}" y2="${c}" stroke="#000305" stroke-width="1" opacity="0.5"/>
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
      this.dialVel = 55;
      this.tickVel = -14;
      this.dashVel = -34;
      this.pulsePhase = 0;
      this.pulseFreq = 0.5;
      this.dialEl = el.querySelector(".reactor-dial");
      this.dial2El = el.querySelector(".reactor-dial2");
      this.tickEl = el.querySelector(".reactor-ticks");
      this.dashEl = el.querySelector(".reactor-dash");
      this.haloEl = el.querySelector(".reactor-halo");
      this.coreEl = el.querySelector(".reactor-core");
    }

    setActive(active) {
      this.active = active;
    }

    tick(dt) {
      const targetDialVel = this.active ? 165 : 55;
      const targetTickVel = this.active ? -58 : -14;
      const targetDashVel = this.active ? -110 : -34;
      const targetPulseFreq = this.active ? 1.9 : 0.5;
      const rate = ease(dt, 2.6);

      this.dialVel += (targetDialVel - this.dialVel) * rate;
      this.tickVel += (targetTickVel - this.tickVel) * rate;
      this.dashVel += (targetDashVel - this.dashVel) * rate;
      this.pulseFreq += (targetPulseFreq - this.pulseFreq) * rate;

      this.dialAngle = (this.dialAngle + this.dialVel * dt) % 360;
      this.tickAngle = (this.tickAngle + this.tickVel * dt) % 360;
      this.dashAngle = (this.dashAngle + this.dashVel * dt) % 360;
      this.pulsePhase += dt * this.pulseFreq * Math.PI * 2;

      const pulseDepth = this.active ? 0.1 : 0.05;
      const scale = 1 + Math.sin(this.pulsePhase) * pulseDepth;
      const glowRadius = this.active ? 22 : 10;
      const glowAlpha = this.active ? 0.9 : 0.5;

      if (this.dialEl) {
        this.dialEl.style.transform = `rotate(${this.dialAngle}deg)`;
        this.dialEl.style.filter = `drop-shadow(0 0 ${glowRadius}px rgba(63,224,255,${glowAlpha}))`;
      }
      if (this.tickEl) this.tickEl.style.transform = `rotate(${this.tickAngle}deg)`;
      if (this.dashEl) this.dashEl.style.transform = `rotate(${this.dashAngle}deg)`;
      if (this.dial2El) this.dial2El.style.transform = `rotate(${-this.dashAngle * 1.6}deg)`;
      if (this.haloEl) this.haloEl.style.transform = `scale(${1 + Math.sin(this.pulsePhase) * pulseDepth * 1.6})`;
      if (this.coreEl) this.coreEl.style.transform = `scale(${scale})`;
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
// back to angle zero. Also keeps the `.active` class in sync — a few
// adjacent CSS rules (label color) key off it even though rotation
// itself no longer does.
function setReactorActive(container, active) {
  const inst = reactorInstances.get(container);
  if (inst) inst.setActive(!!active);
  container.classList.toggle("active", !!active);
}
