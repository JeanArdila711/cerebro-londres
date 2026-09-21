// Gráficos en SVG, sin librería. Lo justo para que una serie se vea.
window.GRAFICOS = (function () {
  const ns = 'http://www.w3.org/2000/svg';
  const fmt = n => new Intl.NumberFormat('es-ES').format(n);

  function marco(alto = 180) {
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', `0 0 640 ${alto}`);
    s.setAttribute('preserveAspectRatio', 'none');
    s.setAttribute('width', '100%');
    s.setAttribute('height', alto);
    s.setAttribute('role', 'img');
    return s;
  }

  function el(tipo, attrs, texto) {
    const e = document.createElementNS(ns, tipo);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (texto != null) e.textContent = texto;
    return e;
  }

  // Serie temporal: línea con área, primer y último rótulo
  function linea(puntos, titulo) {
    const caja = document.createElement('div');
    caja.className = 'svgCaja';
    if (!puntos || puntos.length < 2) return caja;
    const A = 180, M = { i: 8, d: 8, s: 14, f: 24 };
    const vals = puntos.map(p => p[1]);
    const min = Math.min(...vals), max = Math.max(...vals);
    const rango = max - min || 1;
    const x = i => M.i + (i / (puntos.length - 1)) * (640 - M.i - M.d);
    const y = v => M.s + (1 - (v - min) / rango) * (A - M.s - M.f);

    const s = marco(A);
    s.setAttribute('aria-label', `${titulo}: de ${puntos[0][0]} a ${puntos[puntos.length - 1][0]}`);
    const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    s.appendChild(el('path', { class: 'area', d: `${d}L${x(puntos.length - 1)},${A - M.f}L${x(0)},${A - M.f}Z` }));
    s.appendChild(el('path', { class: 'linea', d }));
    s.appendChild(el('line', { class: 'eje', x1: M.i, y1: A - M.f, x2: 640 - M.d, y2: A - M.f }));
    s.appendChild(el('text', { class: 'rotulo', x: M.i, y: A - 8 }, puntos[0][0]));
    const fin = el('text', { class: 'rotulo', x: 640 - M.d, y: A - 8, 'text-anchor': 'end' },
      puntos[puntos.length - 1][0]);
    s.appendChild(fin);
    s.appendChild(el('text', { class: 'rotulo', x: M.i, y: 11 }, `máx ${fmt(max)}`));
    s.appendChild(el('text', { class: 'rotulo', x: 640 - M.d, y: 11, 'text-anchor': 'end' },
      `mín ${fmt(min)}`));
    caja.appendChild(s);
    return caja;
  }

  // Barras horizontales, con el foco resaltado
  function barras(filas, opciones = {}) {
    const caja = document.createElement('div');
    caja.className = 'svgCaja';
    if (!filas || !filas.length) return caja;
    const n = filas.length, h = 22, A = n * h + 10;
    const max = Math.max(...filas.map(f => f[1])) || 1;
    const anchoEtiqueta = opciones.anchoEtiqueta || 210;
    const s = marco(A);
    s.setAttribute('viewBox', `0 0 640 ${A}`);
    s.setAttribute('aria-label', opciones.titulo || 'Comparación');
    filas.forEach((f, i) => {
      const y = i * h + 4;
      const ancho = (f[1] / max) * (640 - anchoEtiqueta - 66);
      s.appendChild(el('text', { class: 'rotulo', x: 0, y: y + 12 },
        String(f[0]).length > 30 ? String(f[0]).slice(0, 29) + '…' : f[0]));
      s.appendChild(el('rect', {
        class: 'barra' + (f[2] ? ' foco' : ''), x: anchoEtiqueta, y, width: Math.max(ancho, 1),
        height: h - 7, rx: 3
      }));
      s.appendChild(el('text', {
        class: 'rotulo', x: anchoEtiqueta + ancho + 6, y: y + 12
      }, opciones.formato ? opciones.formato(f[1]) : fmt(f[1])));
    });
    caja.appendChild(s);
    return caja;
  }

  return { linea, barras, fmt };
})();
