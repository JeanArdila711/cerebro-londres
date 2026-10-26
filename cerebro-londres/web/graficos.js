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
            if (typeof en.target._alEntrar === 'function') {
              en.target._alEntrar();
              en.target._alEntrar = null;
            }
            ioGraficos.unobserve(en.target);
          }
        });
      }, { threshold: 0.14 })
    : null;

  function registrarReveal(caja) {
    if (ioGraficos) {
      caja.setAttribute('data-anim', 'ready');
      // Diferir observe al siguiente frame para asegurar que caja ya fue insertada en el DOM
      requestAnimationFrame(() => {
        if (caja.isConnected) {
          ioGraficos.observe(caja);
        } else {
          // Por si se inserta un micro-instante después
          setTimeout(() => ioGraficos.observe(caja), 30);
        }
      });
    } else {
      caja.setAttribute('data-anim', 'visible');
      if (typeof caja._alEntrar === 'function') caja._alEntrar();
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
    // Medir longitud geométrica exacta del trazo para que stroke-dashoffset arranque en 0ms sin hueco muerto
    let lenExacta = 900;
    try {
      if (typeof pathLinea.getTotalLength === 'function') {
        lenExacta = Math.ceil(pathLinea.getTotalLength() + 6);
      }
    } catch (_) {}
    pathLinea.style.setProperty('--path-len', String(lenExacta));
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

    // Puntos de la serie (con índice --pt-i para aparecer en cascada sincronizada con la línea)
    if (puntos.length <= 36) {
      puntos.forEach((p, i) => {
        s.appendChild(el('circle', {
          class: 'punto',
          cx: x(i).toFixed(1),
          cy: y(p[1]).toFixed(1),
          r: i === puntos.length - 1 ? 4 : 2.5,
          style: `--pt-i:${i};--pt-n:${puntos.length}`
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

  // Barras horizontales de precisión (con llenado animable al entrar en pantalla + conteo numérico en rAF)
  function barras(filas, opciones = {}) {
    const caja = document.createElement('div');
    caja.className = 'svgCaja';
    if (!filas || !filas.length) return caja;

    const W = 680;
    const n = filas.length;
    const h = 24;
    const A = n * h + 10;
    const max = opciones.maxGlobal || Math.max(...filas.map(f => Number(f[1]) || 0)) || 1;
    const anchoEtiqueta = opciones.anchoEtiqueta || 205;
    const margenValor = 88;
    const anchoUtil = W - anchoEtiqueta - margenValor;
    const formateador = opciones.formato || fmt;
    const sinMov = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const s = marco(A);
    s.setAttribute('viewBox', `0 0 ${W} ${A}`);
    s.setAttribute('aria-label', opciones.titulo || 'Comparación por categoría');

    const tareasBarras = [];

    filas.forEach((f, i) => {
      const y = i * h + 4;
      const val = Number(f[1]) || 0;
      const esFoco = Boolean(f[2]);
      const anchoFinal = Math.max((val / max) * anchoUtil, 2);
      const g = el('g', { class: 'filaBarra', style: `--row-i:${Math.min(i, 18)}` });

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

      // Barra de valor (inicia en 0px si las animaciones están activas para llenarse al llegar a la sección)
      const rectBarra = el('rect', {
        class: 'barra' + (esFoco ? ' foco' : ''),
        x: anchoEtiqueta,
        y: y + 2,
        width: sinMov ? anchoFinal.toFixed(1) : '0',
        height: h - 9,
        rx: 1
      });
      g.appendChild(rectBarra);

      // Valor numérico alineado
      const txtVal = el('text', {
        class: esFoco ? 'rotuloFoco' : 'rotulo',
        x: anchoEtiqueta + anchoUtil + 8,
        y: y + 13
      }, formateador(sinMov ? val : 0));
      g.appendChild(txtVal);

      tareasBarras.push({ rectBarra, txtVal, val, anchoFinal, idx: i });
      s.appendChild(g);
    });

    caja._alEntrar = () => {
      if (sinMov) return;
      const dur = 680;
      const t0 = performance.now();
      const tieneDec = tareasBarras.some(t => !Number.isInteger(t.val));

      const paso = ts => {
        let pendientes = false;
        tareasBarras.forEach(tb => {
          const delay = Math.min(tb.idx, 18) * 24;
          const elapsed = ts - t0 - delay;
          if (elapsed <= 0) {
            pendientes = true;
            return;
          }
          const p = Math.min(1, elapsed / dur);
          if (p < 1) pendientes = true;
          // Curva easeOutExpo para llenado de barra y conteo numérico sincronizado
          const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
          const wActual = tb.anchoFinal * ease;
          const vActual = tb.val * ease;
          tb.rectBarra.setAttribute('width', wActual.toFixed(1));
          tb.txtVal.textContent = formateador(tieneDec ? Number(vActual.toFixed(1)) : Math.round(vActual));
        });
        if (pendientes) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    };

    caja.appendChild(s);
    registrarReveal(caja);
    return caja;
  }

  // Micro-gráfico sparkline (Edward Tufte) para empotrar dentro de baldosas KPI
  function sparkline(puntos) {
    if (!puntos || puntos.length < 2) return '';
    const W = 128;
    const H = 26;
    const M = 3;
    const vals = puntos.map(p => Number(p[1]));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const rango = max - min || 1;
    const x = i => M + (i / (vals.length - 1)) * (W - M * 2);
    const y = v => M + (1 - (v - min) / rango) * (H - M * 2);

    const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const dArea = `${d}L${x(vals.length - 1).toFixed(1)},${H - 1}L${x(0).toFixed(1)},${H - 1}Z`;
    const cx0 = x(0).toFixed(1), cy0 = y(vals[0]).toFixed(1);
    const cxU = x(vals.length - 1).toFixed(1), cyU = y(vals[vals.length - 1]).toFixed(1);
    const deltaPct = vals[0] ? ((vals[vals.length - 1] - vals[0]) / Math.abs(vals[0])) * 100 : 0;
    const signo = deltaPct > 0.05 ? '+' : '';
    const deltaStr = `${signo}${deltaPct.toFixed(1).replace('.', ',')}%`;

    return (
      `<div class="tileSparkWrap" aria-hidden="true">` +
        `<svg class="sparklineSvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
          `<path class="sparkArea" d="${dArea}"/>` +
          `<path class="sparkPath" d="${d}"/>` +
          `<circle class="sparkDotIni" cx="${cx0}" cy="${cy0}" r="1.8"/>` +
          `<circle class="sparkDotFin" cx="${cxU}" cy="${cyU}" r="2.6"/>` +
        `</svg>` +
        `<span class="sparkMeta">${puntos[0][0]}→${puntos[puntos.length - 1][0]} <b>${deltaStr}</b></span>` +
      `</div>`
    );
  }

  // Regla de posición relativa (puesto 1..N entre boroughs de Londres) para baldosas de ranking
  function rangoMetropolitano(puesto, total = 33) {
    const p = Number(puesto);
    const t = Number(total) || 33;
    if (!p || p < 1 || p > t) return '';
    const pct = t > 1 ? ((p - 1) / (t - 1)) * 100 : 50;
    return (
      `<div class="tileRango" aria-hidden="true">` +
        `<div class="tileRangoTrack">` +
          `<span class="tileRangoFill" style="width:${pct.toFixed(1)}%"></span>` +
          `<span class="tileRangoPin" style="left:${pct.toFixed(1)}%"></span>` +
        `</div>` +
        `<div class="tileRangoEscala">` +
          `<span>1º</span>` +
          `<b>#${p} de ${t}</b>` +
          `<span>${t}º</span>` +
        `</div>` +
      `</div>`
    );
  }

  // Nube de dispersión bivariada (Scatter Plot) con recta de regresión OLS,
  // cuadrantes de medias metropolitanas, telemetría punto a punto y morphing suave entre variables
  function dispersion(puntosIniciales, opcionesIniciales = {}) {
    const caja = document.createElement('div');
    caja.className = 'svgCaja dispersionCaja';

    const W = 680;
    const A = 265;
    const M = { i: 56, d: 24, s: 26, f: 38 };

    const lector = document.createElement('div');
    lector.className = 'svgTooltip';
    caja.appendChild(lector);

    const s = marco(A);
    caja.appendChild(s);

    // Elementos estructurales persistentes para interpolar sin destruir el DOM
    const guiaH = el('line', { class: 'guia', x1: M.i, y1: A / 2, x2: W - M.d, y2: A / 2 });
    const guiaV = el('line', { class: 'guia', x1: W / 2, y1: M.s, x2: W / 2, y2: A - M.f });
    const ejeX = el('line', { class: 'eje', x1: M.i, y1: A - M.f, x2: W - M.d, y2: A - M.f });
    const ejeY = el('line', { class: 'eje', x1: M.i, y1: M.s, x2: M.i, y2: A - M.f });

    const lblYMax = el('text', { class: 'rotulo', x: M.i - 6, y: M.s + 8, 'text-anchor': 'end' });
    const lblYMed = el('text', { class: 'rotulo', x: M.i - 6, y: A / 2, 'text-anchor': 'end' });
    const lblYMin = el('text', { class: 'rotulo', x: M.i - 6, y: A - M.f, 'text-anchor': 'end' });

    const lblXMin = el('text', { class: 'rotulo', x: M.i, y: A - 20 });
    const lblXMed = el('text', { class: 'rotulo', x: W / 2, y: A - 20, 'text-anchor': 'middle' });
    const lblXMax = el('text', { class: 'rotulo', x: W - M.d, y: A - 20, 'text-anchor': 'end' });

    const tituloEjeX = el('text', { class: 'rotuloFoco', x: W / 2, y: A - 5, 'text-anchor': 'middle' });
    const tituloEjeY = el('text', { class: 'rotuloFoco', x: M.i + 6, y: 14 });

    const pathReg = el('path', { class: 'rectaRegresion', d: `M${M.i},${A / 2}L${W - M.d},${A / 2}` });
    const miraH = el('line', { class: 'guiaMira', x1: M.i, y1: A / 2, x2: W - M.d, y2: A / 2, opacity: '0' });
    const miraV = el('line', { class: 'guiaMira', x1: W / 2, y1: M.s, x2: W / 2, y2: A - M.f, opacity: '0' });
    const capaNodos = el('g', { class: 'capaNodosDisp' });

    [
      guiaH, guiaV, ejeX, ejeY,
      lblYMax, lblYMed, lblYMin,
      lblXMin, lblXMed, lblXMax,
      tituloEjeX, tituloEjeY,
      pathReg, miraH, miraV, capaNodos
    ].forEach(n => s.appendChild(n));

    const mapaNodos = {}; // clave por codigo o nombre -> { g, circ, pulso, txt, cx, cy, pt }
    let estadoActual = null;
    let rafMorph = 0;

    function calcularModelo(puntos, opciones) {
      const validos = (puntos || []).filter(p => typeof p.x === 'number' && !isNaN(p.x) && typeof p.y === 'number' && !isNaN(p.y));
      if (validos.length < 3) return null;

      const fmtX = opciones.fmtX || fmt;
      const fmtY = opciones.fmtY || fmt;
      const etiqX = opciones.etiquetaX || 'Variable X';
      const etiqY = opciones.etiquetaY || 'Variable Y';

      const xs = validos.map(p => p.x);
      const ys = validos.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const spanX = (maxX - minX) || 1;
      const spanY = (maxY - minY) || 1;
      const x0 = minX - spanX * 0.06, x1 = maxX + spanX * 0.06;
      const y0 = minY - spanY * 0.08, y1 = maxY + spanY * 0.08;

      const px = v => M.i + ((v - x0) / (x1 - x0)) * (W - M.i - M.d);
      const py = v => M.s + (1 - (v - y0) / (y1 - y0)) * (A - M.s - M.f);

      const n = validos.length;
      const medX = xs.reduce((a, b) => a + b, 0) / n;
      const medY = ys.reduce((a, b) => a + b, 0) / n;
      let sXY = 0, sXX = 0, sYY = 0;
      validos.forEach(p => {
        const dx = p.x - medX;
        const dy = p.y - medY;
        sXY += dx * dy;
        sXX += dx * dx;
        sYY += dy * dy;
      });
      const r = (sXX > 0 && sYY > 0) ? sXY / Math.sqrt(sXX * sYY) : 0;
      const pend = sXX > 0 ? sXY / sXX : 0;
      const inter = medY - pend * medX;
      const foco = validos.find(p => p.foco) || validos[0];

      const coords = {};
      validos.forEach(pt => {
        const id = pt.codigo || pt.nombre;
        coords[id] = { cx: px(pt.x), cy: py(pt.y), pt };
      });

      return {
        validos, fmtX, fmtY, etiqX, etiqY,
        minX, maxX, minY, maxY, medX, medY,
        xMedPx: px(medX), yMedPx: py(medY),
        regX1: px(minX), regY1: py(pend * minX + inter),
        regX2: px(maxX), regY2: py(pend * maxX + inter),
        r, n, foco, coords
      };
    }

    function pintarLector(mod, pt, rol) {
      if (!mod || !pt) return;
      const rStr = (mod.r >= 0 ? '+' : '') + mod.r.toFixed(2).replace('.', ',');
      lector.innerHTML =
        `<span><strong>${pt.nombre}</strong>${rol ? ' · ' + rol : ''} · <code>r = ${rStr} (n=${mod.n})</code></span>` +
        `<span>${mod.etiqX}: <strong>${mod.fmtX(pt.x)}</strong> · ${mod.etiqY}: <strong>${mod.fmtY(pt.y)}</strong></span>`;
    }

    function actualizarRótulosEjes(mod) {
      s.setAttribute('aria-label', `Dispersión bivariada: ${mod.etiqX} contra ${mod.etiqY}`);
      lblYMax.textContent = mod.fmtY(mod.maxY);
      lblYMed.textContent = `x̄ ${mod.fmtY(Math.round(mod.medY * 10) / 10)}`;
      lblYMin.textContent = mod.fmtY(mod.minY);
      lblXMin.textContent = mod.fmtX(mod.minX);
      lblXMed.textContent = `MEDIA ${mod.fmtX(Math.round(mod.medX * 10) / 10)}`;
      lblXMax.textContent = mod.fmtX(mod.maxX);
      tituloEjeX.textContent = `EJE X: ${mod.etiqX.toUpperCase()}`;
      tituloEjeY.textContent = `EJE Y: ${mod.etiqY.toUpperCase()}`;
      pintarLector(mod, mod.foco, 'foco Westminster');
    }

    function posicionarNodo(nodo, cx, cy) {
      const xStr = cx.toFixed(1);
      const yStr = cy.toFixed(1);
      nodo.circ.setAttribute('cx', xStr);
      nodo.circ.setAttribute('cy', yStr);
      if (nodo.pulso) {
        nodo.pulso.setAttribute('cx', xStr);
        nodo.pulso.setAttribute('cy', yStr);
      }
      if (nodo.txt) {
        const alineaDer = cx > W - 150;
        nodo.txt.setAttribute('x', (alineaDer ? cx - 9 : cx + 9).toFixed(1));
        nodo.txt.setAttribute('y', (cy + 4).toFixed(1));
        nodo.txt.setAttribute('text-anchor', alineaDer ? 'end' : 'start');
      }
      nodo.cx = cx;
      nodo.cy = cy;
    }

    caja.actualizar = (nuevosPuntos, nuevasOpciones = {}) => {
      const sig = calcularModelo(nuevosPuntos, nuevasOpciones);
      if (!sig) return;

      if (rafMorph) {
        cancelAnimationFrame(rafMorph);
        rafMorph = 0;
      }
      miraH.setAttribute('opacity', '0');
      miraV.setAttribute('opacity', '0');
      actualizarRótulosEjes(sig);

      // Asegurar que todos los nodos existan en el SVG (Westminster al final para quedar arriba)
      const ordenados = sig.validos.slice().sort((a, b) => (a.foco ? 1 : 0) - (b.foco ? 1 : 0));
      ordenados.forEach(pt => {
        const id = pt.codigo || pt.nombre;
        const dest = sig.coords[id];
        if (!mapaNodos[id]) {
          const gPt = el('g', { class: pt.foco ? 'nodoDispFoco' : 'nodoDisp' });
          let pulso = null;
          let txt = null;
          if (pt.foco) {
            pulso = el('circle', { class: 'puntoPulso', cx: dest.cx.toFixed(1), cy: dest.cy.toFixed(1), r: 7 });
            gPt.appendChild(pulso);
          }
          const circ = el('circle', {
            class: pt.foco ? 'puntoActivo' : 'puntoBorough',
            cx: dest.cx.toFixed(1),
            cy: dest.cy.toFixed(1),
            r: pt.foco ? 5.5 : 4.2
          });
          gPt.appendChild(circ);
          if (pt.foco) {
            txt = el('text', { class: 'rotuloFoco' }, 'WESTMINSTER');
            gPt.appendChild(txt);
          }

          const registro = { g: gPt, circ, pulso, txt, cx: dest.cx, cy: dest.cy, pt };
          posicionarNodo(registro, dest.cx, dest.cy);

          gPt.addEventListener('pointerenter', () => {
            const xStr = registro.cx.toFixed(1);
            const yStr = registro.cy.toFixed(1);
            miraH.setAttribute('y1', yStr);
            miraH.setAttribute('y2', yStr);
            miraH.setAttribute('opacity', '1');
            miraV.setAttribute('x1', xStr);
            miraV.setAttribute('x2', xStr);
            miraV.setAttribute('opacity', '1');
            if (estadoActual) {
              pintarLector(estadoActual, registro.pt, registro.pt.foco ? 'foco Westminster' : registro.pt.codigo || 'borough');
            }
          });

          capaNodos.appendChild(gPt);
          mapaNodos[id] = registro;
        } else {
          mapaNodos[id].pt = pt;
          mapaNodos[id].g.style.display = '';
        }
      });

      // Ocultar nodos que no tengan dato en este cruce particular
      Object.keys(mapaNodos).forEach(id => {
        if (!sig.coords[id]) mapaNodos[id].g.style.display = 'none';
      });

      const sinMov = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!estadoActual || sinMov) {
        guiaH.setAttribute('y1', sig.yMedPx.toFixed(1));
        guiaH.setAttribute('y2', sig.yMedPx.toFixed(1));
        lblYMed.setAttribute('y', sig.yMedPx.toFixed(1));
        guiaV.setAttribute('x1', sig.xMedPx.toFixed(1));
        guiaV.setAttribute('x2', sig.xMedPx.toFixed(1));
        lblXMed.setAttribute('x', sig.xMedPx.toFixed(1));
        pathReg.setAttribute('d', `M${sig.regX1.toFixed(1)},${sig.regY1.toFixed(1)}L${sig.regX2.toFixed(1)},${sig.regY2.toFixed(1)}`);
        Object.keys(sig.coords).forEach(id => {
          posicionarNodo(mapaNodos[id], sig.coords[id].cx, sig.coords[id].cy);
        });
        estadoActual = sig;
        return;
      }

      // Capturar estado de origen para interpolar a 60fps con curva S / easeOutExpo
      const prev = {
        xMedPx: parseFloat(guiaV.getAttribute('x1')) || estadoActual.xMedPx,
        yMedPx: parseFloat(guiaH.getAttribute('y1')) || estadoActual.yMedPx,
        regX1: estadoActual.regX1,
        regY1: estadoActual.regY1,
        regX2: estadoActual.regX2,
        regY2: estadoActual.regY2,
        nodos: {}
      };
      Object.keys(sig.coords).forEach(id => {
        const n = mapaNodos[id];
        prev.nodos[id] = { cx: n ? n.cx : sig.coords[id].cx, cy: n ? n.cy : sig.coords[id].cy };
      });

      estadoActual = sig;
      let t0 = null;
      const dur = 640;

      const pasoMorph = ts => {
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / dur);
        // Curva quintic out suave para el viaje de las 33 burbujas en el plano cartesiano
        const ease = 1 - Math.pow(1 - p, 4);

        const curXMed = prev.xMedPx + (sig.xMedPx - prev.xMedPx) * ease;
        const curYMed = prev.yMedPx + (sig.yMedPx - prev.yMedPx) * ease;
        guiaH.setAttribute('y1', curYMed.toFixed(1));
        guiaH.setAttribute('y2', curYMed.toFixed(1));
        lblYMed.setAttribute('y', curYMed.toFixed(1));
        guiaV.setAttribute('x1', curXMed.toFixed(1));
        guiaV.setAttribute('x2', curXMed.toFixed(1));
        lblXMed.setAttribute('x', curXMed.toFixed(1));

        const rx1 = prev.regX1 + (sig.regX1 - prev.regX1) * ease;
        const ry1 = prev.regY1 + (sig.regY1 - prev.regY1) * ease;
        const rx2 = prev.regX2 + (sig.regX2 - prev.regX2) * ease;
        const ry2 = prev.regY2 + (sig.regY2 - prev.regY2) * ease;
        pathReg.setAttribute('d', `M${rx1.toFixed(1)},${ry1.toFixed(1)}L${rx2.toFixed(1)},${ry2.toFixed(1)}`);

        Object.keys(sig.coords).forEach(id => {
          const orig = prev.nodos[id];
          const dest = sig.coords[id];
          const cx = orig.cx + (dest.cx - orig.cx) * ease;
          const cy = orig.cy + (dest.cy - orig.cy) * ease;
          posicionarNodo(mapaNodos[id], cx, cy);
        });

        if (p < 1) {
          rafMorph = requestAnimationFrame(pasoMorph);
        } else {
          rafMorph = 0;
        }
      };
      rafMorph = requestAnimationFrame(pasoMorph);
    };

    s.addEventListener('pointerleave', () => {
      miraH.setAttribute('opacity', '0');
      miraV.setAttribute('opacity', '0');
      if (estadoActual) pintarLector(estadoActual, estadoActual.foco, 'foco Westminster');
    });

    caja.actualizar(puntosIniciales, opcionesIniciales);
    registrarReveal(caja);
    return caja;
  }

  return { linea, barras, sparkline, rangoMetropolitano, dispersion, fmt };
})();
