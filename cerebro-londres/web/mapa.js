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
    const precios = {}, poblacion = {}, densidad = {};
    ((LAGO.atlas_boroughs || {}).listas || {}).boroughs?.forEach(b => {
      if (b.precio_medio_gbp) precios[b.codigo] = b.precio_medio_gbp;
      if (b.poblacion) poblacion[b.codigo] = b.poblacion;
      if (b.densidad_hab_km2) densidad[b.codigo] = b.densidad_hab_km2;
    });
    boroughs.features.forEach(f => {
      const cod = f.properties.codigo;
      f.properties.precio = precios[cod] || null;
      f.properties.poblacion = poblacion[cod] || null;
      f.properties.densidad = densidad[cod] || null;
    });

    const cortes = cuantiles(Object.values(precios), 5);
    // Escala cartográfica coherente con Thames Navy + Westminster Vermilion
    const escala = ['#d9e2ec', '#9fb3c8', '#627d98', '#334e68', '#c8281e'];
    const relleno = ['case', ['==', ['get', 'precio'], null], '#b8b2a6',
      ['step', ['get', 'precio'], escala[0],
        cortes[0], escala[1], cortes[1], escala[2], cortes[2], escala[3], cortes[3], escala[4]]];

    mapa = new maplibregl.Map({
      container: 'mapa',
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [-0.1357, 51.4975],
      zoom: 9.5,
      attributionControl: { compact: true }
    });
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    mapa.on('load', () => {
      mapa.addSource('boroughs', { type: 'geojson', data: boroughs });
      mapa.addLayer({
        id: 'boroughs-relleno', type: 'fill', source: 'boroughs',
        paint: { 'fill-color': relleno, 'fill-opacity': 0.72 }
      });
      mapa.addLayer({
        id: 'boroughs-linea', type: 'line', source: 'boroughs',
        paint: { 'line-color': '#111315', 'line-width': 0.85, 'line-opacity': 0.65 }
      });
      mapa.addLayer({
        id: 'foco-linea', type: 'line', source: 'boroughs',
        filter: ['==', ['get', 'foco'], true],
        paint: { 'line-color': '#c8281e', 'line-width': 2.8 }
      });

      mapa.addSource('wards', { type: 'geojson', data: wards });
      mapa.addLayer({
        id: 'wards-linea', type: 'line', source: 'wards',
        paint: { 'line-color': '#c8281e', 'line-width': 1.15, 'line-dasharray': [2, 1.5],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 11.2, 0.92] }
      });

      const fmt = n => '£' + new Intl.NumberFormat('es-ES').format(n);
      const fmtNum = n => new Intl.NumberFormat('es-ES').format(n);
      mapa.on('click', 'boroughs-relleno', e => {
        const p = e.features[0].properties;
        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:var(--font-mono);font-size:10px;color:var(--acento);letter-spacing:.05em">${p.codigo} · UK HPI / ONS</div>` +
            `<strong style="font-family:var(--font-display);font-size:15px">${p.nombre}</strong><br>` +
            `Precio medio: <strong>${p.precio ? fmt(p.precio) : 'sin dato'}</strong><br>` +
            (p.poblacion ? `Población: ${fmtNum(p.poblacion)} hab · ${fmtNum(p.densidad)} hab/km²` : ''))
          .addTo(mapa);
      });
      mapa.on('mouseenter', 'boroughs-relleno', () => mapa.getCanvas().style.cursor = 'pointer');
      mapa.on('mouseleave', 'boroughs-relleno', () => mapa.getCanvas().style.cursor = '');

      lugares = boroughs.features.map(f => ({
        nombre: f.properties.nombre, tipo: 'borough (' + f.properties.codigo + ')',
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
      if (mapa && l.centro) mapa.flyTo({ center: l.centro, zoom: 11.6 });
    }
  };
})();
