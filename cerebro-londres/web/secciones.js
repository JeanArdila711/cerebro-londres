// Pinta las secciones desde el lago. Ninguna cifra se escribe a mano aquí:
// todas salen de LAGO, y cada una lleva su ficha de procedencia a un clic.
window.SECCIONES = (function () {
  const fmt = n => typeof n === 'number' ? new Intl.NumberFormat('es-ES').format(n) : n;
  const libras = n => '£' + new Intl.NumberFormat('es-ES').format(Math.round(n));
  let LAGO = {};

  function cifra(tema, clave) {
    const t = LAGO[tema];
    return t && t.cifras ? t.cifras[clave] : null;
  }

  function fuenteDe(tema, id) {
    const t = LAGO[tema];
    return t && t.fuentes ? t.fuentes.find(f => f.id === id) : null;
  }

  // Una baldosa = una cifra + su vigencia visible + su ficha al tocarla.
  // La vigencia va pegada a la cifra, no en una nota al pie.
  function tile(tema, clave, etiqueta, formato) {
    const c = cifra(tema, clave);
    if (!c) return null;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    const valor = formato ? formato(c.valor) : fmt(c.valor);
    b.innerHTML = `<span class="l">${etiqueta}</span>
      <span class="v">${valor}<span class="u">${c.unidad === 'borough' || c.unidad === 'categoría' ? '' : ' ' + c.unidad}</span></span>
      <span class="vig">${c.vigencia} · ${(fuenteDe(tema, c.fuente) || {}).entidad || c.fuente}</span>`;
    b.addEventListener('click', () => abrirFicha(tema, clave, etiqueta));
    return b;
  }

  function abrirFicha(tema, clave, etiqueta) {
    const c = cifra(tema, clave), f = fuenteDe(tema, c.fuente), t = LAGO[tema];
    const campos = [
      ['Cifra', `${fmt(c.valor)} ${c.unidad}`],
      ['Vigencia', c.vigencia],
      ['Qué es', c.nota || '—'],
      ['Fuente', f ? f.nombre : c.fuente],
      ['Entidad', f ? f.entidad : '—'],
      ['Licencia', f ? f.licencia : '—'],
      ['¿Datos de personas?', f ? f.personas : '—'],
      ['Probado el', f ? f.probado : (t ? t.probado : '—')],
      ['Estado', f ? f.estado : '—'],
      ['Enlace', f ? `<a href="${f.url}" target="_blank" rel="noopener noreferrer">${f.url}</a>` : '—'],
      ['Nota de la fuente', f && f.nota ? f.nota : '—'],
      ['Tema del lago', `${tema}.json → cifras.${clave}`],
    ];
    document.getElementById('fichaTitulo').textContent = etiqueta;
    document.getElementById('fichaCuerpo').innerHTML =
      campos.map(([k, v]) => `<div class="campo"><b>${k}</b><span>${v}</span></div>`).join('');
    document.getElementById('ficha').hidden = false;
  }

  function seccion(id, titulo, sub) {
    const s = document.createElement('section');
    s.className = 'sec';
    s.id = id;
    s.innerHTML = `<h1>${titulo}</h1>${sub ? `<p class="secSub">${sub}</p>` : ''}`;
    return s;
  }

  function rejilla(tiles) {
    const r = document.createElement('div');
    r.className = 'rejilla';
    tiles.filter(Boolean).forEach(t => r.appendChild(t));
    return r;
  }

  function bloque(titulo, ...hijos) {
    const b = document.createElement('div');
    b.className = 'bloque';
    if (titulo) b.innerHTML = `<h3>${titulo}</h3>`;
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

    // --- Panorama: las seis preguntas de la portada ---
    const pan = seccion('panorama', 'Panorama',
      'Seis preguntas que haría un concejal del City of Westminster. Cada una se responde con ' +
      'una cifra viva del lago, con su vigencia y su fuente. Toquen cualquiera para ver de dónde sale.');
    pan.appendChild(rejilla([
      tile('demografia', 'poblacion_westminster', '¿Cuánta gente vive aquí?'),
      tile('economia', 'precio_medio_westminster', '¿Cuánto cuesta una vivienda?', libras),
      tile('seguridad', 'delitos_ultimo_mes', '¿Qué pasa con la seguridad?'),
      tile('turismo', 'alojamientos_n', '¿Cuánto pesa el turismo?'),
      tile('infraestructura', 'estaciones_n', '¿Qué hay en el suelo?'),
      tile('escucha', 'vistas_ultimo_mes', '¿Cuánta atención despierta?'),
    ]));
    pan.appendChild(aviso(
      '<strong>Lo que este sistema no sabe.</strong> No tiene presupuesto municipal ' +
      '(el London Datastore quedó como candidato), ni población por ward, ni datos de ' +
      'renta o desigualdad dentro del borough. Quien viva aquí y no aparezca en ninguna ' +
      'de estas fuentes no desaparece de la calle: desaparece de la decisión.'));
    main.appendChild(pan);

    // --- Gente ---
    const g = seccion('gente', 'Gente',
      'Población del borough y su lugar entre los 33 de Greater London. ' +
      'Se cruza por código GSS (E09…), nunca por nombre.');
    g.appendChild(rejilla([
      tile('demografia', 'poblacion_westminster', 'Población de Westminster'),
      tile('demografia', 'puesto_poblacion', 'Puesto entre los 33 boroughs'),
      tile('demografia', 'pct_de_londres', 'Peso en Greater London'),
      tile('demografia', 'hombres_westminster', 'Hombres'),
      tile('demografia', 'mujeres_westminster', 'Mujeres'),
      tile('demografia', 'pct_65_mas', '65 años o más'),
    ]));
    const serieP = LAGO.demografia && LAGO.demografia.series.poblacion_westminster;
    if (serieP) g.appendChild(bloque('Población de Westminster, año a año',
      G.linea(serieP.puntos, 'Población')));
    const pir = LAGO.demografia && LAGO.demografia.listas.piramide_quinquenal;
    if (pir) g.appendChild(bloque('Estructura por edad, en tramos quinquenales',
      G.barras(pir.map(p => [p[0].replace('Aged ', '').replace(' years', ''), p[1]]),
        { anchoEtiqueta: 120 })));
    main.appendChild(g);

    // --- Economía ---
    const e = seccion('economia', 'Economía y vivienda',
      'El UK HPI publica el precio MEDIO de una vivienda, no el precio por metro cuadrado. ' +
      'No son intercambiables, y por eso la unidad viaja pegada a la cifra.');
    e.appendChild(rejilla([
      tile('economia', 'precio_medio_westminster', 'Precio medio en Westminster', libras),
      tile('economia', 'precio_medio_londres', 'Media de Greater London', libras),
      tile('economia', 'veces_la_media_de_londres', 'Veces la media de Londres'),
      tile('economia', 'veces_la_media_de_inglaterra', 'Veces la media de Inglaterra'),
      tile('economia', 'variacion_interanual', 'Variación interanual'),
      tile('economia', 'precio_medio_piso', 'Un piso, de media', libras),
    ]));
    const sw = LAGO.economia && LAGO.economia.series.precio_medio_city_of_westminster;
    if (sw) e.appendChild(bloque('Precio medio de vivienda en Westminster, cinco años',
      G.linea(sw.puntos, 'Precio medio')));
    const tipos = LAGO.economia && LAGO.economia.listas.por_tipo_de_vivienda;
    if (tipos && tipos.length) e.appendChild(bloque('Por tipo de vivienda',
      G.barras(tipos.map(t => [t[0], t[1]]), { formato: libras, anchoEtiqueta: 110 })));
    e.appendChild(aviso(
      '<strong>Lo que decidimos no publicar.</strong> El Price Paid Data de HM Land Registry ' +
      'trae cada venta con su dirección y su código postal, es público y su licencia permite ' +
      'reutilizarlo. Queda fuera igualmente: dirección, postcode, precio y fecha identifican ' +
      'un hogar y lo que pagó por su casa. La pregunta se responde con el índice agregado.'));
    main.appendChild(e);

    // --- Seguridad ---
    const s = seccion('seguridad', 'Seguridad',
      'Delitos REGISTRADOS, que no es lo mismo que delitos ocurridos: un cambio puede venir ' +
      'de la denuncia o del registro, no del hecho.');
    s.appendChild(rejilla([
      tile('seguridad', 'delitos_ultimo_mes', 'Delitos en el último mes'),
      tile('seguridad', 'delitos_12m', 'Delitos en el período'),
      tile('seguridad', 'categoria_mas_frecuente', 'Categoría más frecuente'),
      tile('seguridad', 'pct_sin_resultado', 'Sin resultado judicial registrado'),
    ]));
    const sd = LAGO.seguridad && LAGO.seguridad.series.delitos_mensuales;
    if (sd) s.appendChild(bloque('Delitos registrados por mes', G.linea(sd.puntos, 'Delitos')));
    const cat = LAGO.seguridad && LAGO.seguridad.listas.por_categoria;
    if (cat) s.appendChild(bloque('Por categoría',
      G.barras(cat.slice(0, 12).map(c => [c[0].replace(/-/g, ' '), c[1]]), { anchoEtiqueta: 190 })));
    s.appendChild(aviso(
      '<strong>Decisión de privacidad.</strong> data.police.uk devuelve un registro por delito ' +
      'con ubicación. Al lago solo entran conteos agregados: ningún registro individual se ' +
      'guarda ni se versiona. Un delito, una fecha y una calle son tres columnas que, ' +
      'cruzadas, pueden señalar a una persona.'));
    main.appendChild(s);

    // --- Turismo ---
    const t = seccion('turismo', 'Turismo',
      'Conteos de OpenStreetMap, no de un registro oficial. La cobertura es voluntaria: ' +
      'complementa el registro, no lo sustituye, y lo que no está mapeado no aparece aquí.');
    t.appendChild(rejilla([
      tile('turismo', 'alojamientos_n', 'Alojamientos'),
      tile('turismo', 'hoteles_n', 'Hoteles'),
      tile('turismo', 'atracciones_n', 'Atracciones y museos'),
      tile('turismo', 'museos_n', 'Museos'),
      tile('turismo', 'habitaciones_declaradas', 'Habitaciones declaradas'),
    ]));
    const al = LAGO.turismo && LAGO.turismo.listas.alojamiento_por_tipo;
    if (al) t.appendChild(bloque('Alojamiento por tipo',
      G.barras(al.map(a => [a[0], a[1]]), { anchoEtiqueta: 140 })));
    t.appendChild(aviso(
      'La cifra de habitaciones es una <strong>cota inferior</strong>: solo cuenta los ' +
      'alojamientos que declaran el número de habitaciones en OpenStreetMap. Una cota ' +
      'inferior que se presenta como total es una cifra falsa.'));
    main.appendChild(t);

    // --- Territorio (el mapa lo monta mapa.js) ---
    const te = seccion('territorio', 'Territorio',
      'Dos escalas, como el ejemplo de Lima: los 33 boroughs para comparar y los wards de ' +
      'Westminster para ver dónde pasa lo que pasa. El color es el precio medio de vivienda.');
    const cajaMapa = document.createElement('div');
    cajaMapa.id = 'mapa';
    te.appendChild(cajaMapa);
    te.appendChild(rejilla([
      tile('geo', 'boroughs_n', 'Boroughs de Greater London'),
      tile('geo', 'wards_westminster_n', 'Wards de Westminster'),
      tile('infraestructura', 'estaciones_n', 'Estaciones'),
      tile('infraestructura', 'paradas_bus_n', 'Paradas de autobús'),
      tile('infraestructura', 'bicicleta_puntos_n', 'Puntos de bicicleta'),
    ]));
    te.appendChild(aviso(
      '<strong>Las dos escalas no son de la misma cosecha.</strong> Los boroughs son de ' +
      'diciembre de 2025; los wards, de diciembre de 2024, porque la capa de wards de 2025 ' +
      'solo está publicada como MapServer y su consulta devuelve 400. Está en el catálogo.'));
    main.appendChild(te);

    // --- Atlas ---
    const a = seccion('atlas', 'Atlas de los 33 boroughs',
      'Una cifra de ciudad esconde las diferencias de adentro. Westminster va resaltado.');
    a.appendChild(rejilla([
      tile('atlas_boroughs', 'westminster_puesto_poblacion', 'Puesto en población'),
      tile('atlas_boroughs', 'westminster_puesto_densidad', 'Puesto en densidad'),
      tile('atlas_boroughs', 'westminster_puesto_precio', 'Puesto en precio de vivienda'),
      tile('atlas_boroughs', 'borough_mas_caro', 'El borough más caro'),
      tile('atlas_boroughs', 'borough_mas_barato', 'El más barato'),
      tile('atlas_boroughs', 'borough_mas_denso', 'El más denso'),
    ]));
    const bs = LAGO.atlas_boroughs && LAGO.atlas_boroughs.listas.boroughs;
    if (bs) {
      const orden = bs.slice().sort((x, y) => (y.precio_medio_gbp || 0) - (x.precio_medio_gbp || 0));
      a.appendChild(bloque('Precio medio de vivienda, por borough',
        G.barras(orden.map(b => [b.nombre, b.precio_medio_gbp || 0, b.codigo === 'E09000033']),
          { formato: libras, anchoEtiqueta: 200 })));
      a.appendChild(bloque('La tabla completa', tabla(
        ['Borough', 'Población', 'km²', 'hab/km²', 'Precio medio'],
        orden.map(b => [b.nombre, fmt(b.poblacion), b.area_km2,
          fmt(b.densidad_hab_km2), libras(b.precio_medio_gbp || 0),
          b.codigo === 'E09000033']), 5)));
    }
    main.appendChild(a);

    // --- Correlaciones ---
    const co = seccion('correlaciones', 'Correlaciones',
      'Una correlación describe una asociación y nunca se publica como efecto. ' +
      'La regla está escrita en el script que las calcula, no solo aquí.');
    co.appendChild(rejilla([
      tile('correlaciones', 'metricas_n', 'Métricas comparadas'),
      tile('correlaciones', 'pares_n', 'Pares comparados'),
      tile('correlaciones', 'esperados_por_azar', 'Esperados por azar al 5 %'),
      tile('correlaciones', 'asociaciones_fuertes', 'Asociaciones con |r| ≥ 0,5'),
    ]));
    const pares = LAGO.correlaciones && LAGO.correlaciones.listas.pares;
    if (pares) co.appendChild(bloque('Todos los pares, ordenados por fuerza de la asociación',
      tabla(['Par', 'r', 'n'],
        pares.map(p => [`${p.etiqueta_a} ↔ ${p.etiqueta_b}`, p.r, p.n]))));
    co.appendChild(aviso(
      'Con ' + (cifra('correlaciones', 'metricas_n') || {}).valor + ' métricas salen ' +
      (cifra('correlaciones', 'pares_n') || {}).valor + ' pares. Juzgados al 5 %, cabría ' +
      'esperar ~' + (cifra('correlaciones', 'esperados_por_azar') || {}).valor +
      ' «significativos» aunque ninguna variable tuviera que ver con otra. ' +
      'Por eso el número va publicado al lado de los hallazgos.'));
    main.appendChild(co);

    // --- Ambiente ---
    const am = seccion('ambiente', 'Ambiente',
      'Un modelo no es un sensor: Open-Meteo interpola desde modelos globales. ' +
      'Donde la cifra viene de un modelo, la ficha lo dice.');
    am.appendChild(rejilla([
      tile('sensores', 'temperatura_actual', 'Temperatura'),
      tile('sensores', 'humedad_actual', 'Humedad'),
      tile('sensores', 'viento_actual', 'Viento'),
      tile('sensores', 'pm25_actual', 'PM2.5 (modelo)'),
      tile('sensores', 'no2_actual', 'NO₂ (modelo)'),
      tile('sensores', 'aqi_europeo', 'Índice europeo de aire'),
    ]));
    const pm = LAGO.sensores && LAGO.sensores.series.pm25_diario;
    if (pm) am.appendChild(bloque('PM2.5, media diaria de la última semana',
      G.linea(pm.puntos, 'PM2.5')));
    const pron = LAGO.sensores && LAGO.sensores.series.pronostico_max;
    if (pron) am.appendChild(bloque('Temperatura máxima, próximos días',
      G.linea(pron.puntos, 'Máxima')));
    main.appendChild(am);

    // --- Escucha ---
    const es = seccion('escucha', 'Escucha social',
      'Mide atención en Wikipedia, no visitantes. Los picos suelen seguir a hechos ' +
      'noticiosos, no a llegadas de turistas.');
    es.appendChild(rejilla([
      tile('escucha', 'vistas_ultimo_mes', 'Vistas del último mes'),
      tile('escucha', 'vistas_pico_mes', 'Mes de mayor atención'),
      tile('escucha', 'puesto_entre_boroughs', 'Puesto entre boroughs comparados'),
    ]));
    const we = LAGO.escucha && LAGO.escucha.series.wiki_westminster;
    if (we) es.appendChild(bloque('Vistas mensuales del artículo «City of Westminster»',
      G.linea(we.puntos, 'Vistas')));
    if (LAGO.escucha) {
      const ult = Object.entries(LAGO.escucha.series)
        .map(([k, v]) => [k.replace('wiki_', '').replace(/_/g, ' '),
          v.puntos[v.puntos.length - 1][1], k === 'wiki_westminster'])
        .sort((a, b) => b[1] - a[1]);
      es.appendChild(bloque('Atención en el último mes, por lugar', G.barras(ult, { anchoEtiqueta: 180 })));
    }
    main.appendChild(es);

    // --- Fuentes y método ---
    const fu = seccion('fuentes', 'Fuentes y método',
      'El catálogo cuenta también lo que no sirvió, y por qué. Es la parte del rastreo ' +
      'que le ahorra días a quien venga después.');
    const cata = LAGO.catalogo;
    if (cata) {
      const pastillas = document.createElement('p');
      pastillas.innerHTML = Object.entries(cata.por_estado)
        .map(([e, n]) => `<span class="pastilla ${e}">${e} · ${n}</span>`).join('');
      fu.appendChild(bloque(`${cata.n} fuentes rastreadas`, pastillas));
      fu.appendChild(bloque('El catálogo completo', tabla(
        ['Fuente', 'Entidad', 'Estado', 'Licencia', '¿Personas?', 'Probado'],
        cata.datasets.map(d => [
          `<a href="${d.url}" target="_blank" rel="noopener noreferrer">${d.nombre}</a>`,
          d.entidad, `<span class="pastilla ${d.estado}">${d.estado}</span>`,
          d.licencia, d.personas, d.probado]))));
      fu.appendChild(aviso(
        '<strong>Dos campos que el catálogo de Lima no lleva.</strong> Cada ficha de aquí ' +
        'trae <code>probado</code> (el día en que el enlace respondió) y <code>personas</code> ' +
        '(si el conjunto trae datos de personas y cuáles). El primero dice cuándo volver a ' +
        'mirar; el segundo decide casi todo lo que viene en la protección. ' +
        'Entidad y licencia salen de una lista cerrada desde la primera ficha.'));
    }
    main.appendChild(fu);
  }

  return { render, abrirFicha };
})();
