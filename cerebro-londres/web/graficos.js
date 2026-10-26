// Gráficos en SVG, sin librería. Proporción real (sin deformación), guías de referencia,
// coreografía de trazado en el compositor (prefers-reduced-motion respetado)
// y lectura interactiva punto a punto al pasar el puntero.
window.GRAFICOS = (function () {
  const ns = 'http://www.w3.org/2000/svg';
  const fmt = n => typeof n === 'number' ? new Intl.NumberFormat('es-ES').format(n) : String(n);

  // Observador único para activar el trazado de gráficos solo cuando entran en pantalla
  const ioGraficos = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            en.target.setAttribute('data-anim', 'visible');
            ioGraficos.unobserve(en.target);
          }
        });
      }, { threshold: 0.16 })
    : null;

  function registrarReveal(caja) {
    if (ioGraficos) {
      caja.setAttribute('data-anim', 'ready');
      ioGraficos.observe(caja);
    } else {
      caja.setAttribute('data-anim', 'visible');
    }
  }

  function marco(alto = 210) {
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', `0 0 680 ${alto}`);
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    s.setAttribute('width', '100%');
    s.setAttribute('role', 'img');
    return s;
  }

  function el(tipo, attrs, texto) {
    const e = document.createElementNS(ns, tipo);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (texto != null) e.textContent = texto;
    return e;
  }

  // Serie temporal: línea con área, línea de media, puntos, pulso de telemetría y barra interactiva
  function linea(puntos, titulo, opciones = {}) {
    const caja = document.createElement('div');
    caja.className = 'svgCaja';
    if (!puntos || puntos.length < 2) return caja;

    const formatear = opciones.formato || fmt;
    const A = 210;
    const M = { i: 12, d: 14, s: 24, f: 28 };
    const W = 680;
    const vals = puntos.map(p => Number(p[1]));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    const rango = max - min || 1;

    const x = i => M.i + (i / (puntos.length - 1)) * (W - M.i - M.d);
    const y = v => M.s + (1 - (v - min) / rango) * (A - M.s - M.f);

    // Barra superior de lectura viva (muestra el último dato por defecto y actualiza en hover)
    const ultimo = puntos[puntos.length - 1];
    const primero = puntos[0];
    const lector = document.createElement('div');
    lector.className = 'svgTooltip';
    const pintarLector = (par, etiquetaExtra) => {
      lector.innerHTML =
        `<span><strong>${par[0]}</strong>${etiquetaExtra ? ' · ' + etiquetaExtra : ''}</span>` +
        `<span><strong>${formatear(par[1])}</strong> (rango: ${formatear(min)} – ${formatear(max)})</span>`;
    };
    pintarLector(ultimo, 'último registro');
    caja.appendChild(lector);

    const s = marco(A);
    s.setAttribute('aria-label', `${titulo}: de ${primero[0]} a ${ultimo[0]}`);

    // Guías horizontales (máximo, media, mínimo)
    const yMax = y(max), yMed = y(media);
    s.appendChild(el('line', { class: 'guia', x1: M.i, y1: yMax, x2: W - M.d, y2: yMax }));
    s.appendChild(el('line', { class: 'guia', x1: M.i, y1: yMed, x2: W - M.d, y2: yMed }));
    s.appendChild(el('line', { class: 'eje', x1: M.i, y1: A - M.f, x2: W - M.d, y2: A - M.f }));

    // Área y línea de la serie
    const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    s.appendChild(el('path', { class: 'area', d: `${d}L${x(puntos.length - 1).toFixed(1)},${A - M.f}L${x(0).toFixed(1)},${A - M.f}Z` }));
    const pathLinea = el('path', { class: 'linea', d });
    s.appendChild(pathLinea);

    // Rótulos de referencia
    s.appendChild(el('text', { class: 'rotulo', x: M.i, y: 14 }, `MÁX ${formatear(max)}`));
    s.appendChild(el('text', { class: 'rotulo', x: W / 2, y: 14, 'text-anchor': 'middle' },
      `MEDIA ${formatear(Math.round(media * 10) / 10)}`));
    s.appendChild(el('text', { class: 'rotulo', x: W - M.d, y: 14, 'text-anchor': 'end' }, `MÍN ${formatear(min)}`));

    // Rótulos del eje X (inicio, medio y fin)
    s.appendChild(el('text', { class: 'rotulo', x: M.i, y: A - 8 }, primero[0]));
    if (puntos.length > 4) {
      const midIdx = Math.floor((puntos.length - 1) / 2);
      s.appendChild(el('text', { class: 'rotulo', x: x(midIdx), y: A - 8, 'text-anchor': 'middle' }, puntos[midIdx][0]));
    }
    s.appendChild(el('text', { class: 'rotulo', x: W - M.d, y: A - 8, 'text-anchor': 'end' }, ultimo[0]));

    // Cursor interactivo
    const guiaV = el('line', {
      class: 'guia', x1: x(puntos.length - 1), y1: M.s, x2: x(puntos.length - 1), y2: A - M.f,
      opacity: '0'
    });
    s.appendChild(guiaV);

    // Puntos de la serie
    if (puntos.length <= 36) {
      puntos.forEach((p, i) => {
        s.appendChild(el('circle', {
          class: 'punto',
          cx: x(i).toFixed(1),
          cy: y(p[1]).toFixed(1),
          r: i === puntos.length - 1 ? 4 : 2.5
        }));
      });
    }

    const cxUlt = x(puntos.length - 1).toFixed(1);
    const cyUlt = y(ultimo[1]).toFixed(1);

    // Halo pulsante de telemetría sobre el nodo activo
    const nodoPulso = el('circle', {
      class: 'puntoPulso',
      cx: cxUlt,
      cy: cyUlt,
      r: 5
    });
    s.appendChild(nodoPulso);

    const nodoActivo = el('circle', {
      class: 'puntoActivo',
      cx: cxUlt,
      cy: cyUlt,
      r: 4.5
    });
    s.appendChild(nodoActivo);

    // Interacción con puntero en rAF (lecturas primero, escrituras después — web-efectos-puntero)
    let rafId = 0;
    let clientX = 0;
    s.addEventListener('pointermove', ev => {
      clientX = ev.clientX;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const rect = s.getBoundingClientRect();
        if (!rect.width) return;
        const relX = ((clientX - rect.left) / rect.width) * W;
        const prop = Math.max(0, Math.min(1, (relX - M.i) / (W - M.i - M.d)));
        const idx = Math.round(prop * (puntos.length - 1));
        const p = puntos[idx];
        if (!p) return;
        const cx = x(idx).toFixed(1);
        const cy = y(p[1]).toFixed(1);
        guiaV.setAttribute('x1', cx);
        guiaV.setAttribute('x2', cx);
        guiaV.setAttribute('opacity', '1');
        nodoActivo.setAttribute('cx', cx);
        nodoActivo.setAttribute('cy', cy);
        nodoPulso.setAttribute('cx', cx);
        nodoPulso.setAttribute('cy', cy);
        pintarLector(p, `observación ${idx + 1}/${puntos.length}`);
      });
    });

    s.addEventListener('pointerleave', () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      guiaV.setAttribute('opacity', '0');
      nodoActivo.setAttribute('cx', cxUlt);
      nodoActivo.setAttribute('cy', cyUlt);
      nodoPulso.setAttribute('cx', cxUlt);
      nodoPulso.setAttribute('cy', cyUlt);
      pintarLector(ultimo, 'último registro');
    });

    caja.appendChild(s);
    registrarReveal(caja);
    return caja;
  }

  // Barras horizontales de precisión (con crecimiento scaleX escalonado en el compositor)
  function barras(filas, opciones = {}) {
    const caja = document.createElement('div');
    caja.className = 'svgCaja';
    if (!filas || !filas.length) return caja;

    const W = 680;
    const n = filas.length;
    const h = 24;
    const A = n * h + 10;
    const max = Math.max(...filas.map(f => Number(f[1]) || 0)) || 1;
    const anchoEtiqueta = opciones.anchoEtiqueta || 205;
    const margenValor = 88;
    const anchoUtil = W - anchoEtiqueta - margenValor;

    const s = marco(A);
    s.setAttribute('viewBox', `0 0 ${W} ${A}`);
    s.setAttribute('aria-label', opciones.titulo || 'Comparación por categoría');

    filas.forEach((f, i) => {
      const y = i * h + 4;
      const val = Number(f[1]) || 0;
      const esFoco = Boolean(f[2]);
      const ancho = (val / max) * anchoUtil;
      const g = el('g', { class: 'filaBarra' });

      const textoEtiqueta = String(f[0]).length > 29 ? String(f[0]).slice(0, 28) + '…' : String(f[0]);
      g.appendChild(el('text', {
        class: esFoco ? 'rotuloFoco' : 'rotulo',
        x: 0,
        y: y + 13
      }, esFoco ? `▸ ${textoEtiqueta}` : textoEtiqueta));

      // Track de fondo completo para comparar proporción visualmente
      g.appendChild(el('rect', {
        class: 'barraTrack',
        x: anchoEtiqueta,
        y: y + 2,
        width: anchoUtil,
        height: h - 9,
        rx: 1
      }));

      // Barra de valor con índice --row-i acotado para stagger rápido
      const rectBarra = el('rect', {
        class: 'barra' + (esFoco ? ' foco' : ''),
        x: anchoEtiqueta,
        y: y + 2,
        width: Math.max(ancho, 2),
        height: h - 9,
        rx: 1,
        style: `--row-i:${Math.min(i, 16)}`
      });
      g.appendChild(rectBarra);

      // Valor numérico alineado
      const valStr = opciones.formato ? opciones.formato(val) : fmt(val);
      g.appendChild(el('text', {
        class: esFoco ? 'rotuloFoco' : 'rotulo',
        x: anchoEtiqueta + anchoUtil + 8,
        y: y + 13
      }, valStr));

      s.appendChild(g);
    });

    caja.appendChild(s);
    registrarReveal(caja);
    return caja;
  }

  return { linea, barras, fmt };
})();
