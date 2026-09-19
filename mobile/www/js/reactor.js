// Builds the reactor SVG markup — the HUD circle that spins and pulses.
// Kept as a single function so every screen renders an identical reactor,
// just at a different size, and toggling `.active` on the wrapper is all
// that's needed to speed it up (see .reactor-wrap.active rules in CSS).
function renderReactor(size) {
  const c = size / 2;
  const svgNS = "http://www.w3.org/2000/svg";

  const majorTicks = [0, 90, 180, 270];
  const minorTicks = [22.5, 45, 67.5, 112.5, 135, 157.5, 202.5, 225, 247.5, 292.5, 315, 337.5];

  let ticks = "";
  for (const angle of majorTicks) {
    ticks += `<line x1="${c}" y1="4" x2="${c}" y2="18" stroke="#26CFFF" stroke-width="2.5" transform="rotate(${angle} ${c} ${c})"/>`;
  }
  for (const angle of minorTicks) {
    ticks += `<line x1="${c}" y1="4" x2="${c}" y2="13" stroke="#26CFFF" stroke-width="1.1" opacity="0.5" transform="rotate(${angle} ${c} ${c})"/>`;
  }

  const dialR = c * 0.82;
  const dashR = c * 0.58;
  const coreR = c * 0.32;
  const dialCirc = 2 * Math.PI * dialR;
  const gradId = "coreGrad" + Math.random().toString(36).slice(2, 8);

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="${gradId}" cx="35%" cy="35%">
          <stop offset="0%" stop-color="#BFF6FF"/>
          <stop offset="55%" stop-color="#17B7FF"/>
          <stop offset="100%" stop-color="#17B7FF" stop-opacity="0.05"/>
        </radialGradient>
      </defs>
      <g class="reactor-ticks">${ticks}</g>
      <circle class="reactor-dial" cx="${c}" cy="${c}" r="${dialR}" fill="none" stroke="#26CFFF"
        stroke-width="${size * 0.045}" stroke-linecap="round"
        stroke-dasharray="${dialCirc * 0.76} ${dialCirc * 0.24}" opacity="0.92"/>
      <circle class="reactor-dash" cx="${c}" cy="${c}" r="${dashR}" fill="none" stroke="#26CFFF"
        stroke-width="1" stroke-dasharray="4 7" opacity="0.55"/>
      <circle class="reactor-core" cx="${c}" cy="${c}" r="${coreR}" fill="url(#${gradId})"/>
    </svg>`;
}

function mountReactor(container, size, active) {
  container.classList.add("reactor-wrap");
  container.classList.toggle("active", !!active);
  container.style.width = size + "px";
  container.style.height = size + "px";
  container.innerHTML = renderReactor(size);
}
