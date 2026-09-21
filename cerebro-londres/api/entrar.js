// La clave se compara EN EL SERVIDOR, en tiempo constante, contra una variable
// de entorno. Comparar la clave en el navegador es la compuerta de mentira.
const crypto = require('crypto');
const { cookieDeSesion, cabeceras } = require('./_sesion');

// Freno de intentos. En serverless esto no es defensa fuerte —cada instancia
// tiene su propio mapa y el proveedor puede crear muchas—: solo encarece el
// ataque. Se deja dicho en vez de fingir que es un cortafuegos.
const intentos = new Map();
const VENTANA = 10 * 60 * 1000;
const MAX = 12;

function frenado(ip) {
  const ahora = Date.now();
  const previos = (intentos.get(ip) || []).filter(t => ahora - t < VENTANA);
  intentos.set(ip, previos);
  return previos.length >= MAX;
}

module.exports = (req, res) => {
  cabeceras(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.CLAVE || !process.env.SECRETO) {
    console.error('Faltan CLAVE o SECRETO en el entorno');
    return res.status(500).json({ error: 'Servidor mal configurado' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida';
  if (frenado(ip)) return res.status(429).json({ error: 'Demasiados intentos. Espere unos minutos.' });

  const cuerpo = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const intento = Buffer.from(String(cuerpo.clave || ''));
  const clave = Buffer.from(process.env.CLAVE);

  const ok = intento.length === clave.length && crypto.timingSafeEqual(intento, clave);
  if (!ok) {
    intentos.set(ip, [...(intentos.get(ip) || []), Date.now()]);
    return res.status(401).json({ error: 'Clave incorrecta' });
  }

  res.setHeader('Set-Cookie', cookieDeSesion());
  return res.status(200).json({ ok: true });
};

function safeParse(s) { try { return JSON.parse(s); } catch (_) { return {}; } }
