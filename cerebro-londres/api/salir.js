const { cabeceras } = require('./_sesion');
module.exports = (req, res) => {
  cabeceras(res);
  res.setHeader('Set-Cookie', 'sesion=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.writeHead(302, { Location: '/' });
  res.end();
};
