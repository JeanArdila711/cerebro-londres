// Gemelo Digital Territorial · MapLibre GL 3D
// Integra:
//   1. Coropleta multicapa de los 33 boroughs (6 métricas del lago) + Extrusión 3D de prismas de datos
//   2. Malla de 18 wards del City of Westminster (con etiquetas vectoriales) y 704 wards de Greater London
//   3. Extrusión volumétrica 3D de todos los edificios de Londres (OpenMapTiles building)
//   4. 205 monumentos Grado I de Historic England en Westminster + nodos de riesgo mareal (Environment Agency)
//   5. Telemetría HUD interactiva en tiempo real y vuelos cinemáticos de cámara
window.MAPA = (function () {
  let mapa = null;
  let lugares = [];
  let metricaActual = 'precio';
  let modoPrisma3D = false;

  const fmtInt = n => typeof n === 'number' ? new Intl.NumberFormat('es-ES').format(Math.round(n)) : '—';
  const fmtDec = n => typeof n === 'number' ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n) : '—';
  const fmtGBP = n => typeof n === 'number' ? '£' + new Intl.NumberFormat('es-ES').format(Math.round(n)) : '—';

  const METRICAS = {
    precio: {
      campo: 'precio',
      titulo: 'Precio medio vivienda',
      unidad: '£ (UK HPI)',
      fmt: fmtGBP,
      escala: ['#d9e2ec', '#9fb3c8', '#627d98', '#334e68', '#c8281e'],
      factorAltura: 0.0055 // ~6.600m para £1.2M
    },
    densidad: {
      campo: 'densidad',
      titulo: 'Densidad poblacional',
      unidad: 'hab/km² (ONS)',
      fmt: n => fmtInt(n) + ' hab/km²',
      escala: ['#e3ebe6', '#a8c7b5', '#62967b', '#2b6348', '#c8281e'],
      factorAltura: 0.38
    },
    tax: {
      campo: 'tax',
      titulo: 'Council Tax Banda D',
      unidad: '£ / año (MHCLG)',
      fmt: fmtGBP,
      escala: ['#f2ebdc', '#d8c39e', '#b3925f', '#7d5c29', '#1d4e89'],
      factorAltura: 2.8
    },
    delitos: {
      campo: 'delitos_tasa',
      titulo: 'Tasa delitos registrados',
      unidad: 'por 1.000 hab (MPS)',
      fmt: n => fmtDec(n) + ' /1k',
      escala: ['#f7e6e4', '#e5b0aa', '#cf7168', '#9e3329', '#c8281e'],
      factorAltura: 18
    },
    imd: {
      campo: 'imd',
      titulo: 'Privación media (IMD)',
      unidad: 'puntaje IoD2025',
      fmt: n => fmtDec(n) + ' pts',
      escala: ['#e6e9f2', '#b1bcd9', '#7386b5', '#3b5187', '#c8281e'],
      factorAltura: 180
    },
    vida: {
      campo: 'vida',
      titulo: 'Esperanza de vida',
      unidad: 'años al nacer (OHID)',
      fmt: n => fmtDec(n) + ' años',
      escala: ['#e1f0ec', '#9fd1c4', '#56a390', '#1f6b59', '#1d4e89'],
      factorAltura: 70
    }
  };

  function cuantiles(valores, n) {
    const v = valores.filter(x => typeof x === 'number' && !isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return [1, 2, 3, 4];
    const cortes = [];
    for (let i = 1; i < n; i++) cortes.push(v[Math.floor(i * v.length / n)]);
    return cortes;
  }

  function centroide(g) {
    if (!g || !g.coordinates) return [-0.1357, 51.4975];
    const partes = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    let x = 0, y = 0, n = 0;
    partes.forEach(p => (p[0] || []).forEach(c => { x += c[0]; y += c[1]; n++; }));
    return n ? [x / n, y / n] : [-0.1357, 51.4975];
  }

  function parsearWktPoint(wkt) {
    if (typeof wkt !== 'string') return null;
    const m = /POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)/i.exec(wkt);
    if (!m) return null;
    return [parseFloat(m[1]), parseFloat(m[2])];
  }

  async function init(LAGO) {
    const caja = document.getElementById('mapa');
    if (!caja || typeof maplibregl === 'undefined') return;

    let boroughs, wardsWestminster, wardsLondres = null;
    try {
      [boroughs, wardsWestminster] = await Promise.all([
        window.cargarGeo('boroughs'),
        window.cargarGeo('wards_westminster')
      ]);
    } catch (e) {
      caja.innerHTML = '<p style="padding:20px;color:#fff">No se pudieron cargar las geometrías base del territorio.</p>';
      return;
    }

    // 1. Cruzar todas las métricas de los 33 boroughs sobre el GeoJSON
    const porCodigo = {};
    const porNombre = {};

    const norm = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

    ((LAGO.atlas_boroughs || {}).listas || {}).boroughs?.forEach(b => {
      porCodigo[b.codigo] = Object.assign(porCodigo[b.codigo] || {}, {
        precio: b.precio_medio_gbp || null,
        poblacion: b.poblacion || null,
        densidad: b.densidad_hab_km2 || null,
        area_km2: b.area_km2 || null
      });
      porNombre[norm(b.nombre)] = b.codigo;
    });

    ((LAGO.finanzas || {}).listas || {}).boroughs?.forEach(b => {
      if (porCodigo[b.codigo]) {
        porCodigo[b.codigo].tax = b.council_tax_banda_d || null;
        porCodigo[b.codigo].tax_puesto = b.puesto || null;
      }
    });

    ((LAGO.seguridad_boroughs || {}).listas || {}).boroughs?.forEach(b => {
      const cod = porNombre[norm(b.nombre)];
      if (cod && porCodigo[cod]) {
        porCodigo[cod].delitos_tasa = b.tasa_x1000 || null;
        porCodigo[cod].delitos_12m = b.delitos_12m || null;
      }
    });

    ((LAGO.privacion || {}).listas || {}).ranking_boroughs?.forEach(b => {
      const cod = porNombre[norm(b.nombre)];
      if (cod && porCodigo[cod]) {
        porCodigo[cod].imd = b.score_medio || null;
        porCodigo[cod].imd_puesto = b.puesto_privacion || null;
      }
    });

    ((LAGO.salud || {}).listas || {}).boroughs?.forEach(b => {
      const cod = porNombre[norm(b.nombre)];
      if (cod && porCodigo[cod]) {
        porCodigo[cod].vida = b.promedio || null;
        porCodigo[cod].vida_brecha = b.brecha_mujer_hombre || null;
      }
    });

    ((LAGO.transporte_boroughs || {}).listas || {}).boroughs?.forEach(b => {
      const cod = porNombre[norm(b.nombre)];
      if (cod && porCodigo[cod]) {
        porCodigo[cod].paradas = b.paradas_n || null;
      }
    });

    boroughs.features.forEach(f => {
      const cod = f.properties.codigo;
      const d = porCodigo[cod] || {};
      Object.assign(f.properties, d);
    });

    // Centroides de wards de Westminster para rótulos nítidos
    const wardsCentroides = {
      type: 'FeatureCollection',
      features: wardsWestminster.features.map(f => ({
        type: 'Feature',
        properties: { nombre: f.properties.nombre, codigo: f.properties.codigo },
        geometry: { type: 'Point', coordinates: centroide(f.geometry) }
      }))
    };

    // GeoJSON de los 205 edificios Grado I de Historic England en Westminster
    const gradoILista = ((LAGO.patrimonio || {}).listas || {}).grado_i || [];
    const patrimonioGeo = {
      type: 'FeatureCollection',
      features: gradoILista.map(item => {
        const coords = parsearWktPoint(item.punto);
        if (!coords) return null;
        return {
          type: 'Feature',
          properties: {
            nombre: item.nombre.replace(/\s*\(See details.*\)$/i, ''),
            referencia: item.referencia,
            url: item.documentacion
          },
          geometry: { type: 'Point', coordinates: coords }
        };
      }).filter(Boolean)
    };

    // GeoJSON de nodos de riesgo de inundación (Environment Agency)
    const riesgoLista = ((LAGO.riesgo || {}).listas || {}).zonas || [];
    const riesgoGeo = {
      type: 'FeatureCollection',
      features: riesgoLista.map(z => {
        const coords = parsearWktPoint(z.punto);
        if (!coords) return null;
        return {
          type: 'Feature',
          properties: {
            referencia: z.referencia,
            nivel: z.nivel,
            tipo: z.tipo
          },
          geometry: { type: 'Point', coordinates: coords }
        };
      }).filter(Boolean)
    };

    // Función para actualizar el panel HUD lateral con todos los datos de un borough (con interpolación numérica viva)
    let hudEstadoPrev = {};
    let hudCodigoPrev = null;

    function animarHudValor(el, desde, hasta, formateador) {
      if (!el || typeof hasta !== 'number' || isNaN(hasta)) {
        if (el) el.textContent = '—';
        return;
      }
      if (el._rafHud) {
        cancelAnimationFrame(el._rafHud);
        el._rafHud = 0;
      }
      const sinMov = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (sinMov || typeof desde !== 'number' || isNaN(desde) || Math.abs(hasta - desde) < 1e-4) {
        el.textContent = formateador(hasta);
        return;
      }
      let t0 = null;
      const dur = 340;
      const tick = ts => {
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = formateador(desde + (hasta - desde) * ease);
        if (p < 1) {
          el._rafHud = requestAnimationFrame(tick);
        } else {
          el._rafHud = 0;
          el.textContent = formateador(hasta);
        }
      };
      el._rafHud = requestAnimationFrame(tick);
    }

    function pintarHUD(p, etiquetaKicker) {
      if (!p) return;
      const k = document.getElementById('hudKicker');
      const t = document.getElementById('hudTitulo');
      const s = document.getElementById('hudSub');
      const m = document.getElementById('hudMetricas');
      if (!t || !m) return;

      if (k) k.textContent = etiquetaKicker || 'TELEMETRÍA TERRITORIAL · BOROUGH';
      t.textContent = p.nombre || 'Westminster';
      if (s) s.textContent = `${p.codigo || 'E09000033'} · ${p.area_km2 ? fmtDec(p.area_km2) + ' km²' : 'Greater London'} · ${p.poblacion ? fmtInt(p.poblacion) + ' hab' : ''}`;

      const defs = [
        { k: 'precio',   nom: 'Precio vivienda', val: p.precio,       fmt: fmtGBP },
        { k: 'densidad', nom: 'Densidad',        val: p.densidad,     fmt: v => fmtInt(v) + ' /km²' },
        { k: 'tax',      nom: 'Council Tax D',   val: p.tax,          fmt: fmtGBP },
        { k: 'delitos',  nom: 'Tasa delitos',    val: p.delitos_tasa, fmt: v => fmtDec(v) + ' /1k' },
        { k: 'imd',      nom: 'Privación IMD',   val: p.imd,          fmt: v => fmtDec(v) + ' pts' },
        { k: 'vida',     nom: 'Esperanza vida',  val: p.vida,         fmt: v => fmtDec(v) + ' años' },
      ];

      if (!m.querySelector('.hudDato')) {
        m.innerHTML = defs.map(d =>
          `<div class="hudDato" data-hk="${d.k}">` +
            `<span>${d.nom}</span><strong>—</strong>` +
          `</div>`
        ).join('');
      }

      const cambioBorough = hudCodigoPrev !== p.codigo;
      defs.forEach(d => {
        const nodo = m.querySelector(`.hudDato[data-hk="${d.k}"]`);
        if (!nodo) return;
        nodo.classList.toggle('activo', metricaActual === d.k);
        const strong = nodo.querySelector('strong');
        const numVal = d.val != null && d.val !== '' ? Number(d.val) : null;
        if (numVal != null && !isNaN(numVal)) {
          if (cambioBorough && hudEstadoPrev[d.k] != null) {
            animarHudValor(strong, hudEstadoPrev[d.k], numVal, d.fmt);
          } else {
            strong.textContent = d.fmt(numVal);
          }
          hudEstadoPrev[d.k] = numVal;
        } else {
          strong.textContent = '—';
        }
      });
      hudCodigoPrev = p.codigo;
    }

    // Inicializar HUD con Westminster por defecto
    const westminsterProps = boroughs.features.find(f => f.properties.codigo === 'E09000033')?.properties;
    if (westminsterProps) pintarHUD(westminsterProps, 'FOCO DEL EXPEDIENTE · SELECCIONADO');

    // Plano vectorial táctico SVG de los 18 wards de Westminster en el Masthead de portada
    function pintarMiniMapaPortada(wardsGeo) {
      const cont = document.getElementById('miniMapaWestminster');
      const lectura = document.getElementById('miniMapaLectura');
      if (!cont || !wardsGeo || !wardsGeo.features || !wardsGeo.features.length) return;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const recorrerAnillos = (geom, cb) => {
        if (!geom || !geom.coordinates) return;
        const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
        polys.forEach(poly => poly.forEach(ring => cb(ring)));
      };

      wardsGeo.features.forEach(f => {
        recorrerAnillos(f.geometry, ring => {
          ring.forEach(([lon, lat]) => {
            if (lon < minX) minX = lon;
            if (lon > maxX) maxX = lon;
            if (lat < minY) minY = lat;
            if (lat > maxY) maxY = lat;
          });
        });
      });

      const W = 380;
      const H = 220;
      const PAD = 14;
      // Corrección cos(lat) para que la proporción geográfica en 51.5°N sea exacta y sin achatamiento
      const cosLat = Math.cos(((minY + maxY) * 0.5 * Math.PI) / 180);
      const spanX = (maxX - minX) * cosLat || 0.01;
      const spanY = (maxY - minY) || 0.01;
      const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
      const offX = (W - spanX * scale) / 2;
      const offY = (H - spanY * scale) / 2;

      const proyX = lon => offX + (lon - minX) * cosLat * scale;
      const proyY = lat => H - offY - (lat - minY) * scale;

      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('class', 'miniMapaSvg');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Mapa interactivo de los 18 wards electorales de Westminster');

      // Retícula técnica de fondo (paralelos y meridianos de referencia)
      const gGrid = document.createElementNS(ns, 'g');
      gGrid.setAttribute('class', 'miniMapaGrid');
      for (let gx = 45; gx < W; gx += 65) {
        const l = document.createElementNS(ns, 'line');
        l.setAttribute('x1', gx); l.setAttribute('y1', 0);
        l.setAttribute('x2', gx); l.setAttribute('y2', H);
        gGrid.appendChild(l);
      }
      for (let gy = 35; gy < H; gy += 55) {
        const l = document.createElementNS(ns, 'line');
        l.setAttribute('x1', 0); l.setAttribute('y1', gy);
        l.setAttribute('x2', W); l.setAttribute('y2', gy);
        gGrid.appendChild(l);
      }
      svg.appendChild(gGrid);

      const gWards = document.createElementNS(ns, 'g');
      const wardDestacadoInicial = "West End";

      wardsGeo.features.forEach((f, idxWard) => {
        let d = '';
        recorrerAnillos(f.geometry, ring => {
          ring.forEach(([lon, lat], idx) => {
            d += `${idx === 0 ? 'M' : 'L'}${proyX(lon).toFixed(1)},${proyY(lat).toFixed(1)}`;
          });
          d += 'Z';
        });
        if (!d) return;

        const path = document.createElementNS(ns, 'path');
        const nom = f.properties.nombre || 'Ward';
        const cod = f.properties.codigo || '';
        path.setAttribute('d', d);
        path.setAttribute('class', 'miniWardPath' + (nom === wardDestacadoInicial ? ' focoInicial' : ''));
        path.style.setProperty('--w-i', String(idxWard));
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', `${nom} (${cod}) — Volar en el Gemelo 3D`);

        const activarLectura = () => {
          gWards.querySelectorAll('.focoInicial').forEach(el => el.classList.remove('focoInicial'));
          if (lectura) {
            lectura.innerHTML =
              `<span><strong>${nom}</strong> · Clic para inspección 3D</span>` +
              `<code>${cod}</code>`;
          }
        };

        const volarAlWard = () => {
          const c = centroide(f.geometry);
          const secTerr = document.getElementById('territorio');
          if (secTerr) secTerr.scrollIntoView({ behavior: 'smooth' });
          if (mapa) {
            detenerOrbita();
            mapa.flyTo({ center: c, zoom: 14.4, pitch: 60, bearing: -20, duration: 1700 });
            const hudK = document.getElementById('hudKicker');
            const hudT = document.getElementById('hudTitulo');
            const hudS = document.getElementById('hudSub');
            if (hudK) hudK.textContent = 'WARD ELECTORAL · VUELO DESDE PORTADA';
            if (hudT) hudT.textContent = nom;
            if (hudS) hudS.textContent = `${cod} · City of Westminster (E09000033)`;
          }
        };

        path.addEventListener('pointerenter', activarLectura);
        path.addEventListener('focus', activarLectura);
        path.addEventListener('click', volarAlWard);
        path.addEventListener('keydown', ev => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            volarAlWard();
          }
        });

        gWards.appendChild(path);
      });

      svg.addEventListener('pointerleave', () => {
        if (lectura) {
          lectura.innerHTML =
            `<span><strong>City of Westminster</strong> · 18 wards electorales</span>` +
            `<code>E09000033</code>`;
        }
      });

      svg.appendChild(gWards);

      // Etiqueta de rosa náutica y referencia del río Támesis al sur-este
      const txtNorte = document.createElementNS(ns, 'text');
      txtNorte.setAttribute('x', W - 12);
      txtNorte.setAttribute('y', 16);
      txtNorte.setAttribute('text-anchor', 'end');
      txtNorte.setAttribute('class', 'miniMapaCota');
      txtNorte.textContent = 'N ↑ · 51,51°N';
      svg.appendChild(txtNorte);

      const txtTamesis = document.createElementNS(ns, 'text');
      txtTamesis.setAttribute('x', W - 12);
      txtTamesis.setAttribute('y', H - 8);
      txtTamesis.setAttribute('text-anchor', 'end');
      txtTamesis.setAttribute('class', 'miniMapaRio');
      txtTamesis.textContent = '≈ RÍO TÁMESIS (FRONTERA SUR)';
      svg.appendChild(txtTamesis);

      cont.innerHTML = '';
      cont.appendChild(svg);
    }

    // Inicializar MapLibre GL con soporte de pitch hasta 75 grados para el Gemelo Digital 3D
    mapa = new maplibregl.Map({
      container: 'mapa',
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [-0.1357, 51.5045],
      zoom: 10.1,
      pitch: 28,
      bearing: -8,
      maxPitch: 75,
      antialias: true,
      attributionControl: { compact: true }
    });

    mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapa.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right');

    // Telemetría de cámara en vivo
    function actualizarCoords() {
      const el = document.getElementById('mapaCoords');
      if (!el || !mapa) return;
      const c = mapa.getCenter();
      const z = mapa.getZoom().toFixed(1);
      const p = Math.round(mapa.getPitch());
      const b = Math.round(mapa.getBearing());
      el.textContent = `${c.lat.toFixed(4)}° N, ${Math.abs(c.lng).toFixed(4)}° W · ZOOM ${z} · PITCH ${p}° · BEARING ${b}°`;
    }
    mapa.on('move', actualizarCoords);

    function construirExpresionColor(claveMetrica) {
      const conf = METRICAS[claveMetrica] || METRICAS.precio;
      const vals = boroughs.features.map(f => f.properties[conf.campo]).filter(v => typeof v === 'number');
      const cortes = cuantiles(vals, 5);
      const esc = conf.escala;

      // Pintar leyenda actualizada con los cortes reales
      const ley = document.getElementById('mapaLeyenda');
      if (ley) {
        ley.innerHTML =
          `<span class="leyendaItem"><strong>${conf.titulo}:</strong></span>` +
          `<span class="leyendaItem"><i class="leyendaSw" style="background:${esc[0]}"></i> &lt;${conf.fmt(cortes[0])}</span>` +
          `<span class="leyendaItem"><i class="leyendaSw" style="background:${esc[1]}"></i> Q2</span>` +
          `<span class="leyendaItem"><i class="leyendaSw" style="background:${esc[2]}"></i> Q3</span>` +
          `<span class="leyendaItem"><i class="leyendaSw" style="background:${esc[3]}"></i> Q4</span>` +
          `<span class="leyendaItem"><i class="leyendaSw" style="background:${esc[4]}"></i> ≥${conf.fmt(cortes[3])}</span>`;
      }

      return [
        'case',
        ['==', ['get', conf.campo], null], '#b8b2a6',
        ['step', ['get', conf.campo],
          esc[0],
          cortes[0], esc[1],
          cortes[1], esc[2],
          cortes[2], esc[3],
          cortes[3], esc[4]
        ]
      ];
    }

    function aplicarMetrica(claveMetrica) {
      metricaActual = claveMetrica;
      if (!mapa || !mapa.getLayer('boroughs-relleno')) return;
      const exprColor = construirExpresionColor(claveMetrica);
      mapa.setPaintProperty('boroughs-relleno', 'fill-color', exprColor);

      if (mapa.getLayer('boroughs-prisma3d')) {
        const conf = METRICAS[claveMetrica] || METRICAS.precio;
        mapa.setPaintProperty('boroughs-prisma3d', 'fill-extrusion-color', exprColor);
        mapa.setPaintProperty('boroughs-prisma3d', 'fill-extrusion-height', [
          '*', ['coalesce', ['get', conf.campo], 0], conf.factorAltura
        ]);
      }
      if (westminsterProps) pintarHUD(westminsterProps, 'FOCO DEL EXPEDIENTE · WESTMINSTER');
    }

    mapa.on('load', () => {
      actualizarCoords();
      const exprColorInicial = construirExpresionColor(metricaActual);

      // 1. Fuente y capas de los 33 Boroughs
      mapa.addSource('boroughs', { type: 'geojson', data: boroughs });

      mapa.addLayer({
        id: 'boroughs-relleno',
        type: 'fill',
        source: 'boroughs',
        paint: {
          'fill-color': exprColorInicial,
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            9.5, 0.72,
            13, 0.28,
            15, 0.12
          ]
        }
      });

      // Capa de Prisma 3D de datos (oculta por defecto, se activa con "Prisma 3D (Datos)")
      mapa.addLayer({
        id: 'boroughs-prisma3d',
        type: 'fill-extrusion',
        source: 'boroughs',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': exprColorInicial,
          'fill-extrusion-color-transition': { duration: 480, delay: 0 },
          'fill-extrusion-height': ['*', ['coalesce', ['get', 'precio'], 0], METRICAS.precio.factorAltura],
          'fill-extrusion-height-transition': { duration: 580, delay: 0 },
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.82
        }
      });

      // Malla de los 704 wards de Londres (se carga bajo demanda)
      mapa.addSource('wards-londres', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      mapa.addLayer({
        id: 'wards-londres-linea',
        type: 'line',
        source: 'wards-londres',
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#1d4e89',
          'line-width': 0.55,
          'line-opacity': 0.45
        }
      });

      // Bordes de los 33 boroughs
      mapa.addLayer({
        id: 'boroughs-linea',
        type: 'line',
        source: 'boroughs',
        paint: {
          'line-color': '#111315',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.9, 13, 1.8],
          'line-opacity': 0.75
        }
      });

      // 2. Malla interna de los 18 Wards del City of Westminster
      mapa.addSource('wards', { type: 'geojson', data: wardsWestminster });
      mapa.addSource('wards-centroides', { type: 'geojson', data: wardsCentroides });

      mapa.addLayer({
        id: 'wards-relleno-hover',
        type: 'fill',
        source: 'wards',
        paint: {
          'fill-color': '#c8281e',
          'fill-opacity': 0.05
        }
      });

      mapa.addLayer({
        id: 'wards-linea',
        type: 'line',
        source: 'wards',
        paint: {
          'line-color': '#c8281e',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 0.8, 12, 1.5, 15, 2.2],
          'line-dasharray': [2.5, 1.5],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 9.5, 0.45, 11, 0.92]
        }
      });

      // Borde exterior resaltado del City of Westminster (Doble halo + línea bermellón)
      mapa.addLayer({
        id: 'foco-halo',
        type: 'line',
        source: 'boroughs',
        filter: ['==', ['get', 'foco'], true],
        paint: {
          'line-color': '#111315',
          'line-width': 5,
          'line-opacity': 0.35
        }
      });

      mapa.addLayer({
        id: 'foco-linea',
        type: 'line',
        source: 'boroughs',
        filter: ['==', ['get', 'foco'], true],
        paint: {
          'line-color': '#c8281e',
          'line-width': 3
        }
      });

      // 3. EXTRUSIÓN VOLUMÉTRICA 3D DE EDIFICIOS (El Gemelo Urbano de Londres)
      // Aprovecha la fuente vectorial 'openmaptiles' del estilo para levantar la estructura arquitectónica
      if (mapa.getSource('openmaptiles')) {
        mapa.addLayer({
          id: 'edificios-gemelo-3d',
          type: 'fill-extrusion',
          source: 'openmaptiles',
          'source-layer': 'building',
          minzoom: 12.2,
          paint: {
            'fill-extrusion-color': [
              'interpolate', ['linear'],
              ['coalesce', ['get', 'render_height'], 14],
              0, '#d8d2c5',
              25, '#b8b0a0',
              70, '#627d98',
              140, '#c8281e'
            ],
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'],
              12.2, 0,
              12.8, ['coalesce', ['get', 'render_height'], 14]
            ],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.86
          }
        });
      }

      // 4. Rótulos de los 18 Wards de Westminster
      mapa.addLayer({
        id: 'wards-etiquetas',
        type: 'symbol',
        source: 'wards-centroides',
        minzoom: 11.1,
        layout: {
          'text-field': ['get', 'nombre'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11.1, 10, 14, 13],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.06,
          'text-max-width': 8
        },
        paint: {
          'text-color': '#111315',
          'text-halo-color': '#f3f1eb',
          'text-halo-width': 1.8
        }
      });

      // 5. Capa de los 205 Edificios Protegidos Grado I (Historic England)
      mapa.addSource('patrimonio-grado-i', { type: 'geojson', data: patrimonioGeo });
      mapa.addLayer({
        id: 'patrimonio-puntos',
        type: 'circle',
        source: 'patrimonio-grado-i',
        minzoom: 10.2,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.2, 2.8, 13, 5.2, 15.5, 7.5],
          'circle-color': '#c8281e',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10.2, 0.8, 14, 1.8],
          'circle-opacity': 0.92
        }
      });

      // 6. Capa de Nodos de Riesgo de Inundación Mareal
      mapa.addSource('riesgo-inundacion', { type: 'geojson', data: riesgoGeo });
      mapa.addLayer({
        id: 'riesgo-halo',
        type: 'circle',
        source: 'riesgo-inundacion',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9.5, 8, 13, 18],
          'circle-color': '#1d4e89',
          'circle-opacity': 0.25,
          'circle-stroke-color': '#1d4e89',
          'circle-stroke-width': 1.5
        }
      });
      mapa.addLayer({
        id: 'riesgo-puntos',
        type: 'circle',
        source: 'riesgo-inundacion',
        paint: {
          'circle-radius': 5,
          'circle-color': '#1d4e89',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5
        }
      });

      // Interacciones: Hover en vivo sobre boroughs actualiza el HUD
      mapa.on('mousemove', 'boroughs-relleno', e => {
        if (!e.features || !e.features.length) return;
        const p = e.features[0].properties;
        pintarHUD(p, p.codigo === 'E09000033' ? 'FOCO DEL EXPEDIENTE · WESTMINSTER' : 'INSPECCIÓN EN VIVO · BOROUGH');
      });

      // Clic en Edificio Grado I
      mapa.on('click', 'patrimonio-puntos', e => {
        e.originalEvent.stopPropagation();
        const p = e.features[0].properties;
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:var(--font-mono);font-size:10px;color:var(--acento);letter-spacing:.05em">PATRIMONIO GRADO I · HISTORIC ENGLAND</div>` +
            `<strong style="font-family:var(--font-display);font-size:14px">${p.nombre}</strong><br>` +
            `<span style="font-size:12px;color:var(--suave)">Ref. oficial: <code>${p.referencia}</code></span><br>` +
            (p.url ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--acento2);font-weight:600">Ver ficha en Historic England ↗</a>` : '')
          )
          .addTo(mapa);
      });

      // Clic en Nodo de Riesgo
      mapa.on('click', 'riesgo-puntos', e => {
        e.originalEvent.stopPropagation();
        const p = e.features[0].properties;
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:var(--font-mono);font-size:10px;color:var(--acento2);letter-spacing:.05em">ENVIRONMENT AGENCY · RIESGO HÍDRICO</div>` +
            `<strong style="font-family:var(--font-display);font-size:14px">Zona de Inundación Nivel ${p.nivel}</strong><br>` +
            `<span style="font-size:12px">Modelo: ${p.tipo} · Ref: <code>${p.referencia}</code></span>`
          )
          .addTo(mapa);
      });

      // Clic en Borough
      mapa.on('click', 'boroughs-relleno', e => {
        const p = e.features[0].properties;
        pintarHUD(p, 'BOROUGH SELECCIONADO');
        const conf = METRICAS[metricaActual] || METRICAS.precio;
        const valPrincipal = p[conf.campo] != null ? conf.fmt(p[conf.campo]) : 'sin dato';

        // Verificar si también hizo clic dentro de un ward de Westminster
        const wardsHit = mapa.queryRenderedFeatures(e.point, { layers: ['wards-relleno-hover'] });
        const wardInfo = wardsHit && wardsHit.length
          ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--linea);font-family:var(--font-mono);font-size:11px;color:var(--acento)">Ward electoral: <strong>${wardsHit[0].properties.nombre}</strong> (${wardsHit[0].properties.codigo})</div>`
          : '';

        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:var(--font-mono);font-size:10px;color:var(--acento);letter-spacing:.05em">${p.codigo} · GREATER LONDON</div>` +
            `<strong style="font-family:var(--font-display);font-size:16px">${p.nombre}</strong><br>` +
            `<span style="font-size:12px">${conf.titulo}: <strong>${valPrincipal}</strong></span><br>` +
            `<span style="font-size:11px;color:var(--suave)">Población: ${fmtInt(p.poblacion)} · Densidad: ${fmtInt(p.densidad)} hab/km²</span>` +
            wardInfo
          )
          .addTo(mapa);
      });

      ['boroughs-relleno', 'patrimonio-puntos', 'riesgo-puntos'].forEach(capa => {
        mapa.on('mouseenter', capa, () => { mapa.getCanvas().style.cursor = 'pointer'; });
        mapa.on('mouseleave', capa, () => { mapa.getCanvas().style.cursor = ''; });
      });

      lugares = [
        ...boroughs.features.map(f => ({
          nombre: f.properties.nombre,
          tipo: 'borough · ' + f.properties.codigo,
          centro: centroide(f.geometry),
          zoom: 11.6,
          pitch: 35
        })),
        ...wardsWestminster.features.map(f => ({
          nombre: f.properties.nombre + ' (Ward Westminster)',
          tipo: 'ward · ' + f.properties.codigo,
          centro: centroide(f.geometry),
          zoom: 14.2,
          pitch: 58
        }))
      ];
    });

    // Renderizar el plano táctico SVG de los 18 wards de Westminster en la portada (Masthead)
    pintarMiniMapaPortada(wardsWestminster);

    // Conectar botones de Métricas Coropléticas
    const contMetricas = document.getElementById('mapaMetricas');
    if (contMetricas) {
      contMetricas.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          contMetricas.querySelectorAll('button').forEach(b => b.classList.remove('activo'));
          btn.classList.add('activo');
          aplicarMetrica(btn.dataset.m);
        });
      });
    }

    // Motor de órbita cinemática 3D en rAF (se detiene en cuanto el usuario interactúa)
    let orbitaRaf = 0;
    let ultimoTs = 0;
    function detenerOrbita() {
      if (orbitaRaf) {
        cancelAnimationFrame(orbitaRaf);
        orbitaRaf = 0;
      }
      const btnOrb = document.querySelector('#mapaVistas button[data-v="orbita3d"]');
      if (btnOrb) btnOrb.classList.remove('activo');
    }

    function iniciarOrbita() {
      detenerOrbita();
      if (!mapa || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      ultimoTs = performance.now();
      function paso(ts) {
        const dt = Math.min(64, ts - ultimoTs);
        ultimoTs = ts;
        mapa.rotateTo((mapa.getBearing() + dt * 0.011) % 360, { duration: 0 });
        orbitaRaf = requestAnimationFrame(paso);
      }
      orbitaRaf = requestAnimationFrame(paso);
    }

    ['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach(ev => {
      mapa.on(ev, () => { if (orbitaRaf) detenerOrbita(); });
    });

    // Conectar botones de Vistas y Cámara 3D
    const contVistas = document.getElementById('mapaVistas');
    if (contVistas) {
      contVistas.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const v = btn.dataset.v;
          if (!mapa) return;

          if (v === 'orbita3d') {
            if (orbitaRaf) {
              detenerOrbita();
              return;
            }
            contVistas.querySelectorAll('button').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
            if (mapa.getZoom() < 13.2 || mapa.getPitch() < 45) {
              mapa.flyTo({ center: [-0.134, 51.506], zoom: 14.3, pitch: 62, bearing: mapa.getBearing(), duration: 1100 });
              mapa.once('moveend', iniciarOrbita);
            } else {
              iniciarOrbita();
            }
            return;
          }

          detenerOrbita();
          contVistas.querySelectorAll('button').forEach(b => b.classList.remove('activo'));
          btn.classList.add('activo');

          if (v === 'extrusion3d') {
            modoPrisma3D = true;
            if (mapa.getLayer('boroughs-prisma3d')) {
              mapa.setLayoutProperty('boroughs-prisma3d', 'visibility', 'visible');
            }
            mapa.flyTo({ center: [-0.115, 51.495], zoom: 9.8, pitch: 56, bearing: -18, duration: 1600 });
          } else {
            modoPrisma3D = false;
            if (mapa.getLayer('boroughs-prisma3d')) {
              mapa.setLayoutProperty('boroughs-prisma3d', 'visibility', 'none');
            }
            if (v === 'londres') {
              mapa.flyTo({ center: [-0.105, 51.500], zoom: 9.4, pitch: 0, bearing: 0, duration: 1400 });
            } else if (v === 'westminster') {
              mapa.flyTo({ center: [-0.142, 51.511], zoom: 12.3, pitch: 32, bearing: -10, duration: 1500 });
            } else if (v === 'gemelo3d') {
              mapa.flyTo({ center: [-0.134, 51.506], zoom: 14.4, pitch: 62, bearing: -28, duration: 1800 });
            }
          }
        });
      });
    }

    // Conectar checkboxes de Capas Estructurales
    const bindCheck = (id, capas, onActivar) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', async () => {
        if (!mapa) return;
        if (onActivar && el.checked) await onActivar();
        capas.forEach(c => {
          if (mapa.getLayer(c)) {
            mapa.setLayoutProperty(c, 'visibility', el.checked ? 'visible' : 'none');
          }
        });
      });
    };

    bindCheck('chkWards', ['wards-linea', 'wards-etiquetas', 'wards-relleno-hover']);
    bindCheck('chkPatrimonio', ['patrimonio-puntos']);
    bindCheck('chkRiesgo', ['riesgo-halo', 'riesgo-puntos']);
    bindCheck('chkWardsLondres', ['wards-londres-linea'], async () => {
      if (!wardsLondres) {
        try {
          wardsLondres = await window.cargarGeo('wards_londres');
          const src = mapa.getSource('wards-londres');
          if (src) src.setData(wardsLondres);
        } catch (e) {
          console.error('No se pudo cargar wards_londres', e);
        }
      }
    });
  }

  return {
    init,
    lugares: () => lugares,
    irA: l => {
      document.getElementById('territorio').scrollIntoView({ behavior: 'smooth' });
      if (mapa && l.centro) {
        mapa.flyTo({
          center: l.centro,
          zoom: l.zoom || 12.2,
          pitch: l.pitch || 42,
          bearing: -15,
          duration: 1600
        });
      }
    }
  };
})();
