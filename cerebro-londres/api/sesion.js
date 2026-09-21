const { valida, cabeceras } = require('./_sesion');
module.exports = (req, res) => {
  cabeceras(res);
  res.status(200).json({ abierta: valida(req) });
};
