# Cerebro Londres: reglas del proyecto

- El código real está en `cerebro-londres/` (subcarpeta del repo). La ruta del repo lleva un espacio al final: `Universidad /Topicos/...`.
- **Funciones de Vercel:** los archivos que empaqueta `includeFiles` se resuelven con `__dirname`, nunca con `process.cwd()`. Con `process.cwd()` producción mostró `lago: 0/22`.
- **Reconstruir el lago:** `bash cerebro-londres/ingesta/todo.sh`. El orden importa (`pull_territorio` y `pull_demografia` primero, `pull_atlas`, `pull_correlaciones` y `pull_catalogo` al final). Un bucle alfabético rompe el atlas con el lago vacío.
- **Una sola verdad por dato.** Si cambia una licencia, una fecha de prueba, `personas` o si una fuente es aproximada, hay que tocar a la vez el script `ingesta/pull_*.py`, `lago/*.json`, el catálogo (`ingesta/pull_catalogo.py`), el README y el Excel. Después: `python3 verificacion/verificar.py` y `python3 verificacion/cruzar_excel.py` deben dar 0 fallos.
- **Excel que se entrega:** el de la raíz del repo. La copia dentro de `cerebro-londres/` debe ser idéntica.
- **Slugs → IDs del taller:** `catalogo/ids_taller.json`. Fuentes aproximadas (PROXY): `catalogo/aproximados.json`. Semáforo: `catalogo/semaforo.json`. Atribuciones: `catalogo/atribuciones.json`. Los cuatro los lee `ingesta/comun.py`: si se commitea `comun.py` sin ellos, todo falla al importar.
- Las cifras de la UI se leen del lago (`cifra(tema, clave)`), no se escriben en el HTML ni en el JS.
- Probar login local con `curl` da falsos 401: la cookie lleva `Secure`. Usar un navegador.
- Nunca leer ni imprimir `.env`; solo `.env.example`.
