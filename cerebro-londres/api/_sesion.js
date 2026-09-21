// Sesión compartida por las funciones. La cookie se firma en el servidor;
// el navegador nunca ve la clave ni el secreto.
const crypto = require('crypto');

const HORAS = 12;
const MAX_EDAD = HORAS * 60 * 60;

function firmar(vence) {
  return crypto.createHmac('sha256', process.env.SECRETO).update(String(vence)).digest('hex');
}

function cookieDeSesion() {
  const vence = String(Date.now() + MAX_EDAD * 1000);
  return `sesion=${vence}.${firmar(vence)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_EDAD}`;
}

function valida(req) {
  if (!process.env.SECRETO) return false;
  const m = /(?:^|;\s*)sesion=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [vence, firma = ''] = m[1].split('.');
  if (!/^\d+$/.test(vence || '')) return false;
  const esperada = firmar(vence);
  // Comparación en tiempo constante, y solo si las longitudes coinciden:
  // timingSafeEqual lanza si difieren.
  if (firma.length !== esperada.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return false;
  return Number(vence) > Date.now();
}

// No indexar: la compuerta protege los datos, esto evita que el buscador
// guarde copias de lo que se sirva.
function cabeceras(res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store, private');
}

module.exports = { cookieDeSesion, valida, cabeceras, MAX_EDAD };
