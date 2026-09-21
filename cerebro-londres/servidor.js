#!/usr/bin/env node
// Servidor local que imita el enrutado de Vercel: web/ es lo público y
// /api/* son las funciones. Sirve para probar la compuerta con la terminal
// ANTES de desplegar. No se usa en producción.
//
//   CLAVE=... SECRETO=... node servidor.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PUERTO = process.env.PUERTO || 3000;
const WEB = path.join(__dirname, 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml' };

// Carga .env si existe, para no tener que exportar nada a mano
const env = path.join(__dirname, '.env');
if (fs.existsSync(env)) {
  fs.readFileSync(env, 'utf8').split('\n').forEach(l => {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

function respuesta(res) {
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
  res.send = s => res.end(s);
  return res;
}

http.createServer((req, res) => {
  respuesta(res);
  const u = url.parse(req.url, true);
  req.query = u.query;

  if (u.pathname.startsWith('/api/')) {
    const nombre = u.pathname.slice(5).split('/')[0];
    const archivo = path.join(__dirname, 'api', nombre + '.js');
    if (!/^[a-z]+$/.test(nombre) || !fs.existsSync(archivo)) return res.status(404).end();
    delete require.cache[require.resolve(archivo)];
    const fn = require(archivo);
    if (req.method === 'POST') {
      let cuerpo = '';
      req.on('data', c => { cuerpo += c; if (cuerpo.length > 1e5) req.destroy(); });
      req.on('end', () => { try { req.body = JSON.parse(cuerpo || '{}'); } catch (_) { req.body = {}; } fn(req, res); });
    } else fn(req, res);
    return;
  }

  // Estático: solo lo que está dentro de web/
  let p = path.join(WEB, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!path.resolve(p).startsWith(path.resolve(WEB))) return res.status(404).end();
  // Solo se cae a index.html en rutas SIN extensión. Si no, un /lago/x.json
  // inexistente devolvería 200 con la cáscara y taparía justo la prueba que
  // importa: que el lago NO se sirva como archivo estático.
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    if (path.extname(u.pathname)) return res.status(404).end();
    p = path.join(WEB, 'index.html');
  }
  if (!fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Content-Type', TIPOS[path.extname(p)] || 'application/octet-stream');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(fs.readFileSync(p));
}).listen(PUERTO, () => console.log(`http://localhost:${PUERTO}`));
