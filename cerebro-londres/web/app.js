// Arranque: compuerta (servidor), carga del lago vía /api/datos, navegación, tema y buscador.
(function () {
  const $ = s => document.querySelector(s);
  const gate = $('#gate'), app = $('#app');
  window.LAGO = {};

  const TEMAS = [
    'demografia', 'salud', 'economia', 'finanzas', 'privacion',
    'seguridad', 'seguridad_boroughs', 'turismo', 'patrimonio',
    'escucha', 'sensores', 'aire_laqn', 'geo', 'infraestructura',
    'transporte_boroughs', 'riesgo', 'atlas_boroughs', 'correlaciones', 'catalogo'
  ];

  // Control de tema (Papel técnico por defecto / Modo nocturno conmutable)
  function iniciarTema() {
    const guardado = localStorage.getItem('cerebro_tema');
    const btn = $('#btnTema');
    const aplicar = modo => {
      if (modo === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (btn) btn.textContent = 'Modo papel';
      } else {
        document.documentElement.removeAttribute('data-theme');
        if (btn) btn.textContent = 'Modo noche';
      }
    };
    aplicar(guardado || 'light');
    if (btn) {
      btn.addEventListener('click', () => {
        const actual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const sig = actual === 'dark' ? 'light' : 'dark';
        localStorage.setItem('cerebro_tema', sig);
        aplicar(sig);
      });
    }
  }
  iniciarTema();

  async function sesion() {
    try {
      const r = await fetch('/api/sesion', { cache: 'no-store' });
      return (await r.json()).abierta;
    } catch (_) { return false; }
  }

  async function datos(f) {
    const r = await fetch('/api/datos?f=' + encodeURIComponent(f), { cache: 'no-store' });
    if (!r.ok) throw new Error(f + ' ' + r.status);
    return r.json();
  }
  window.cargarGeo = nombre => datos('territorio/' + nombre + '.geojson');

  async function arrancar() {
    gate.hidden = true;
    app.hidden = false;
    const estadoTxt = $('#estadoTexto') || $('#estadoDatos');
    const res = await Promise.allSettled(TEMAS.map(t => datos(t + '.json').then(j => { LAGO[t] = j; })));
    const ok = res.filter(r => r.status === 'fulfilled').length;
    if (estadoTxt) estadoTxt.textContent = `lago: ${ok}/${TEMAS.length} temas`;

    // Telemetría viva de Londres en la cabecera (hora oficial Europe/London + temperatura del lago)
    const temp = LAGO.sensores && LAGO.sensores.cifras && LAGO.sensores.cifras.temperatura_actual;
    const elClima = $('#climaLondres');
    if (elClima && temp && temp.valor != null) {
      elClima.textContent = `${temp.valor} ${temp.unidad || '°C'}`;
    }
    const elReloj = $('#relojLondres');
    if (elReloj) {
      const pintarHora = () => {
        try {
          const h = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).format(new Date());
          elReloj.textContent = `LON ${h}`;
        } catch (_) {}
      };
      pintarHora();
      setInterval(pintarHora, 30000);
    }

    const probados = Object.values(LAGO).map(j => j && j.probado).filter(Boolean).sort();
    if (probados.length) {
      const a = probados[0], b = probados[probados.length - 1];
      $('#pieProbado').textContent = 'AUDITORÍA DE VIGENCIA · Lago probado entre ' + a + (b !== a ? ' y ' + b : '') +
        '. Si una fecha de prueba supera un año, el indicador debe revalidarse contra la fuente original.';
    }

    try { SECCIONES.render(LAGO); } catch (e) { console.error('secciones', e); }
    try { MAPA.init(LAGO); } catch (e) { console.error('mapa', e); }
    navegacion(); buscador(); ficha();
    if (location.hash) { const s = document.querySelector(location.hash); if (s) s.scrollIntoView(); }
  }

  // Compuerta: la clave se manda al servidor, nunca se compara aquí.
  $('#gateForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#gateMsg');
    msg.textContent = 'Verificando credencial con el servidor…';
    try {
      const r = await fetch('/api/entrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: $('#clave').value })
      });
      const j = await r.json();
      if (r.ok && j.ok) arrancar(); else msg.textContent = j.error || 'Credencial incorrecta';
    } catch (_) { msg.textContent = 'No se pudo contactar el servidor'; }
  });

  sesion().then(abierta => {
    if (abierta) arrancar();
    else { gate.hidden = false; $('#clave').focus(); }
  });

  function navegacion() {
    const enlaces = [...document.querySelectorAll('#menu a')];
    const secs = enlaces.map(a => document.getElementById(a.dataset.sec)).filter(Boolean);
    enlaces.forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const s = document.getElementById(a.dataset.sec);
      if (!s) return;
      history.replaceState(null, '', '#' + a.dataset.sec);
      s.scrollIntoView({ behavior: 'smooth' });
    }));
    const io = new IntersectionObserver(() => {
      let mejor = 0, y = Infinity;
      secs.forEach((s, i) => {
        const d = Math.abs(s.getBoundingClientRect().top - 110);
        if (d < y) { y = d; mejor = i; }
      });
      enlaces.forEach((a, i) => a.classList.toggle('activa', i === mejor));
      if (enlaces[mejor]) $('#migas').textContent = enlaces[mejor].textContent.replace(/^\d+\s*/, '').trim();
    }, { threshold: [0, .25, .5, .75, 1] });
    secs.forEach(s => io.observe(s));

    // Regla de progreso de lectura en el compositor (scaleX con rAF, cero layout shift)
    const barra = $('#barraLecturaFill');
    if (barra) {
      let scrollRaf = 0;
      const actualizarProgreso = () => {
        scrollRaf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
        barra.style.setProperty('--scroll-p', p.toFixed(4));
      };
      window.addEventListener('scroll', () => {
        if (!scrollRaf) scrollRaf = requestAnimationFrame(actualizarProgreso);
      }, { passive: true });
      actualizarProgreso();
    }
  }

  function ficha() {
    const caja = $('#ficha');
    const cerrar = () => { caja.hidden = true; };
    $('#fichaCerrar').addEventListener('click', cerrar);
    caja.addEventListener('click', e => { if (e.target === caja) cerrar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !caja.hidden) cerrar(); });
  }

  function buscador() {
    const box = $('#buscador'), inp = $('#buscadorInput'), lista = $('#buscadorLista');
    let items = [], sel = 0;

    function indexar() {
      items = [];
      document.querySelectorAll('#menu a').forEach(a =>
        items.push({ t: a.textContent.trim(), s: 'sección', go: () => a.click() }));
      document.querySelectorAll('.tile').forEach(t => {
        const sec = t.closest('.sec');
        items.push({
          t: t.querySelector('.l').textContent + ' · ' + t.querySelector('.v').textContent.trim(),
          s: sec ? sec.querySelector('h1').textContent : '',
          go: () => { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus(); }
        });
      });
      (MAPA.lugares() || []).forEach(l =>
        items.push({ t: l.nombre, s: l.tipo, go: () => MAPA.irA(l) }));
    }

    function pintar(q) {
      q = q.toLowerCase();
      const r = items.filter(i => i.t.toLowerCase().includes(q) || i.s.toLowerCase().includes(q)).slice(0, 16);
      sel = 0;
      lista.innerHTML = r.map((i, k) =>
        `<button type="button" role="option" aria-selected="${k === 0}" class="${k === 0 ? 'sel' : ''}"><span>${i.t}</span><small>${i.s}</small></button>`).join('');
      lista.querySelectorAll('button').forEach((d, k) =>
        d.onclick = () => { r[k].go(); cerrar(); });
      box._r = r;
    }

    const abrir = () => { indexar(); box.hidden = false; inp.value = ''; pintar(''); inp.focus(); };
    const cerrar = () => { box.hidden = true; };

    inp.addEventListener('input', () => pintar(inp.value));
    inp.addEventListener('keydown', e => {
      const r = box._r || [];
      if (e.key === 'ArrowDown') sel = Math.min(r.length - 1, sel + 1);
      else if (e.key === 'ArrowUp') sel = Math.max(0, sel - 1);
      else if (e.key === 'Enter') { if (r[sel]) r[sel].go(); cerrar(); return; }
      else if (e.key === 'Escape') { cerrar(); return; }
      else return;
      e.preventDefault();
      lista.querySelectorAll('button').forEach((d, k) => {
        d.classList.toggle('sel', k === sel);
        d.setAttribute('aria-selected', String(k === sel));
      });
    });
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      const escribiendo = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable;
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !escribiendo)) {
        e.preventDefault();
        box.hidden ? abrir() : cerrar();
      }
    });
    $('#btnBuscar').addEventListener('click', abrir);
    box.addEventListener('click', e => {
      if (e.target === box) cerrar();
    });
  }
})();
