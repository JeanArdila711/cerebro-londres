// Pinta las secciones desde el lago. Ninguna cifra se escribe a mano aquí:
// todas salen de LAGO, y cada una lleva su ficha de procedencia a un clic.
window.SECCIONES = (function () {
  const fmt = n => typeof n === 'number' ? new Intl.NumberFormat('es-ES').format(n) : n;
  const libras = n => '£' + new Intl.NumberFormat('es-ES').format(Math.round(n));
  const librasDec = n => '£' + new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  let LAGO = {};

  // Motor de calibración e interpolación numérica en tiempo real (60fps, tabular-nums, respeta reduced-motion)
  const sinMovimiento = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function contarDecimales(num) {
    if (typeof num !== 'number' || Number.isInteger(num)) return 0;
    const s = String(num);
    const i = s.indexOf('.');
    return i === -1 ? 0 : Math.min(2, s.length - i - 1);
  }

  function formatearInterpolado(val, dec, fnFormato) {
    const redondeado = dec > 0 ? Number(val.toFixed(dec)) : Math.round(val);
    if (fnFormato === libras) return libras(redondeado);
    if (fnFormato === librasDec) return librasDec(val);
    if (fnFormato) return fnFormato(redondeado);
    if (dec > 0) {
      return new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec
      }).format(redondeado);
    }
    return fmt(redondeado);
  }

  function animarNumeroElemento(el, desde, hasta, duracion = 780, delay = 0, fnFormato = null, dec = 0, onTick = null) {
    if (!el || typeof hasta !== 'number' || isNaN(hasta)) return;
    if (el._rafNum) {
      cancelAnimationFrame(el._rafNum);
      el._rafNum = 0;
    }
    if (sinMovimiento() || Math.abs(hasta - desde) < 1e-6) {
      el.textContent = formatearInterpolado(hasta, dec, fnFormato);
      if (onTick) onTick(1);
      return;
    }

    let inicioTs = null;
    const paso = ts => {
      if (inicioTs === null) inicioTs = ts;
      const transcurrido = ts - inicioTs - delay;
      if (transcurrido < 0) {
        el._rafNum = requestAnimationFrame(paso);
        return;
      }
      const t = Math.min(1, transcurrido / duracion);
      // Curva de frenado de instrumento de precisión (easeOutExpo)
      const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const actual = desde + (hasta - desde) * ease;
      el.textContent = formatearInterpolado(actual, dec, fnFormato);
      if (onTick) onTick(ease);

      if (t < 1) {
        el._rafNum = requestAnimationFrame(paso);
      } else {
        el._rafNum = 0;
        el.textContent = formatearInterpolado(hasta, dec, fnFormato);
        if (onTick) onTick(1);
      }
    };
    el._rafNum = requestAnimationFrame(paso);
  }

  // Observador de entrada en pantalla para calibrar cada baldosa (.tile) una sola vez
  const ioTiles = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          const b = en.target;
          ioTiles.unobserve(b);
          if (typeof b._calibrar === 'function') b._calibrar();
        });
      }, { threshold: 0.18 })
    : null;

  function cifra(tema, clave) {
    const t = LAGO[tema];
    return t && t.cifras ? t.cifras[clave] : null;
  }

  function fuenteDe(tema, id) {
    const t = LAGO[tema];
    return t && t.fuentes ? t.fuentes.find(f => f.id === id) : null;
  }

  // Una baldosa = una cifra + su vigencia visible + su ficha al tocarla + micro-visualización contextual.
  // La vigencia va pegada a la cifra, no en una nota al pie.
  function unidadEsCategorica(unidad) {
    return ['borough', 'categoría', 'LSOA'].includes(unidad);
  }

  function tile(tema, clave, etiqueta, formato, destacado = false, extra = {}) {
    const c = cifra(tema, clave);
    if (!c) return null;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile' + (destacado ? ' tileDestacado' : '');
    const valor = formato ? formato(c.valor) : fmt(c.valor);
    const omitirUnidad = unidadEsCategorica(c.unidad);
    const f = fuenteDe(tema, c.fuente) || {};
    const G = window.GRAFICOS;

    // Micro-visualización automática o por opción:
    // 1. Si trae serie temporal (extra.spark), dibuja sparkline Tufte.
    // 2. Si la unidad es "puesto de N" (p. ej. "puesto de 33", "puesto de 32", "puesto de 14"), dibuja regla de posición.
    let microHtml = '';
    if (extra.spark && G && G.sparkline) {
      microHtml = G.sparkline(extra.spark);
    } else if (G && G.rangoMetropolitano && typeof c.unidad === 'string') {
      const mPuesto = c.unidad.match(/puesto de (\d+)/i);
      if (mPuesto) {
        microHtml = G.rangoMetropolitano(c.valor, Number(mPuesto[1]));
      }
    }

    b.innerHTML =
      `<div class="tileTop">` +
        `<span class="l">${etiqueta}</span>` +
        `<span class="tileFichaTag" aria-hidden="true">FICHA ↗</span>` +
      `</div>` +
      `<div class="tileCuerpoValor">` +
        `<span class="v"><span class="vNum">${valor}</span>${omitirUnidad ? '' : `<span class="u">${c.unidad}</span>`}</span>` +
        microHtml +
      `</div>` +
      (destacado && c.nota ? `<span class="nota">${c.nota}</span>` : '') +
      `<span class="vig">${c.vigencia} · ${f.entidad || c.fuente}</span>`;
    b.addEventListener('click', () => abrirFicha(tema, clave, etiqueta));

    // Configurar calibración numérica sincronizada con el sparkline o la regla de posición al entrar en viewport
    if (typeof c.valor === 'number' && !sinMovimiento()) {
      const spanNum = b.querySelector('.vNum');
      const sparkPath = b.querySelector('.sparkPath');
      const sparkArea = b.querySelector('.sparkArea');
      const rangoFill = b.querySelector('.tileRangoFill');
      const rangoPin = b.querySelector('.tileRangoPin');

      const dec = formato === librasDec ? 2 : (formato === libras ? 0 : contarDecimales(c.valor));
      // Punto de arranque inteligente:
      // - Esperanza de vida (años > 50): arranca en 65,0 para sentirse como calibración real
      // - Puestos (1..33): arrancan desde el fondo de la tabla (33) subiendo hasta su puesto real
      // - Resto de cifras: arrancan desde 0
      const esPuesto = typeof c.unidad === 'string' && /puesto de (\d+)/i.test(c.unidad);
      const totalPuesto = esPuesto ? Number(c.unidad.match(/puesto de (\d+)/i)[1]) : 33;
      const valorInicio = esPuesto
        ? totalPuesto
        : (c.unidad === 'años' && c.valor > 50 ? 65 : 0);

      let pctFinalRango = 0;
      if (rangoPin && rangoPin.style.left) {
        pctFinalRango = parseFloat(rangoPin.style.left) || 0;
      }

      b._calibrar = () => {
        const idxStagger = Number(b.style.getPropertyValue('--i')) || 0;
        const delayMs = Math.min(idxStagger, 8) * 45;

        if (sparkPath && typeof sparkPath.getTotalLength === 'function') {
          try {
            const len = sparkPath.getTotalLength();
            sparkPath.style.strokeDasharray = `${len}`;
            sparkPath.style.strokeDashoffset = `${len}`;
            sparkPath.animate(
              [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
              { duration: 820, delay: delayMs, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
            );
            if (sparkArea) {
              sparkArea.animate(
                [{ opacity: 0 }, { opacity: 1 }],
                { duration: 640, delay: delayMs + 160, easing: 'ease-out', fill: 'forwards' }
              );
            }
          } catch (_) {}
        }

        animarNumeroElemento(
          spanNum,
          valorInicio,
          c.valor,
          820,
          delayMs,
          formato,
          dec,
          ease => {
            if (rangoFill && rangoPin) {
              const pctActual = 100 - (100 - pctFinalRango) * ease;
              rangoFill.style.width = `${pctActual.toFixed(1)}%`;
              rangoPin.style.left = `${pctActual.toFixed(1)}%`;
            }
          }
        );
      };

      if (ioTiles) ioTiles.observe(b);
    }

    return b;
  }

  function abrirFicha(tema, clave, etiqueta) {
    const c = cifra(tema, clave), f = fuenteDe(tema, c.fuente), t = LAGO[tema];
    if (!c) return;
    const campos = [
      ['Cifra auditada', unidadEsCategorica(c.unidad) ? fmt(c.valor) : `${fmt(c.valor)} ${c.unidad}`],
      ['Vigencia del dato', c.vigencia],
      ['Definición / Nota', c.nota || '—'],
      ['Conjunto de origen', f ? f.nombre : c.fuente],
      ['Entidad publicadora', f ? f.entidad : '—'],
      ['Licencia verificada', f ? `<span class="pastilla integrado">${f.licencia}</span>` : '—'],
      ['¿Datos de personas?', f ? f.personas : '—'],
      ['Fecha de prueba', f ? f.probado : (t ? t.probado : '—')],
      ['Estado en el lago', f ? `<span class="pastilla ${f.estado}">${f.estado}</span>` : '—'],
      ['Enlace oficial', f ? `<a href="${f.url}" target="_blank" rel="noopener noreferrer">${f.url}</a>` : '—'],
      ['Observación técnica', f && f.nota ? f.nota : '—'],
      ['Ruta en el contrato', `<code>lago/${tema}.json → cifras.${clave}</code>`],
    ];
    document.getElementById('fichaTitulo').textContent = etiqueta;
    document.getElementById('fichaCuerpo').innerHTML =
      campos.map(([k, v]) => `<div class="campo"><b>${k}</b><span>${v}</span></div>`).join('');
    document.getElementById('ficha').hidden = false;
  }

  function seccion(id, indice, titulo, sub) {
    const s = document.createElement('section');
    s.className = 'sec';
    s.id = id;
    s.innerHTML =
      `<div class="secCabecera">` +
        `<div><span class="secIndice">${indice}</span><h1>${titulo}</h1></div>` +
        `${sub ? `<p class="secSub">${sub}</p>` : ''}` +
      `</div>`;
    return s;
  }

  function rejilla(tiles, claseExtra = '') {
    const r = document.createElement('div');
    r.className = 'rejilla' + (claseExtra ? ' ' + claseExtra : '');
    tiles.filter(Boolean).forEach((t, idx) => {
      t.style.setProperty('--i', String(idx));
      r.appendChild(t);
    });
    return r;
  }

  function dosColumnas(...bloques) {
    const d = document.createElement('div');
    d.className = 'dosColumnas';
    bloques.filter(Boolean).forEach(b => d.appendChild(b));
    return d;
  }

  function bloque(titulo, meta, ...hijos) {
    const b = document.createElement('div');
    b.className = 'bloque';
    if (titulo) {
      b.innerHTML =
        `<div class="bloqueHeader">` +
          `<h3>${titulo}</h3>` +
          `${meta ? `<span class="bloqueMeta">${meta}</span>` : ''}` +
        `</div>`;
    }
    hijos.filter(Boolean).forEach(h => b.appendChild(h));
    return b;
  }

  function aviso(texto) {
    const d = document.createElement('div');
    d.className = 'aviso';
    d.innerHTML = texto;
    return d;
  }

  function tabla(cabeceras, filas, focoIdx) {
    const env = document.createElement('div');
    env.className = 'envoltorio';
    const t = document.createElement('table');
    t.className = 'tabla';
    t.innerHTML = '<thead><tr>' + cabeceras.map((c, i) =>
      `<th${i ? ' style="text-align:right"' : ''}>${c}</th>`).join('') + '</tr></thead>';
    const tb = document.createElement('tbody');
    filas.forEach(f => {
      const tr = document.createElement('tr');
      if (focoIdx != null && f[focoIdx]) tr.className = 'foco';
      tr.innerHTML = f.slice(0, cabeceras.length).map((v, i) =>
        i ? `<td class="num">${v}</td>` : `<td>${v}</td>`).join('');
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    env.appendChild(t);
    return env;
  }

  function render(lago) {
    LAGO = lago;
    const main = document.getElementById('main');
    main.innerHTML = '';
    const G = window.GRAFICOS;

    // =========================================================================
    // 01 · PANORAMA: LAS SEIS PREGUNTAS DEL CONCEJAL
    // =========================================================================
    const seriePobPan = LAGO.demografia && LAGO.demografia.series && LAGO.demografia.series.poblacion_westminster;
    const seriePrecioPan = LAGO.economia && LAGO.economia.series && LAGO.economia.series.precio_medio_city_of_westminster;
    const serieDelitosPan = LAGO.seguridad && LAGO.seguridad.series && LAGO.seguridad.series.delitos_mensuales;
    const serieWikiPan = LAGO.escucha && LAGO.escucha.series && LAGO.escucha.series.wiki_westminster;

    const pan = seccion('panorama', 'SÍNTESIS EJECUTIVA · E09000033', 'Panorama del City of Westminster',
      'Seis preguntas de partida que haría un concejal del City of Westminster (E09000033). ' +
      'Cada respuesta proviene de una cifra viva del lago con su vigencia y su entidad publicadora. ' +
      'Seleccione cualquier baldosa para inspeccionar su ficha técnica.');
    pan.appendChild(rejilla([
      tile('demografia', 'poblacion_westminster', '¿Cuánta gente reside aquí?', null, true,
        { spark: seriePobPan ? seriePobPan.puntos : null }),
      tile('economia', 'precio_medio_westminster', '¿Cuánto cuesta una vivienda media?', libras, true,
        { spark: seriePrecioPan ? seriePrecioPan.puntos : null }),
      tile('seguridad', 'delitos_ultimo_mes', '¿Qué registra la policía en un mes?', null, true,
        { spark: serieDelitosPan ? serieDelitosPan.puntos : null }),
      tile('turismo', 'alojamientos_n', '¿Cuánto pesa la planta turística?'),
      tile('infraestructura', 'estaciones_n', '¿Qué infraestructura ferroviaria hay?'),
      tile('escucha', 'vistas_ultimo_mes', '¿Cuánta atención pública despierta?', null, false,
        { spark: serieWikiPan ? serieWikiPan.puntos : null }),
    ], 'rejillaPanorama'));
    pan.appendChild(aviso(
      '<strong>Nota de gobernanza · Límites y silencios del sistema</strong> ' +
      'Este expediente integra hoy 17 temas verificados (incluyendo Council Tax Banda D, ' +
      'esperanza de vida OHID e Índice de Privación IMD 2025 por LSOA), pero sigue sin presupuesto ' +
      'municipal ejecutado ni población desagregada por ward. Quien viva en Westminster y no aparezca ' +
      'en los registros administrativos no desaparece de la calle: desaparece de la decisión pública.'));
    main.appendChild(pan);

    // =========================================================================
    // 02 · GENTE Y SALUD PÚBLICA
    // =========================================================================
    const g = seccion('gente', 'DEMOGRAFÍA Y SALUD · ONS & OHID', 'Gente y esperanza de vida',
      'Población residente del borough (ONS mid-year vía Nomis) y esperanza de vida al nacer (OHID Fingertips). ' +
      'Los cruces entre fuentes se ejecutan estrictamente por código oficial GSS (E09000033), nunca por nombre.');
    g.appendChild(rejilla([
      tile('demografia', 'poblacion_westminster', 'Población residente de Westminster', null, true),
      tile('salud', 'esperanza_vida_westminster', 'Esperanza de vida al nacer', null, true),
      tile('demografia', 'puesto_poblacion', 'Puesto en población (de 33)'),
      tile('demografia', 'pct_de_londres', 'Peso sobre Greater London'),
      tile('demografia', 'hombres_westminster', 'Hombres residentes'),
      tile('demografia', 'mujeres_westminster', 'Mujeres residentes'),
      tile('demografia', 'pct_65_mas', 'Población de 65 años o más'),
      tile('salud', 'brecha_mujer_hombre_westminster', 'Brecha de longevidad mujer–hombre'),
      tile('salud', 'puesto_esperanza_vida_westminster', 'Puesto en esperanza de vida'),
    ]));

    const serieP = LAGO.demografia && LAGO.demografia.series.poblacion_westminster;
    const pir = LAGO.demografia && LAGO.demografia.listas.piramide_quinquenal;
    g.appendChild(dosColumnas(
      serieP ? bloque('Serie histórica de población en Westminster', 'ONS · Estimaciones intercensales',
        G.linea(serieP.puntos, 'Población')) : null,
      pir ? bloque('Estructura demográfica por tramos quinquenales', 'ONS · Distribución por edad',
        G.barras(pir.map(p => [p[0].replace('Aged ', '').replace(' years', ' años'), p[1]]),
          { anchoEtiqueta: 135 })) : null
    ));
    if (LAGO.salud && LAGO.salud.nota) {
      g.appendChild(aviso('<strong>Brecha vital en Londres · OHID Fingertips</strong> ' + LAGO.salud.nota));
    }
    main.appendChild(g);

    // =========================================================================
    // 03 · ECONOMÍA, VIVIENDA Y FISCALIDAD MUNICIPAL
    // =========================================================================
    const e = seccion('economia', 'MERCADO RESIDENCIAL · UK HPI & MHCLG', 'Economía, vivienda y Council Tax',
      'El UK HPI publica el precio medio por propiedad (no por m²), mientras que MHCLG registra el Council Tax ' +
      'Banda D. Westminster combina la segunda vivienda más cara de Londres con el segundo impuesto local más bajo.');
    e.appendChild(rejilla([
      tile('economia', 'precio_medio_westminster', 'Precio medio en Westminster', libras, true),
      tile('finanzas', 'council_tax_westminster', 'Council Tax local (Banda D)', librasDec, true),
      tile('economia', 'precio_medio_londres', 'Media de Greater London', libras),
      tile('economia', 'veces_la_media_de_londres', 'Múltiplo sobre la media de Londres'),
      tile('economia', 'veces_la_media_de_inglaterra', 'Múltiplo sobre Inglaterra'),
      tile('economia', 'variacion_interanual', 'Variación anual de precio'),
      tile('economia', 'precio_medio_piso', 'Precio medio de un piso (flat)', libras),
      tile('finanzas', 'puesto_council_tax_westminster', 'Puesto en Council Tax (1 = más alto)'),
      tile('finanzas', 'cambio_interanual_westminster', 'Ajuste anual Council Tax'),
    ]));

    const sw = LAGO.economia && LAGO.economia.series.precio_medio_city_of_westminster;
    const tipos = LAGO.economia && LAGO.economia.listas.por_tipo_de_vivienda;
    e.appendChild(dosColumnas(
      sw ? bloque('Evolución del precio medio en Westminster (5 años)', 'HM Land Registry · UK HPI',
        G.linea(sw.puntos, 'Precio medio', { formato: libras })) : null,
      (tipos && tipos.length) ? bloque('Desglose por tipología constructiva', 'UK HPI · Último corte',
        G.barras(tipos.map(t => [t[0], t[1]]), { formato: libras, anchoEtiqueta: 130 })) : null
    ));

    e.appendChild(aviso(
      '<strong>Frontera ética · Lo que decidimos excluir</strong> El <em>Price Paid Data</em> de HM Land Registry ' +
      'detalla cada compraventa con dirección exacta, postcode, precio y fecha bajo licencia abierta OGL-3.0. ' +
      'Decidimos excluirlo del lago: dirección, código postal y monto identifican un hogar individual. ' +
      'La pregunta pública se responde con el índice agregado sin exponer patrimonios familiares.'));
    main.appendChild(e);

    // =========================================================================
    // 04 · DESIGUALDAD INTRABOROUGHS (IMD 2025)
    // =========================================================================
    if (LAGO.privacion) {
      const pr = seccion('desigualdad', 'COHESIÓN Y FRACTURA · LSOA IMD 2025', 'Desigualdad interna (IMD 2025)',
        'Una media municipal enmascara que Westminster alberga simultáneamente zonas de Mayfair/Knightsbridge y ' +
        'barrios en el 10 % de mayor privación de Inglaterra (Church Street / Queen\'s Park).');
      pr.appendChild(rejilla([
        tile('privacion', 'score_medio_westminster', 'Puntaje medio IMD en Westminster', null, true),
        tile('privacion', 'puesto_privacion_westminster', 'Puesto de privación en Londres (de 32)', null, true),
        tile('privacion', 'lsoa_westminster_n', 'Unidades censales (LSOA) evaluadas'),
        tile('privacion', 'lsoa_mas_privado', 'Zona con mayor privación (Decil 1)'),
        tile('privacion', 'lsoa_menos_privado', 'Zona con menor privación (Decil 9)'),
      ]));

      const lsoas = LAGO.privacion.listas && LAGO.privacion.listas.lsoa_westminster;
      const rankB = LAGO.privacion.listas && LAGO.privacion.listas.ranking_boroughs;
      if (lsoas && lsoas.length) {
        const topPriv = lsoas.slice(0, 12);
        pr.appendChild(dosColumnas(
          bloque('Las 12 LSOA con mayor privación dentro de Westminster', 'MHCLG · IoD2025 (Decil 1 nacional)',
            G.barras(topPriv.map((z, idx) => [z.lsoa, z.score, idx < 3]), { anchoEtiqueta: 165 })),
          rankB ? bloque('Posición de Westminster frente a los boroughs más privados', 'Puntaje IMD medio por borough',
            G.barras(rankB.slice(0, 14).map(b => [b.nombre, b.score_medio, b.nombre === 'Westminster']),
              { anchoEtiqueta: 185 })) : null
        ));
      }
      if (LAGO.privacion.nota) {
        pr.appendChild(aviso('<strong>Un promedio esconde la dispersión interna · MHCLG IoD2025</strong> ' + LAGO.privacion.nota));
      }
      main.appendChild(pr);
    }

    // =========================================================================
    // 05 · SEGURIDAD CIUDADANA
    // =========================================================================
    const s = seccion('seguridad', 'REGISTRO POLICIAL · MPS & POLICE.UK', 'Seguridad y delitos registrados',
      'Estadísticas de delitos registrados por la Metropolitan Police (data.police.uk y London Datastore). ' +
      'Toda variación refleja tanto hechos como propensión a denunciar y criterios de registro policial.');
    s.appendChild(rejilla([
      tile('seguridad', 'delitos_ultimo_mes', 'Delitos registrados (último mes)', null, true),
      tile('seguridad', 'delitos_12m', 'Total acumulado (12 meses)', null, true),
      tile('seguridad', 'categoria_mas_frecuente', 'Tipología más frecuente'),
      tile('seguridad', 'pct_sin_resultado', 'Sin resultado judicial registrado'),
      tile('seguridad_boroughs', 'tasa_westminster', 'Tasa anual sobre residentes'),
      tile('seguridad_boroughs', 'puesto_tasa_westminster', 'Puesto en tasa aparente (de 32)'),
    ]));

    const sd = LAGO.seguridad && LAGO.seguridad.series.delitos_mensuales;
    const cat = LAGO.seguridad && LAGO.seguridad.listas.por_categoria;
    s.appendChild(dosColumnas(
      sd ? bloque('Evolución mensual de delitos registrados', 'data.police.uk · Westminster',
        G.linea(sd.puntos, 'Delitos')) : null,
      cat ? bloque('Las 12 categorías con mayor volumen anual', 'Conteo agregado sin coordenadas individuales',
        G.barras(cat.slice(0, 12).map((c, i) => [c[0].replace(/-/g, ' '), c[1], i === 0]), { anchoEtiqueta: 195 })) : null
    ));

    s.appendChild(aviso(
      '<strong>Privacidad y sesgo de población flotante</strong> Primero: <code>data.police.uk</code> publica ' +
      'cada denuncia con coordenadas de calle; nuestro pipeline descarta el punto y conserva solo agregados ' +
      'porque delito + fecha + calle puede reidentificar víctimas. Segundo: la tasa de Westminster ' +
      '(350,6 por 1.000 residentes) divide delitos del centro turístico y comercial de Londres entre solo ' +
      'sus residentes permanentes, sobreestimando el riesgo frente a la población presente real.'));
    main.appendChild(s);

    // =========================================================================
    // 06 · TURISMO Y PATRIMONIO HISTÓRICO
    // =========================================================================
    const t = seccion('turismo', 'VISITANTES Y ENTORNO · OSM & HISTORIC ENGLAND', 'Turismo y patrimonio protegido',
      'Planta turística extraída de OpenStreetMap (cobertura colaborativa) cruzada con el catálogo oficial de ' +
      'edificios protegidos (Listed Buildings de Historic England / Planning Data).');
    t.appendChild(rejilla([
      tile('turismo', 'alojamientos_n', 'Alojamientos mapeados en OSM', null, true),
      tile('patrimonio', 'edificios_protegidos_n', 'Edificios con protección patrimonial', null, true),
      tile('turismo', 'hoteles_n', 'Hoteles registrados en OSM'),
      tile('turismo', 'atracciones_n', 'Atracciones y museos'),
      tile('turismo', 'museos_n', 'Museos en el borough'),
      tile('turismo', 'habitaciones_declaradas', 'Habitaciones declaradas (cota inferior)'),
      tile('patrimonio', 'grado_i_n', 'Edificios Grado I (máxima protección)'),
      tile('patrimonio', 'grado_ii_estrella_n', 'Edificios Grado II*'),
    ]));

    const al = LAGO.turismo && LAGO.turismo.listas.alojamiento_por_tipo;
    const grados = LAGO.patrimonio && LAGO.patrimonio.listas.por_grado;
    t.appendChild(dosColumnas(
      al ? bloque('Planta de alojamiento según categoría', 'OpenStreetMap · Overpass API',
        G.barras(al.map(a => [a[0], a[1]]), { anchoEtiqueta: 150 })) : null,
      grados ? bloque('Edificios protegidos según grado de conservación', 'Historic England · Planning Data',
        G.barras(grados.map(g => [`Grado ${g.grado}`, g.n, g.grado === 'I']), { anchoEtiqueta: 140 })) : null
    ));

    t.appendChild(aviso(
      '<strong>Advertencia metodológica · Cota inferior en mapeo voluntario</strong> ' +
      'La cifra de habitaciones cuenta únicamente los establecimientos que declaran la etiqueta <code>rooms</code> ' +
      'en OpenStreetMap. Publicar una cota inferior como si fuera el censo hotelero total sería fabricar un dato falso.'));
    main.appendChild(t);

    // =========================================================================
    // 07 · TERRITORIO, TRANSPORTE Y RIESGO HÍDRICO (GEMELO DIGITAL 3D)
    // =========================================================================
    const te = seccion('territorio', 'CARTOGRAFÍA DOBLE ESCALA · ONS & NAPTAN', 'Gemelo digital territorial y red urbana',
      'Modelo espacial multicapa: alterne entre las 6 variables metropolitanas (33 boroughs), inspeccione los 18 wards ' +
      'de Westminster o active la extrusión volumétrica 3D para recorrer la estructura urbana y los 205 edificios Grado I.');

    const marcoMapa = document.createElement('div');
    marcoMapa.className = 'mapaMarco';
    marcoMapa.innerHTML =
      `<div class="mapaControles">` +
        `<div class="mapaGrupoControl">` +
          `<span class="mapaControlLabel">CAPA COROPLÉTICA (33 BOROUGHS)</span>` +
          `<div class="mapaBotones" id="mapaMetricas">` +
            `<button type="button" data-m="precio" class="activo">Precio vivienda (£)</button>` +
            `<button type="button" data-m="densidad">Densidad (hab/km²)</button>` +
            `<button type="button" data-m="tax">Council Tax (£)</button>` +
            `<button type="button" data-m="delitos">Tasa delitos (/1k)</button>` +
            `<button type="button" data-m="imd">Privación (IMD)</button>` +
            `<button type="button" data-m="vida">Esperanza vida</button>` +
          `</div>` +
        `</div>` +
        `<div class="mapaGrupoControl">` +
          `<span class="mapaControlLabel">CÁMARA Y ESTRUCTURA 3D</span>` +
          `<div class="mapaBotones" id="mapaVistas">` +
            `<button type="button" data-v="londres">Greater London (2D)</button>` +
            `<button type="button" data-v="westminster">Foco Westminster</button>` +
            `<button type="button" data-v="gemelo3d" class="btnGemelo">Gemelo 3D (Edificios)</button>` +
            `<button type="button" data-v="extrusion3d">Prisma 3D (Datos)</button>` +
            `<button type="button" data-v="orbita3d" class="btnGemelo">Órbita 3D ↻</button>` +
          `</div>` +
        `</div>` +
      `</div>` +
      `<div class="mapaSubBarra">` +
        `<div class="mapaCapasCheck">` +
          `<label><input type="checkbox" id="chkWards" checked> <span>18 Wards Westminster</span></label>` +
          `<label><input type="checkbox" id="chkPatrimonio" checked> <span>205 Edificios Grado I (Historic England)</span></label>` +
          `<label><input type="checkbox" id="chkRiesgo" checked> <span>Nodos Riesgo Mareal</span></label>` +
          `<label><input type="checkbox" id="chkWardsLondres"> <span>Malla 704 Wards Londres</span></label>` +
        `</div>` +
        `<div class="mapaLeyenda" id="mapaLeyenda"></div>` +
      `</div>` +
      `<div class="mapaLienzoWrap">` +
        `<div id="mapa"></div>` +
        `<aside class="mapaHUD" id="mapaHUD" aria-live="polite">` +
          `<div class="hudKicker" id="hudKicker">TELEMETRÍA TERRITORIAL · HOVER O CLIC</div>` +
          `<h4 class="hudTitulo" id="hudTitulo">City of Westminster</h4>` +
          `<div class="hudSub" id="hudSub">GSS E09000033 · Foco del expediente</div>` +
          `<div class="hudMetricas" id="hudMetricas"></div>` +
          `<div class="hudPie" id="hudPie">Use Ctrl + arrastrar (o botón Gemelo 3D) para inclinar y rotar la estructura urbana.</div>` +
        `</aside>` +
        `<div class="mapaCoordenadas" id="mapaCoords">51.4975° N, 0.1357° W · ZOOM 9.5 · PITCH 0°</div>` +
      `</div>`;
    te.appendChild(marcoMapa);

    te.appendChild(rejilla([
      tile('geo', 'boroughs_n', 'Boroughs de Greater London'),
      tile('geo', 'wards_westminster_n', 'Wards de Westminster (cosecha 2024)'),
      tile('infraestructura', 'estaciones_n', 'Estaciones ferroviarias / Tube (OSM)'),
      tile('infraestructura', 'paradas_bus_n', 'Paradas de autobús en Westminster'),
      tile('infraestructura', 'bicicleta_puntos_n', 'Estaciones de bicicleta pública'),
      tile('transporte_boroughs', 'paradas_westminster', 'Nodos oficiales NaPTAN en Westminster'),
      tile('transporte_boroughs', 'paradas_londres_n', 'Total de nodos NaPTAN en Londres'),
      tile('riesgo', 'zonas_riesgo_n', 'Polígonos de riesgo de inundación'),
      tile('riesgo', 'nivel_maximo', 'Nivel máximo de riesgo mareal (Támesis)'),
    ]));

    te.appendChild(aviso(
      '<strong>Desfase de cosecha cartográfica</strong> Los límites de los 33 boroughs corresponden a diciembre de 2025 ' +
      '(ONS BGC), mientras que los wards de Westminster son de diciembre de 2024 porque la capa 2025 del ONS solo ' +
      'está expuesta como MapServer con error 400 en consulta abierta. La discrepancia queda documentada en el catálogo.'));
    main.appendChild(te);

    // =========================================================================
    // 08 · ATLAS COMPARATIVO DE LOS 33 BOROUGHS
    // =========================================================================
    const a = seccion('atlas', 'COMPARATIVA METROPOLITANA · 33 BOROUGHS', 'Atlas de los 33 boroughs',
      'Toda cifra metropolitana esconde la dispersión entre distritos. Westminster (E09000033) se resalta en bermellón ' +
      'frente a los otros 32 gobiernos locales de Greater London.');
    a.appendChild(rejilla([
      tile('atlas_boroughs', 'westminster_puesto_precio', 'Puesto en precio de vivienda', null, true),
      tile('atlas_boroughs', 'westminster_puesto_densidad', 'Puesto en densidad poblacional', null, true),
      tile('atlas_boroughs', 'westminster_puesto_poblacion', 'Puesto en población total'),
      tile('atlas_boroughs', 'borough_mas_caro', 'Máximo en precio (Kensington & Chelsea)'),
      tile('atlas_boroughs', 'borough_mas_barato', 'Mínimo en precio (Barking & Dagenham)'),
      tile('atlas_boroughs', 'borough_mas_denso', 'Máxima densidad (Tower Hamlets)'),
    ]));

    const bs = LAGO.atlas_boroughs && LAGO.atlas_boroughs.listas.boroughs;
    // Unificar las variables de los 33 boroughs por código GSS y nombre normalizado (para Atlas y Correlaciones)
    let mapaB = {};
    let listaUnificada = [];
    if (bs) {
      const normNom = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
      const nombreACod = {};
      bs.forEach(b => {
        mapaB[b.codigo] = {
          codigo: b.codigo,
          nombre: b.nombre,
          foco: b.codigo === 'E09000033',
          area: b.area_km2,
          densidad: b.densidad_hab_km2,
          poblacion: b.poblacion,
          precio: b.precio_medio_gbp
        };
        nombreACod[normNom(b.nombre)] = b.codigo;
      });
      ((LAGO.finanzas || {}).listas || {}).boroughs?.forEach(b => {
        if (mapaB[b.codigo]) mapaB[b.codigo].tax = b.council_tax_banda_d;
      });
      ((LAGO.privacion || {}).listas || {}).ranking_boroughs?.forEach(b => {
        const c = nombreACod[normNom(b.nombre)];
        if (c && mapaB[c]) mapaB[c].imd = b.score_medio;
      });
      ((LAGO.salud || {}).listas || {}).boroughs?.forEach(b => {
        const c = nombreACod[normNom(b.nombre)];
        if (c && mapaB[c]) mapaB[c].vida = b.promedio;
      });
      ((LAGO.seguridad_boroughs || {}).listas || {}).boroughs?.forEach(b => {
        const c = nombreACod[normNom(b.nombre)];
        if (c && mapaB[c]) mapaB[c].delitos = b.tasa_x1000;
      });
      listaUnificada = Object.values(mapaB);

      // Consola interactiva «Cara a Cara»: Westminster (E09000033) vs. otro borough de Londres
      const west = mapaB['E09000033'];
      const rivales = listaUnificada
        .filter(b => b.codigo !== 'E09000033')
        .sort((x, y) => x.nombre.localeCompare(y.nombre));

      if (west && rivales.length) {
        const compWrap = document.createElement('div');
        compWrap.className = 'comparadorCaja';

        const rivalesRapidos = [
          ['E09000020', 'Kensington & Chelsea'],
          ['E09000007', 'Camden'],
          ['E09000030', 'Tower Hamlets'],
          ['E09000032', 'Wandsworth'],
          ['E09000002', 'Barking & Dagenham']
        ].filter(([cod]) => mapaB[cod]);

        const barraComp = document.createElement('div');
        barraComp.className = 'comparadorControles';
        barraComp.innerHTML =
          `<div class="comparadorSelectGrupo">` +
            `<span class="comparadorBadgeWest">WESTMINSTER (E09000033)</span>` +
            `<span class="comparadorVs">VS.</span>` +
            `<select class="selectBorough" id="selectBoroughRival" aria-label="Seleccionar borough para comparar con Westminster">` +
              rivales.map(r => `<option value="${r.codigo}"${r.codigo === 'E09000007' ? ' selected' : ''}>${r.nombre} (${r.codigo})</option>`).join('') +
            `</select>` +
          `</div>` +
          `<div class="comparadorAtajos">` +
            `<span class="filtroLabel">CONTRASTES CLAVE:</span>` +
            rivalesRapidos.map(([cod, nom]) =>
              `<button type="button" data-rival="${cod}" class="btnRivalAtajo${cod === 'E09000007' ? ' activo' : ''}">${nom}</button>`
            ).join('') +
          `</div>`;
        compWrap.appendChild(barraComp);

        const gridComp = document.createElement('div');
        gridComp.className = 'comparadorGrid';
        compWrap.appendChild(gridComp);

        const METRICAS_COMP = [
          { k: 'precio',   titulo: 'Precio medio vivienda', unidad: '£ (UK HPI)',      fmt: libras,    dec: 0, esMoneda: true },
          { k: 'tax',      titulo: 'Council Tax Banda D',   unidad: '£/año (MHCLG)',   fmt: librasDec, dec: 2, esMoneda: true },
          { k: 'poblacion',titulo: 'Población residente',   unidad: 'habitantes (ONS)',fmt: fmt,       dec: 0 },
          { k: 'densidad', titulo: 'Densidad urbana',       unidad: 'hab/km² (ONS)',   fmt: fmt,       dec: 0 },
          { k: 'imd',      titulo: 'Privación media (IMD)', unidad: 'puntaje IoD2025', fmt: fmt,       dec: 1 },
          { k: 'vida',     titulo: 'Esperanza de vida',     unidad: 'años al nacer',   fmt: fmt,       dec: 1 },
        ];

        // Construir las 6 tarjetas una sola vez y en cada cambio interpolar barras y números suavemente
        let estadoPrevRival = {};
        gridComp.innerHTML = METRICAS_COMP.map(m =>
          `<div class="compCard" data-mk="${m.k}">` +
            `<div class="compCardTop">` +
              `<span class="compCardTitulo">${m.titulo}</span>` +
              `<span class="compCardUnidad">${m.unidad}</span>` +
            `</div>` +
            `<div class="compFila">` +
              `<div class="compFilaMeta">` +
                `<span class="compNom foco">▸ Westminster</span>` +
                `<strong class="compVal foco">${west[m.k] != null ? m.fmt(west[m.k]) : '—'}</strong>` +
              `</div>` +
              `<div class="compBarraTrack"><span class="compBarraFill foco" style="width:50%"></span></div>` +
            `</div>` +
            `<div class="compFila">` +
              `<div class="compFilaMeta">` +
                `<span class="compNom compNomRival">—</span>` +
                `<strong class="compVal compValRival">—</strong>` +
              `</div>` +
              `<div class="compBarraTrack"><span class="compBarraFill rival" style="width:50%"></span></div>` +
            `</div>` +
            `<div class="compDelta"></div>` +
          `</div>`
        ).join('');

        const pintarComparacion = (codRival, animar = true) => {
          const riv = mapaB[codRival] || rivales[0];
          METRICAS_COMP.forEach(m => {
            const card = gridComp.querySelector(`.compCard[data-mk="${m.k}"]`);
            if (!card) return;
            const vW = west[m.k];
            const vR = riv[m.k];
            const tieneAmbos = typeof vW === 'number' && typeof vR === 'number';
            const maxLocal = Math.max(Number(vW) || 0, Number(vR) || 0, 1);
            const pctW = tieneAmbos ? Math.max(4, (vW / maxLocal) * 100) : 0;
            const pctR = tieneAmbos ? Math.max(4, (vR / maxLocal) * 100) : 0;

            card.querySelector('.compNomRival').textContent = riv.nombre;
            card.querySelector('.compBarraFill.foco').style.width = `${pctW.toFixed(1)}%`;
            card.querySelector('.compBarraFill.rival').style.width = `${pctR.toFixed(1)}%`;

            const elValRival = card.querySelector('.compValRival');
            const elDelta = card.querySelector('.compDelta');
            const prevVal = typeof estadoPrevRival[m.k] === 'number' ? estadoPrevRival[m.k] : (typeof vR === 'number' ? vR * 0.85 : 0);

            if (typeof vR === 'number') {
              if (animar && !sinMovimiento()) {
                animarNumeroElemento(elValRival, prevVal, vR, 520, 0, m.fmt, m.dec, ease => {
                  if (!tieneAmbos) return;
                  const rInterp = prevVal + (vR - prevVal) * ease;
                  const dif = vW - rInterp;
                  const signo = dif > 0 ? '+' : (dif < 0 ? '−' : '');
                  const absDif = Math.abs(dif);
                  const difStr = m.esMoneda
                    ? libras(absDif)
                    : fmt(m.dec ? Number(absDif.toFixed(m.dec)) : Math.round(absDif));
                  const pctDif = rInterp !== 0 ? ((dif / rInterp) * 100) : 0;
                  const pctStr = `${dif >= 0 ? '+' : ''}${pctDif.toFixed(1).replace('.', ',')}%`;
                  elDelta.innerHTML = `Δ Westminster: <b>${signo}${difStr}</b> (${pctStr})`;
                });
              } else {
                elValRival.textContent = m.fmt(vR);
              }
              estadoPrevRival[m.k] = vR;
            } else {
              elValRival.textContent = '—';
              elDelta.textContent = 'Dato parcial';
            }

            if (tieneAmbos && (!animar || sinMovimiento())) {
              const dif = vW - vR;
              const signo = dif > 0 ? '+' : (dif < 0 ? '−' : '');
              const absDif = Math.abs(dif);
              const difStr = m.esMoneda
                ? libras(absDif)
                : fmt(m.dec ? Number(absDif.toFixed(m.dec)) : Math.round(absDif));
              const pctDif = vR !== 0 ? ((dif / vR) * 100) : 0;
              const pctStr = `${dif >= 0 ? '+' : ''}${pctDif.toFixed(1).replace('.', ',')}%`;
              elDelta.innerHTML = `Δ Westminster: <b>${signo}${difStr}</b> (${pctStr})`;
            }
          });
        };

        const selectEl = barraComp.querySelector('#selectBoroughRival');
        const botonesAtajo = barraComp.querySelectorAll('.btnRivalAtajo');

        selectEl.addEventListener('change', () => {
          const cod = selectEl.value;
          botonesAtajo.forEach(b => b.classList.toggle('activo', b.dataset.rival === cod));
          pintarComparacion(cod);
        });

        botonesAtajo.forEach(btn => {
          btn.addEventListener('click', () => {
            const cod = btn.dataset.rival;
            selectEl.value = cod;
            botonesAtajo.forEach(b => b.classList.toggle('activo', b === btn));
            pintarComparacion(cod);
          });
        });

        pintarComparacion(selectEl.value || 'E09000007');
        a.appendChild(bloque(
          'Comparador bilateral cara a cara: Westminster frente a otro borough',
          '6 indicadores oficiales cruzados por código GSS · Bermellón vs. Azul Támesis',
          compWrap
        ));
      }

      // Consola Metropolitana Unificada (Vista Gráfica + Cuadro Estadístico + Selector de Métrica + Cortina S-curve)
      const METRICAS_ATLAS = [
        { k: 'precio',    boton: 'Precio vivienda (£)',   titulo: 'Precio medio residencial', fmt: libras },
        { k: 'densidad',  boton: 'Densidad (hab/km²)',    titulo: 'Densidad poblacional',     fmt: fmt },
        { k: 'poblacion', boton: 'Población residente',   titulo: 'Población total',          fmt: fmt },
        { k: 'tax',       boton: 'Council Tax D (£)',     titulo: 'Council Tax Banda D',      fmt: librasDec },
      ];

      let vistaAtlas = 'barras'; // 'barras' | 'tabla'
      let metricaAtlas = 'precio';
      let expandidoAtlas = false;
      let animAtlas = null;

      const consolaAtlas = document.createElement('div');
      consolaAtlas.className = 'atlasConsola';

      // Barra de herramientas superior (Conmutador Gráfico/Tabla + Ordenar por métrica)
      const barraAtlas = document.createElement('div');
      barraAtlas.className = 'atlasToolbar';
      barraAtlas.innerHTML =
        `<div class="atlasModoGrupo" role="tablist" aria-label="Modo de visualización del Atlas">` +
          `<button type="button" data-modo="barras" class="btnModoAtlas activo" role="tab" aria-selected="true">Vista Gráfica (Barras)</button>` +
          `<button type="button" data-modo="tabla" class="btnModoAtlas" role="tab" aria-selected="false">Cuadro Estadístico (6 columnas)</button>` +
        `</div>` +
        `<div class="atlasOrdenGrupo">` +
          `<span class="filtroLabel">ORDENAR JERARQUÍA POR:</span>` +
          `<div class="atlasMetricasBtns">` +
            METRICAS_ATLAS.map((m, idx) =>
              `<button type="button" data-m="${m.k}" class="btnMetricaAtlas${idx === 0 ? ' activo' : ''}">${m.boton}</button>`
            ).join('') +
          `</div>` +
        `</div>`;
      consolaAtlas.appendChild(barraAtlas);

      const marcoAnimAtlas = document.createElement('div');
      marcoAnimAtlas.className = 'atlasViewport';
      const innerAtlas = document.createElement('div');
      innerAtlas.className = 'atlasInner';
      marcoAnimAtlas.appendChild(innerAtlas);
      consolaAtlas.appendChild(marcoAnimAtlas);

      // Botón inferior de cortina para alternar entre Síntesis (10 clave) y los 33 boroughs
      const pieToggleAtlas = document.createElement('button');
      pieToggleAtlas.type = 'button';
      pieToggleAtlas.className = 'btnToggleAtlas';
      pieToggleAtlas.setAttribute('aria-expanded', 'false');
      consolaAtlas.appendChild(pieToggleAtlas);

      // Construye la lista recortada (Top 6 + Westminster garantizado + Bottom 4) o completa (33)
      const obtenerListaOrdenada = claveM => {
        const m = METRICAS_ATLAS.find(x => x.k === claveM) || METRICAS_ATLAS[0];
        const ord = listaUnificada.slice().sort((x, y) => (Number(y[m.k]) || 0) - (Number(x[m.k]) || 0));
        ord.forEach((item, idx) => { item._rank = idx + 1; });
        return { m, ord };
      };

      const renderContenidoAtlas = () => {
        const { m, ord } = obtenerListaOrdenada(metricaAtlas);
        innerAtlas.innerHTML = '';

        // Definir subconjunto si está en modo síntesis (Top 6 + Westminster si no está en Top 6/Bottom 4 + Bottom 4)
        let itemsSup = ord.slice(0, 6);
        let itemsInf = ord.slice(-4);
        const westItem = ord.find(b => b.foco);
        const westEnSup = itemsSup.some(b => b.foco);
        const westEnInf = itemsInf.some(b => b.foco);
        const ocultosN = ord.length - itemsSup.length - itemsInf.length - ((!westEnSup && !westEnInf && westItem) ? 1 : 0);

        if (vistaAtlas === 'barras') {
          const maxGlobal = Math.max(...ord.map(b => Number(b[m.k]) || 0), 1);
          if (expandidoAtlas) {
            const filasCompletas = ord.map(b => [`#${b._rank} ${b.nombre}`, b[m.k] || 0, b.foco]);
            innerAtlas.appendChild(G.barras(filasCompletas, { formato: m.fmt, anchoEtiqueta: 220, maxGlobal }));
          } else {
            const filasSup = itemsSup.map(b => [`#${b._rank} ${b.nombre}`, b[m.k] || 0, b.foco]);
            innerAtlas.appendChild(G.barras(filasSup, { formato: m.fmt, anchoEtiqueta: 220, maxGlobal }));

            if (!westEnSup && !westEnInf && westItem) {
              const sep1 = document.createElement('div');
              sep1.className = 'atlasCorteFranja';
              sep1.innerHTML = `<span>··· Posición intermedia de Westminster en ${m.titulo.toLowerCase()} ···</span>`;
              innerAtlas.appendChild(sep1);
              innerAtlas.appendChild(G.barras([[`#${westItem._rank} ${westItem.nombre}`, westItem[m.k] || 0, true]], {
                formato: m.fmt,
                anchoEtiqueta: 220,
                maxGlobal
              }));
            }

            const sepCorte = document.createElement('div');
            sepCorte.className = 'atlasCorteFranja';
            sepCorte.innerHTML =
              `<span>··· ${ocultosN} boroughs intermedios plegados (vista ejecutiva: extremos + foco) ···</span>`;
            innerAtlas.appendChild(sepCorte);

            const filasInf = itemsInf.map(b => [`#${b._rank} ${b.nombre}`, b[m.k] || 0, b.foco]);
            const cajaInf = G.barras(filasInf, { formato: m.fmt, anchoEtiqueta: 220, maxGlobal });
            innerAtlas.appendChild(cajaInf);
          }
        } else {
          // Vista de Cuadro Estadístico (6 columnas)
          const cabeceras = ['#', 'Borough', 'Código GSS', 'Población', 'Densidad (hab/km²)', 'Council Tax D', 'Precio medio (£)'];
          const colActivaIdx = { poblacion: 3, densidad: 4, tax: 5, precio: 6 }[metricaAtlas] || 6;
          const armarFila = b => [
            `<code>#${b._rank}</code>`,
            b.foco ? `<strong>▸ ${b.nombre}</strong>` : b.nombre,
            `<code>${b.codigo}</code>`,
            fmt(b.poblacion),
            fmt(b.densidad),
            b.tax ? librasDec(b.tax) : '—',
            libras(b.precio || 0),
            b.foco
          ];

          let filasTabla = [];
          if (expandidoAtlas) {
            filasTabla = ord.map(armarFila);
          } else {
            filasTabla = [
              ...itemsSup.map(armarFila),
              ...(!westEnSup && !westEnInf && westItem ? [armarFila(westItem)] : []),
              ...itemsInf.map(armarFila)
            ];
          }
          const tDom = tabla(cabeceras, filasTabla, 7);
          // Resaltar columna por la cual se está ordenando
          const ths = tDom.querySelectorAll('thead th');
          if (ths[colActivaIdx]) ths[colActivaIdx].classList.add('colActiva');
          tDom.querySelectorAll('tbody tr').forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds[colActivaIdx]) tds[colActivaIdx].classList.add('colActiva');
          });
          if (!expandidoAtlas) {
            // Insertar fila divisoria visual entre el bloque superior y los 4 inferiores
            const trs = tDom.querySelectorAll('tbody tr');
            const idxCorte = itemsSup.length + (!westEnSup && !westEnInf && westItem ? 1 : 0);
            if (trs[idxCorte]) {
              const trSep = document.createElement('tr');
              trSep.className = 'filaCorteTabla';
              trSep.innerHTML = `<td colspan="7">··· ${ocultosN} boroughs intermedios plegados ···</td>`;
              trs[idxCorte].parentNode.insertBefore(trSep, trs[idxCorte]);
            }
          }
          innerAtlas.appendChild(tDom);
        }

        pieToggleAtlas.setAttribute('aria-expanded', String(expandidoAtlas));
        pieToggleAtlas.innerHTML = expandidoAtlas
          ? `<span class="toggleAtlasIcon">▲</span> <span>Contraer a vista ejecutiva (Top 6 + Westminster + 4 menores)</span>`
          : `<span class="toggleAtlasIcon">▼</span> <span>Desplegar los 33 boroughs completos (+${ocultosN} distritos intermedios)</span>`;
      };

      let animInner = [];
      const limpiarAnimInner = () => {
        animInner.forEach(a => { try { a.cancel(); } catch (_) {} });
        animInner = [];
      };

      const cambiarConCortina = (mutarEstado, tipoTransicion = 'cortina') => {
        const sinMov = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (animAtlas) { animAtlas.cancel(); animAtlas = null; }
        limpiarAnimInner();

        const ejecutarCambioYEntrada = () => {
          const hAntes = marcoAnimAtlas.getBoundingClientRect().height;
          mutarEstado();
          renderContenidoAtlas();

          if (sinMov) {
            marcoAnimAtlas.style.height = 'auto';
            return;
          }

          // 1. Si ya está en pantalla, disparar el llenado de barras inmediatamente (por cambio de tab o modo)
          innerAtlas.querySelectorAll('.svgCaja').forEach(cajaSvg => {
            cajaSvg.setAttribute('data-anim', 'visible');
            if (typeof cajaSvg._alEntrar === 'function') {
              cajaSvg._alEntrar();
              cajaSvg._alEntrar = null;
            }
          });

          // 2. Cortina de altura suave en curva S si la altura cambió
          marcoAnimAtlas.style.height = 'auto';
          const hDespues = innerAtlas.getBoundingClientRect().height;
          if (hAntes && Math.abs(hDespues - hAntes) >= 4) {
            marcoAnimAtlas.style.height = `${hAntes}px`;
            animAtlas = marcoAnimAtlas.animate(
              [
                { height: `${hAntes}px` },
                { height: `${hDespues}px` }
              ],
              { duration: 540, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
            );
            animAtlas.onfinish = () => {
              marcoAnimAtlas.style.height = 'auto';
              animAtlas = null;
            };
          }

          // 3. Coreografía de entrada según el tipo de cambio (modo Vista/Tabla vs. cambio de Métrica vs. Despliegue)
          if (tipoTransicion === 'modo') {
            const dirX = vistaAtlas === 'tabla' ? 16 : -16;
            const aCont = innerAtlas.animate(
              [
                { opacity: 0, transform: `translateX(${dirX}px)` },
                { opacity: 1, transform: 'translateX(0px)' }
              ],
              { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
            );
            animInner.push(aCont);
          }

          const filasAnimables = vistaAtlas === 'barras'
            ? [...innerAtlas.querySelectorAll('.filaBarra, .atlasCorteFranja')]
            : [...innerAtlas.querySelectorAll('thead tr, tbody tr')];

          filasAnimables.slice(0, 20).forEach((fila, idx) => {
            const aFila = fila.animate(
              [
                { opacity: 0, transform: 'translateY(8px)' },
                { opacity: 1, transform: 'translateY(0px)' }
              ],
              {
                duration: 380,
                delay: idx * 20,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'both'
              }
            );
            animInner.push(aFila);
          });
        };

        // Si es cambio entre Vista Gráfica y Cuadro Estadístico (o cambio de métrica), hacer micro-salida rápida primero
        if (!sinMov && (tipoTransicion === 'modo' || tipoTransicion === 'metrica')) {
          const dirOut = tipoTransicion === 'modo' ? (vistaAtlas === 'barras' ? -10 : 10) : 0;
          const yOut = tipoTransicion === 'metrica' ? -6 : 0;
          const aOut = innerAtlas.animate(
            [
              { opacity: 1, transform: 'translate(0px, 0px)' },
              { opacity: 0, transform: `translate(${dirOut}px, ${yOut}px)` }
            ],
            { duration: 130, easing: 'cubic-bezier(0.4, 0, 1, 1)' }
          );
          animInner.push(aOut);
          aOut.onfinish = ejecutarCambioYEntrada;
        } else {
          ejecutarCambioYEntrada();
        }
      };

      barraAtlas.querySelectorAll('.btnModoAtlas').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.modo === vistaAtlas) return;
          barraAtlas.querySelectorAll('.btnModoAtlas').forEach(b => {
            const act = b === btn;
            b.classList.toggle('activo', act);
            b.setAttribute('aria-selected', String(act));
          });
          cambiarConCortina(() => { vistaAtlas = btn.dataset.modo; }, 'modo');
        });
      });

      barraAtlas.querySelectorAll('.btnMetricaAtlas').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.m === metricaAtlas) return;
          barraAtlas.querySelectorAll('.btnMetricaAtlas').forEach(b => b.classList.toggle('activo', b === btn));
          cambiarConCortina(() => { metricaAtlas = btn.dataset.m; }, 'metrica');
        });
      });

      pieToggleAtlas.addEventListener('click', () => {
        cambiarConCortina(() => { expandidoAtlas = !expandidoAtlas; }, 'cortina');
      });

      renderContenidoAtlas();
      a.appendChild(bloque(
        'Jerarquía y cuadro consolidado de los 33 boroughs de Greater London',
        'Vista síntesis de extremos por defecto · Conmute entre gráfico y tabla o despliegue los 33 distritos',
        consolaAtlas
      ));
    }
    if (LAGO.atlas_boroughs && LAGO.atlas_boroughs.nota) {
      a.appendChild(aviso('<strong>Por qué dos escalas · ONS & UK HPI</strong> ' + LAGO.atlas_boroughs.nota));
    }
    main.appendChild(a);

    // =========================================================================
    // 09 · CORRELACIONES Y CONTROL DE FALSOS POSITIVOS
    // =========================================================================
    const co = seccion('correlaciones', 'RIGOR ESTADÍSTICO · ASOCIACIÓN VS CAUSA', 'Matriz de correlaciones (Pearson)',
      'Una correlación mide asociación lineal entre variables territoriales y jamás debe leerse como efecto causal. ' +
      'El sistema publica cuántos pares evalúa y cuántos darían «significativos» por simple azar al 5 %.');
    co.appendChild(rejilla([
      tile('correlaciones', 'asociacion_mas_fuerte', 'Asociación más intensa (Área ↔ Densidad)', null, true),
      tile('correlaciones', 'asociaciones_fuertes', 'Pares con asociación fuerte (|r| ≥ 0,5)', null, true),
      tile('correlaciones', 'metricas_n', 'Variables territoriales cruzadas'),
      tile('correlaciones', 'pares_n', 'Pares bivariados evaluados'),
      tile('correlaciones', 'esperados_por_azar', 'Falsos positivos esperados al 5 % (α = 0,05)'),
    ]));

    const pares = LAGO.correlaciones && LAGO.correlaciones.listas.pares;
    if (listaUnificada.length && G.dispersion) {
      const CRUCES = [
        {
          id: 'tax_precio',
          boton: 'Council Tax vs. Precio vivienda',
          sub: 'Paradoja fiscal metropolitana: Westminster y Wandsworth combinan la vivienda más cara con el impuesto local más bajo.',
          x: 'tax', etiqX: 'Council Tax Banda D (£)', fmtX: libras,
          y: 'precio', etiqY: 'Precio medio vivienda (£)', fmtY: libras
        },
        {
          id: 'area_densidad',
          boton: 'Superficie vs. Densidad',
          sub: 'Asociación estructural más intensa de Londres (r = −0,76): los boroughs centrales compactos triplican la densidad periférica.',
          x: 'area', etiqX: 'Superficie territorial (km²)', fmtX: fmt,
          y: 'densidad', etiqY: 'Densidad (hab/km²)', fmtY: fmt
        },
        {
          id: 'imd_vida',
          boton: 'Privación IMD vs. Esperanza de vida',
          sub: 'Gradiente socio-sanitario: a mayor puntaje de privación media (IMD 2025), menor esperanza de vida al nacer.',
          x: 'imd', etiqX: 'Puntaje medio privación (IMD 2025)', fmtX: fmt,
          y: 'vida', etiqY: 'Esperanza de vida al nacer (años)', fmtY: fmt
        },
        {
          id: 'densidad_delitos',
          boton: 'Densidad vs. Tasa policial',
          sub: 'Efecto del denominador residente: Westminster sobresale como valor extremo por concentrar el flujo turístico y comercial.',
          x: 'densidad', etiqX: 'Densidad (hab/km²)', fmtX: fmt,
          y: 'delitos', etiqY: 'Delitos por 1.000 residentes', fmtY: fmt
        }
      ];

      const wrapDisp = document.createElement('div');
      wrapDisp.className = 'dispInteractiva';

      const barraCruces = document.createElement('div');
      barraCruces.className = 'dispControles';
      barraCruces.innerHTML =
        `<span class="filtroLabel">EXPLORAR PAR BIVARIADO:</span>` +
        `<div class="dispBotones">` +
          CRUCES.map((cr, idx) =>
            `<button type="button" data-cruce="${cr.id}" class="btnCruceDisp${idx === 0 ? ' activo' : ''}">${cr.boton}</button>`
          ).join('') +
        `</div>`;
      wrapDisp.appendChild(barraCruces);

      const notaCruce = document.createElement('p');
      notaCruce.className = 'dispSubLectura';
      wrapDisp.appendChild(notaCruce);

      const lienzoDisp = document.createElement('div');
      wrapDisp.appendChild(lienzoDisp);

      let instanciaDisp = null;
      const pintarCruce = idCruce => {
        const cr = CRUCES.find(c => c.id === idCruce) || CRUCES[0];
        notaCruce.textContent = cr.sub;
        const pts = listaUnificada.map(b => ({
          nombre: b.nombre,
          codigo: b.codigo,
          foco: b.foco,
          x: b[cr.x],
          y: b[cr.y]
        }));
        const opts = {
          etiquetaX: cr.etiqX,
          etiquetaY: cr.etiqY,
          fmtX: cr.fmtX,
          fmtY: cr.fmtY
        };
        if (instanciaDisp && typeof instanciaDisp.actualizar === 'function') {
          instanciaDisp.actualizar(pts, opts);
        } else {
          lienzoDisp.innerHTML = '';
          instanciaDisp = G.dispersion(pts, opts);
          lienzoDisp.appendChild(instanciaDisp);
        }
      };

      barraCruces.querySelectorAll('.btnCruceDisp').forEach(btn => {
        btn.addEventListener('click', () => {
          barraCruces.querySelectorAll('.btnCruceDisp').forEach(b => b.classList.remove('activo'));
          btn.classList.add('activo');
          pintarCruce(btn.dataset.cruce);
        });
      });

      pintarCruce(CRUCES[0].id);
      co.appendChild(bloque(
        'Laboratorio bivariado de los 33 boroughs (Regresión OLS y cuadrantes de media)',
        'Pase el cursor por cualquier punto · Westminster en bermellón',
        wrapDisp
      ));
    }

    if (pares) {
      co.appendChild(bloque('Pares evaluados sobre los 33 boroughs, ordenados por magnitud |r|', 'Coeficiente r de Pearson y estadístico t',
        tabla(['Par de variables comparadas', 'Coeficiente r', 'Estadístico t', 'Muestra (n)', 'Intensidad'],
          pares.map(p => [
            `<strong>${p.etiqueta_a}</strong> ↔ <strong>${p.etiqueta_b}</strong>`,
            fmt(p.r),
            fmt(p.t),
            p.n,
            p.fuerte ? '<span class="pastilla integrado">|r| ≥ 0,50</span>' : '<span class="pastilla">débil / moderada</span>',
            p.fuerte
          ]), 5)));
    }
    co.appendChild(aviso(
      '<strong>Higiene contra el p-hacking</strong> Con ' + (cifra('correlaciones', 'metricas_n') || {}).valor +
      ' métricas se forman ' + (cifra('correlaciones', 'pares_n') || {}).valor + ' pares. Evaluados al 5 %, cabría ' +
      'esperar ~' + fmt((cifra('correlaciones', 'esperados_por_azar') || {}).valor) +
      ' cruces «significativos» por puro ruido aleatorio. Por eso el número esperado por azar viaja impreso junto a la tabla.'));
    main.appendChild(co);

    // =========================================================================
    // 10 · AMBIENTE: MODELO GLOBAL VS ESTACIONES FÍSICAS LAQN
    // =========================================================================
    const am = seccion('ambiente', 'MODELO GLOBAL VS ESTACIÓN · OPEN-METEO & LAQN', 'Ambiente: modelo vs. estación física',
      'Contrastamos la interpolación meteorológica y de calidad de aire de Open-Meteo (modelo numérico) con las ' +
      'lecturas físicas reales de la red LAQN del Imperial College London.');
    am.appendChild(rejilla([
      tile('sensores', 'temperatura_actual', 'Temperatura actual (Westminster)', null, true),
      tile('aire_laqn', 'indice_aire_westminster', 'Índice DAQI medido en estaciones LAQN', null, true),
      tile('sensores', 'humedad_actual', 'Humedad relativa'),
      tile('sensores', 'viento_actual', 'Velocidad del viento'),
      tile('sensores', 'pm25_actual', 'PM2.5 (modelo atmosférico CAMS)'),
      tile('sensores', 'no2_actual', 'NO₂ (modelo atmosférico CAMS)'),
      tile('sensores', 'aqi_europeo', 'Índice Europeo de Aire (modelo)'),
      tile('aire_laqn', 'boroughs_con_estacion_n', 'Boroughs con estación LAQN activa hoy'),
      tile('aire_laqn', 'puesto_aire_westminster', 'Puesto de Westminster en red LAQN'),
    ]));

    const pm = LAGO.sensores && LAGO.sensores.series.pm25_diario;
    const pron = LAGO.sensores && LAGO.sensores.series.pronostico_max;
    am.appendChild(dosColumnas(
      pm ? bloque('Partículas finas PM2.5 · Media diaria reciente', 'Open-Meteo Air Quality (µg/m³)',
        G.linea(pm.puntos, 'PM2.5')) : null,
      pron ? bloque('Pronóstico de temperatura máxima diaria', 'Open-Meteo · Modelo numérico (°C)',
        G.linea(pron.puntos, 'Máxima')) : null
    ));
    if (LAGO.aire_laqn && LAGO.aire_laqn.nota) {
      am.appendChild(aviso('<strong>Diferencia entre sensor físico y modelo</strong> ' + LAGO.aire_laqn.nota));
    }
    main.appendChild(am);

    // =========================================================================
    // 11 · ESCUCHA DIGITAL Y ATENCIÓN PÚBLICA
    // =========================================================================
    const es = seccion('escucha', 'INTERÉS PÚBLICO · WIKIMEDIA REST API', 'Escucha social (Wikimedia Pageviews)',
      'Consultas mensuales a los artículos enciclopédicos de cada borough. Mide atención informativa global, ' +
      'no afluencia física de visitantes.');
    es.appendChild(rejilla([
      tile('escucha', 'vistas_ultimo_mes', 'Lecturas en el último mes (Westminster)', null, true),
      tile('escucha', 'puesto_entre_boroughs', 'Puesto de atención entre boroughs', null, true),
      tile('escucha', 'vistas_pico_mes', 'Pico mensual en el último año'),
    ]));

    const we = LAGO.escucha && LAGO.escucha.series.wiki_westminster;
    let bloqueCompEscucha = null;
    if (LAGO.escucha && LAGO.escucha.series) {
      const ult = Object.entries(LAGO.escucha.series)
        .map(([k, v]) => [k.replace('wiki_', '').replace(/_/g, ' '),
          v.puntos[v.puntos.length - 1][1], k === 'wiki_westminster'])
        .sort((a, b) => b[1] - a[1]);
      bloqueCompEscucha = bloque('Comparativa de atención en el último mes', 'Wikimedia REST API · Inglés',
        G.barras(ult, { anchoEtiqueta: 175 }));
    }
    es.appendChild(dosColumnas(
      we ? bloque('Serie mensual de lecturas · Artículo «City of Westminster»', '12 meses completos',
        G.linea(we.puntos, 'Vistas')) : null,
      bloqueCompEscucha
    ));
    if (LAGO.escucha && LAGO.escucha.nota) {
      es.appendChild(aviso('<strong>Atención, no afluencia · Wikimedia Pageviews</strong> ' + LAGO.escucha.nota));
    }
    main.appendChild(es);

    // =========================================================================
    // 12 · FUENTES, CATÁLOGO Y AUDITORÍA DE DATOS (COLAPSABLE CON ANIMACIÓN FLUIDA)
    // =========================================================================
    const fu = seccion('fuentes', 'TRAZABILIDAD Y GOBERNANZA · CATÁLOGO COMPLETO', 'Catálogo de fuentes y método',
      'Un catálogo honesto documenta también las fuentes que cayeron (504/400), las candidatas y las excluidas por ' +
      'privacidad. Por defecto el inventario técnico permanece plegado para facilitar la lectura ejecutiva.');
    const cata = LAGO.catalogo;
    if (cata) {
      const det = document.createElement('div');
      det.className = 'acordeonFuentes';
      det.id = 'detallesFuentes';
      det.dataset.open = 'false';

      const sum = document.createElement('button');
      sum.type = 'button';
      sum.className = 'acordeonResumen';
      sum.setAttribute('aria-expanded', 'false');
      sum.setAttribute('aria-controls', 'acordeonPanelFuentes');

      const chipsEstado = Object.entries(cata.por_estado)
        .map(([est, n]) => `<span class="pastilla ${est}">${est}: ${n}</span>`).join('');
      sum.innerHTML =
        `<div class="acordeonInfo">` +
          `<div class="acordeonTituloFila">` +
            `<strong>Auditoría de ${cata.n} fuentes rastreadas</strong>` +
            `<span class="bloqueMeta">Verificadas automáticamente antes del despliegue</span>` +
          `</div>` +
          `<div class="acordeonChips">${chipsEstado}</div>` +
        `</div>` +
        `<div class="acordeonAccion">` +
          `<svg class="iconoAcordeon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">` +
            `<path class="trazoV" d="M8 3v10"/><path d="M3 8h10"/>` +
          `</svg>` +
          `<span class="txtCerrar">Colapsar inventario</span>` +
          `<span class="txtAbrir">Desplegar inventario (${cata.n} fuentes)</span>` +
        `</div>`;
      det.appendChild(sum);

      const gridWrap = document.createElement('div');
      gridWrap.className = 'acordeonGridWrap';
      gridWrap.id = 'acordeonPanelFuentes';
      gridWrap.setAttribute('aria-hidden', 'true');

      const gridInner = document.createElement('div');
      gridInner.className = 'acordeonGridInner';

      const cuerpo = document.createElement('div');
      cuerpo.className = 'acordeonCuerpo';

      // Barra de filtro rápido por estado dentro del desplegable
      const barraFiltro = document.createElement('div');
      barraFiltro.className = 'filtroFuentes';
      const estadosUnicos = ['todos', ...Object.keys(cata.por_estado)];
      barraFiltro.innerHTML =
        `<span class="filtroLabel">FILTRAR POR ESTADO:</span>` +
        estadosUnicos.map((est, idx) =>
          `<button type="button" data-est="${est}" class="btnFiltroFuente${idx === 0 ? ' activo' : ''}">` +
            `${est === 'todos' ? `Todos (${cata.n})` : `${est} (${cata.por_estado[est]})`}` +
          `</button>`
        ).join('');
      cuerpo.appendChild(barraFiltro);

      const contenedorTabla = document.createElement('div');
      const pintarTablaFuentes = (estadoFiltro, animarFilas = false) => {
        const listaFiltrada = estadoFiltro === 'todos'
          ? cata.datasets
          : cata.datasets.filter(d => d.estado === estadoFiltro);
        contenedorTabla.innerHTML = '';
        const tbl = tabla(
          ['Fuente / Conjunto de datos', 'Entidad', 'Estado', 'Licencia', '¿Personas?', 'Probado el'],
          listaFiltrada.map(d => [
            `<a href="${d.url}" target="_blank" rel="noopener noreferrer"><strong>${d.nombre}</strong></a>` +
            (d.nota ? `<br><small style="color:var(--suave)">${d.nota}</small>` : ''),
            d.entidad,
            `<span class="pastilla ${d.estado}">${d.estado}</span>`,
            `<code>${d.licencia}</code>`,
            d.personas,
            `<code>${d.probado}</code>`
          ]));
        tbl.querySelectorAll('tbody tr').forEach((tr, idx) => {
          tr.style.setProperty('--row-i', String(Math.min(idx, 18)));
          if (animarFilas) tr.classList.add('filaFiltrada');
        });
        contenedorTabla.appendChild(tbl);
      };
      pintarTablaFuentes('todos', false);

      barraFiltro.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          barraFiltro.querySelectorAll('button').forEach(b => b.classList.remove('activo'));
          btn.classList.add('activo');
          pintarTablaFuentes(btn.dataset.est, true);
        });
      });

      cuerpo.appendChild(bloque(
        'Inventario completo del catálogo de datos',
        'Incluye estado de enlace, licencia cerrada y evaluación de datos personales',
        contenedorTabla
      ));

      cuerpo.appendChild(aviso(
        '<strong>Dos garantías adicionales frente al Cerebro Lima</strong> Cada ficha de este catálogo exige ' +
        '<code>probado</code> (fecha ISO en que el endpoint respondió 200) y <code>personas</code> ' +
        '(declaración explícita de si existen datos personales o cuasi-identificadores como el postcode británico). ' +
        'El verificador automático bloquea el despliegue si falta cualquiera de los dos.'));

      gridInner.appendChild(cuerpo);
      gridWrap.appendChild(gridInner);
      det.appendChild(gridWrap);

      // Coreografía de apertura y cierre en tres tiempos (Cortina S-curve + Bloques + Filas)
      let animCaja = null;
      let animItems = [];
      let estaAbierto = false;

      const limpiarAnimItems = () => {
        animItems.forEach(a => { try { a.cancel(); } catch (_) {} });
        animItems = [];
      };

      const alternarAcordeon = forzar => {
        const abrir = typeof forzar === 'boolean' ? forzar : !estaAbierto;
        if (abrir === estaAbierto) return;
        estaAbierto = abrir;

        const sinMov = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const hActual = gridWrap.getBoundingClientRect().height;

        if (animCaja) { animCaja.cancel(); animCaja = null; }
        limpiarAnimItems();

        det.dataset.open = abrir ? 'true' : 'false';
        sum.setAttribute('aria-expanded', String(abrir));
        gridWrap.setAttribute('aria-hidden', String(!abrir));

        if (sinMov) {
          gridWrap.style.height = abrir ? 'auto' : '0px';
          gridWrap.style.opacity = abrir ? '1' : '0';
          return;
        }

        const piezas = [barraFiltro, ...cuerpo.querySelectorAll('.bloque, .aviso')].filter(Boolean);
        const filasVisibles = [...cuerpo.querySelectorAll('tbody tr')].slice(0, 14);

        if (abrir) {
          // 1. Medir altura real de destino sin parpadeo
          gridWrap.style.height = 'auto';
          const hFinal = gridInner.getBoundingClientRect().height;
          gridWrap.style.height = `${hActual}px`;
          gridWrap.style.opacity = '1';

          // 2. Cortina contenedora con curva S simétrica (arranca suave, acelera en el medio y frena con seda)
          animCaja = gridWrap.animate(
            [
              { height: `${hActual}px` },
              { height: `${hFinal}px` }
            ],
            { duration: 680, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
          );

          // 3. Entrada escalonada de la barra de filtro, el bloque de tabla y la nota de gobernanza
          piezas.forEach((el, idx) => {
            const a = el.animate(
              [
                { opacity: 0, transform: 'translateY(14px)' },
                { opacity: 1, transform: 'translateY(0px)' }
              ],
              {
                duration: 520,
                delay: 90 + idx * 75,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'both'
              }
            );
            animItems.push(a);
          });

          // 4. Micro-cascada en las primeras filas visibles del catálogo
          filasVisibles.forEach((tr, idx) => {
            const a = tr.animate(
              [
                { opacity: 0, transform: 'translateY(8px)' },
                { opacity: 1, transform: 'translateY(0px)' }
              ],
              {
                duration: 420,
                delay: 160 + idx * 22,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'both'
              }
            );
            animItems.push(a);
          });

          animCaja.onfinish = () => {
            gridWrap.style.height = 'auto';
            animCaja = null;
          };
        } else {
          // Cierre tipo cortina real: el contenido permanece visible mientras el borde inferior
          // sube recortándolo limpiamente (sin blanquear antes de cerrar), y se desvanece solo al final.
          const rectDet = det.getBoundingClientRect();
          if (rectDet.top < 90) {
            window.scrollTo({ top: window.scrollY + rectDet.top - 115, behavior: 'smooth' });
          }

          gridWrap.style.height = `${hActual}px`;
          gridWrap.style.opacity = '1';

          const aCuerpo = cuerpo.animate(
            [
              { transform: 'translateY(0px)' },
              { transform: 'translateY(-14px)' }
            ],
            {
              duration: 520,
              easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
              fill: 'both'
            }
          );
          animItems.push(aCuerpo);

          animCaja = gridWrap.animate(
            [
              { height: `${hActual}px`, opacity: 1, offset: 0 },
              { height: `${Math.round(hActual * 0.25)}px`, opacity: 0.92, offset: 0.65 },
              { height: '0px', opacity: 0, offset: 1 }
            ],
            {
              duration: 520,
              easing: 'cubic-bezier(0.65, 0, 0.35, 1)'
            }
          );

          animCaja.onfinish = () => {
            gridWrap.style.height = '0px';
            gridWrap.style.opacity = '0';
            limpiarAnimItems();
            animCaja = null;
          };
        }
      };

      sum.addEventListener('click', () => alternarAcordeon());

      fu.appendChild(det);
    }
    main.appendChild(fu);
  }

  return { render, abrirFicha };
})();
