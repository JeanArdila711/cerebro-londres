// Los datos solo salen con una sesión válida. El lago vive FUERA de la carpeta
// pública: no hay ninguna URL estática que lo sirva.
const fs = require('fs');
const path = require('path');
const { valida, cabeceras } = require('./_sesion');

// Lista blanca por forma del nombre. Sin esto, `f=../../.env` sería una idea.
const TEMA = /^[a-z0-9_]+\.json$/;
const GEO = /^(territorio)\/[a-z0-9_]+\.geojson$/;

module.exports = (req, res) => {
  cabeceras(res);
  if (!valida(req)) return res.status(401).json({ error: 'Sesión requerida' });

  const f = String((req.query && req.query.f) || '');
  const esTema = TEMA.test(f);
  const esGeo = GEO.test(f);
  if (!esTema && !esGeo) return res.status(404).end();

  const base = process.cwd();
  const destino = esTema ? path.join(base, 'lago', f) : path.join(base, f);

  // Cinturón y tirantes: aunque la lista blanca ya lo impide, se comprueba que
  // la ruta resuelta siga dentro de la carpeta esperada.
  const raiz = esTema ? path.join(base, 'lago') : path.join(base, 'territorio');
  if (!path.resolve(destino).startsWith(path.resolve(raiz) + path.sep)) {
    return res.status(404).end();
  }
  if (!fs.existsSync(destino)) return res.status(404).end();

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).send(fs.readFileSync(destino, 'utf8'));
};
