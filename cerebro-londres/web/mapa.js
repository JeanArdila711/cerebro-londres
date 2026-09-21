// Mapa: los 33 boroughs coloreados por precio de vivienda, y los wards del foco.
// Teselas de OpenFreeMap (sin llave). Las geometrías salen por la compuerta,
// igual que el resto del lago.
window.MAPA = (function () {
  let mapa = null, lugares = [];

  function cuantiles(valores, n) {
    const v = valores.filter(x => typeof x === 'number').sort((a, b) => a - b);
    const cortes = [];
    for (let i = 1; i < n; i++) cortes.push(v[Math.floor(i * v.length / n)]);
    return cortes;
  }

  async function init(LAGO) {
    const caja = document.getElementById('mapa');
    if (!caja || typeof maplibregl === 'undefined') return;

    let boroughs, wards;
    try {
      boroughs = await window.cargarGeo('boroughs');
      wards = await window.cargarGeo('wards_westminster');
    } catch (e) {
      caja.innerHTML = '<p style="padding:16px;color:var(--suave)">No se pudieron cargar las capas del territorio.</p>';
      return;
    }

    // El precio vive en el atlas, no en el GeoJSON: se une por código GSS
    const precios = {};
    ((LAGO.atlas_boroughs || {}).listas || {}).boroughs?.forEach(b => {
      if (b.precio_medio_gbp) precios[b.codigo] = b.precio_medio_gbp;
    });
    boroughs.features.forEach(f => {
      f.properties.precio = precios[f.properties.codigo] || null;
    });

    const cortes = cuantiles(Object.values(precios), 5);
    const escala = ['#2b5c7a', '#3d8b8b', '#7fbf8a', '#e9b949', '#e0524a'];
    const relleno = ['case', ['==', ['get', 'precio'], null], '#44546a',
      ['step', ['get', 'precio'], escala[0],
        cortes[0], escala[1], cortes[1], escala[2], cortes[2], escala[3], cortes[3], escala[4]]];

    mapa = new maplibregl.Map({
      container: 'mapa',
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [-0.1357, 51.4975],
      zoom: 9.4,
      attributionControl: { compact: true }
      // (sin más opciones)
    });
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    mapa.on('load', () => {
      mapa.addSource('boroughs', { type: 'geojson', data: boroughs });
      mapa.addLayer({
        id: 'boroughs-relleno', type: 'fill', source: 'boroughs',
        paint: { 'fill-color': relleno, 'fill-opacity': 0.62 }
      });
      mapa.addLayer({
        id: 'boroughs-linea', type: 'line', source: 'boroughs',
        paint: { 'line-color': '#0b1420', 'line-width': 0.6, 'line-opacity': 0.5 }
      });
      mapa.addLayer({
        id: 'foco-linea', type: 'line', source: 'boroughs',
        filter: ['==', ['get', 'foco'], true],
        paint: { 'line-color': '#e0524a', 'line-width': 2.4 }
      });

      mapa.addSource('wards', { type: 'geojson', data: wards });
      mapa.addLayer({
        id: 'wards-linea', type: 'line', source: 'wards',
        paint: { 'line-color': '#e0524a', 'line-width': 1, 'line-dasharray': [2, 1.5],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 11.5, 0.9] }
      });

      const fmt = n => '£' + new Intl.NumberFormat('es-ES').format(n);
      mapa.on('click', 'boroughs-relleno', e => {
        const p = e.features[0].properties;
        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${p.nombre}</strong><br>${p.precio ? fmt(p.precio) + ' de media' : 'sin dato de precio'}` +
            `<br><small style="opacity:.7">${p.codigo} · UK HPI</small>`)
          .addTo(mapa);
      });
      mapa.on('mouseenter', 'boroughs-relleno', () => mapa.getCanvas().style.cursor = 'pointer');
      mapa.on('mouseleave', 'boroughs-relleno', () => mapa.getCanvas().style.cursor = '');

      lugares = boroughs.features.map(f => ({
        nombre: f.properties.nombre, tipo: 'borough',
        centro: centroide(f.geometry)
      }));
    });
  }

  function centroide(g) {
    const partes = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    let x = 0, y = 0, n = 0;
    partes.forEach(p => p[0].forEach(c => { x += c[0]; y += c[1]; n++; }));
    return [x / n, y / n];
  }

  return {
    init,
    lugares: () => lugares,
    irA: l => {
      document.getElementById('territorio').scrollIntoView({ behavior: 'smooth' });
      if (mapa && l.centro) mapa.flyTo({ center: l.centro, zoom: 11.5 });
    }
  };
})();
