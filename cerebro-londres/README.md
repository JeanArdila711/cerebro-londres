# Cerebro Londres · sistema de información sobre el City of Westminster

Réplica del **Cerebro Lima** para el taller de Tópicos de Sistemas de Información.
Ciudad: **Londres**. Foco: **City of Westminster** (E09000033), dentro de los 33 boroughs
de Greater London.

Grupo: _<nombres y papeles>_ · Enlace: _<url>_ · Revisado: **2026-09-21**

| | |
|---|---|
| Fuentes rastreadas | **21** · integrado 12 · candidato 5 · caído 3 · excluido 1 |
| Temas en el lago | **11** |
| Comprobaciones antes de publicar | **185**, ninguna falló el 2026-09-21 |
| Escalas | 33 boroughs · 18 wards de Westminster |

```
cerebro-londres/
├── ingesta/        un script por tema, sin llaves, solo biblioteca estándar
├── catalogo/       rastreo.json (lo que no entró) + catalogo.json (generado)
├── lago/           el dato limpio; cada cifra con su fuente
│   └── raw/        los crudos: .gitignore y .vercelignore
├── territorio/     boroughs y wards en GeoJSON WGS84
├── verificacion/   verificar.py + probar_verificador.sh
├── explorar/       la segunda herramienta de cada tramo
├── api/            la compuerta: entrar · sesion · datos · salir
├── web/            lo único público: la cáscara, sin datos
└── servidor.js     imita el enrutado de Vercel para probar en local
```

## Cómo se corre

```bash
cp .env.example .env            # y poner CLAVE y SECRETO
for s in ingesta/pull_*.py; do python3 "$s"; done
python3 ingesta/pull_catalogo.py
python3 verificacion/verificar.py       # 185 comprobaciones, 0 fallos
node servidor.js                        # http://localhost:3000
```

---

## Para quién y qué pregunta

- **Usuario:** un concejal del City of Westminster.
- **Preguntas** (las seis de la portada, cada una respondida por una cifra viva del lago):
  ¿cuánta gente vive aquí? · ¿cuánto cuesta una vivienda? · ¿qué pasa con la seguridad? ·
  ¿cuánto pesa el turismo? · ¿qué hay en el suelo? · ¿cuánta atención despierta?
- **Escala y comparación:** dos escalas, como Lima. Los **33 boroughs** para comparar
  (Westminster contra los otros 32) y los **18 wards** de Westminster para ver dónde pasa
  lo que pasa. Contra qué: la media de Greater London y la de Inglaterra.
- **Lo que decidimos no mostrar:** el *Price Paid Data* de HM Land Registry —cada venta con
  dirección, postcode, precio y fecha—, aunque es público y su licencia lo permite. Ver
  «Protección».

## La réplica

**Qué replicamos tal cual:** la anatomía por carpetas, la forma del contrato
(`{tema, probado, fuentes[], cifras{}, series{}, listas{}}` con
`cifra = {valor, unidad, fuente, vigencia, nota, estado}`), el verificador que termina en
error con un solo FAIL, la compuerta con cookie firmada por HMAC y el lago fuera de la
carpeta pública, y las vistas en HTML/JS sin framework con MapLibre GL.

**Qué cambiamos, y por qué:**

| Lima | Londres | Por qué |
|---|---|---|
| 43 distritos + 14 zonas | 33 boroughs + 18 wards | La división administrativa de la ciudad |
| INEI (censo y proyecciones) | ONS vía Nomis | El instituto de estadística equivalente |
| BCRP · precio del m² | UK HPI · precio medio de vivienda | **No es la misma unidad**, y la unidad viaja con la cifra |
| MININTER · denuncias | data.police.uk | El registro de delitos equivalente |
| Regex de celular colombiano | Móvil británico **y postcode** | El postcode es cuasi-identificador |
| Fichas sin `probado` ni `personas` | **Ambos campos, obligatorios** | Lo que pide el enunciado |
| Licencia escrita de 34 maneras | **Lista cerrada de 6** | Se normaliza desde la primera ficha |

**Dos campos que el catálogo de Lima no lleva.** Lo comprobamos: descargamos
`catalogo.json` del Cerebro Lima y sus 149 fichas tienen
`id, nombre, entidad, url, resolucion, vigencia, estado, licencia, uso, nota, tema` —
ninguna trae `probado` ni `personas`. Aquí los dos son obligatorios y el verificador
falla si faltan.

**Huecos: lo que buscamos y no existe abierto, o no alcanzamos a integrar.**

- **Presupuesto municipal.** El London Datastore responde, pero tras un 307 y devolviendo
  ~10 MB sin filtrar. Queda **candidato**: hay que fijar el id del conjunto. El sistema
  **no tiene sección Municipio**, y decirlo es mejor que llenarla con cualquier cosa.
- **Población por ward.** Existe a escala LSOA (Nomis NM_2014_1) pero exige una tabla de
  correspondencia LSOA→ward que no está. Los wards se dibujan; no tienen población propia.
- **Renta y desigualdad dentro del borough.** No integrado. Es el hueco que más pesa:
  Westminster tiene a la vez Mayfair y Church Street, y este sistema no lo ve.

### La puerta de salida del tramo: ¿es reproducible?

Borramos el lago entero y lo reconstruimos desde los scripts. Los 11 temas volvieron a
salir y las **185 comprobaciones** pasaron. Pero comparando cifra a cifra, **algunas
cambiaron entre las dos corridas**, y conviene mirar cuáles antes de gritar que la ingesta
no es reproducible:

| Tema | Cifras que cambiaron | ¿Por qué |
|---|---|---|
| `sensores` | temperatura, humedad, viento | Son el clima **de ahora**. Cambiar es lo correcto |
| `seguridad` | `delitos_12m`, `pct_sin_resultado` | Se publicó un mes nuevo, y los resultados judiciales de meses viejos se actualizan |
| `turismo`, `infraestructura` | alojamientos, hoteles, puntos de bici | OpenStreetMap se edita de forma continua |

Ninguna es un fallo de reproducibilidad: **son fuentes vivas**, y el sistema las fecha en
vez de fingir que son estables. Lo que sí es estable y se comprobó idéntico: población,
límites, precios históricos y el catálogo. La distinción importa, porque
`git diff -- lago/` va a mostrar cambios **siempre**, y quien mantenga esto tiene que saber
cuáles esperar. Un cambio en `poblacion_westminster` sin que el ONS haya publicado nada sí
sería una alarma.

## ¿Se puede usar?

| Fuente | Licencia | ¿Personas? | Estado | Condición |
|---|---|---|---|---|
| ONS · Nomis (población) | OGL-3.0 | no | integrado | Atribución en el pie |
| HM Land Registry · UK HPI | OGL-3.0 | no | integrado | Atribución en el pie |
| data.police.uk | OGL-3.0 | **sí en origen** | integrado | **Solo agregados**; ningún registro individual al lago |
| ONS Open Geography | OGL-3.0 | no | integrado | «Contains OS data © Crown copyright» |
| OpenStreetMap · Overpass | **ODbL-1.0** | no | integrado | **Compartir igual** lo derivado, no solo citar |
| Open-Meteo | CC-BY-4.0 | no | integrado | Atribución; son valores de **modelo**, no sensores |
| Wikimedia Pageviews | CC0-1.0 | no | integrado | Sin condiciones |
| TfL AirQuality | términos del servicio | no | integrado | «Powered by TfL Open Data» |
| TfL StopPoint | términos del servicio | no | **caído** | 504 sostenido; reemplazada por OSM |
| HM Land Registry · Price Paid | OGL-3.0 | **sí** | **excluido** | No se publica. Ver abajo |

## Bitácora de exploración

Dos herramientas por tramo, sobre los **mismos datos**.

| Tramo | Herramienta | Qué pidió para empezar | Licencia | Dónde quedan los datos | ¿Se rehace con un comando? | Estado del proyecto | Qué resolvió | Qué no pudo | ¿Quedó? ¿Por qué? |
|---|---|---|---|---|---|---|---|---|---|
| Ingesta | **urllib** (estándar) | nada | PSF | en `lago/` | sí | biblioteca estándar | Baja y limpia las 10 fuentes sin instalar nada | No versiona esquemas ni registra cargas | **Sí.** Cero dependencias en el camino crítico |
| Ingesta | dlt | `pip install dlt[duckdb]` · 38 paquetes | Apache-2.0 | en una base DuckDB aparte | sí | activo | Infiere y versiona el esquema, registra cada carga en `_dlt_loads` | Su salida no es el contrato del taller: habría que traducirla | **No.** 38 paquetes para 10 scripts pequeños |
| Lago | **JSON + biblioteca estándar** | nada | — | `lago/*.json` | sí | — | Es el archivo que sirve la compuerta, legible y auditable | No consulta: para una mediana hay que escribir el bucle | **Sí.** El lago tiene que poder leerse sin herramientas |
| Lago | **DuckDB** | `pip install duckdb` · **1 paquete** | MIT | lee el JSON **sin convertirlo** | sí | activo, 1.5.5 | SQL sobre el mismo archivo; media, mediana y ranking en una consulta | No baja datos ni conoce el contrato | **Sí, como acompañante** en `explorar/`, no como sustituto |
| Verificación | **script propio** | nada | — | — | sí | — | 185 comprobaciones; atrapa los 13 casos rotos a propósito | Las reglas hay que escribirlas | **Sí.** Y sabe fallar, que es el punto |
| Verificación | Frictionless | `pip install frictionless` · 39 paquetes | MIT | — | sí | activo | Valida esquema tabular estándar | Nuestro lago **no es tabular**: es JSON anidado con cifras y series | **No.** La forma del contrato no le encaja |
| Territorio | **ONS Open Geography** | nada | OGL-3.0 | `territorio/*.geojson` | sí | activo | Los 33 boroughs oficiales, y el polígono exacto del foco | Los wards de 2025 solo están como MapServer (400) | **Sí**, con wards de 2024 |
| Territorio | OSM/Overpass para límites | nada | ODbL | — | sí | activo | Da el área y sirvió para **verificar** que la relación 51781 es Westminster (`ref:gss=E09000033`) | ODbL contagiaría la licencia a los límites derivados | **No para los límites**, sí para los puntos |
| Vistas | **HTML/JS + MapLibre** | nada | BSD-3 (MapLibre) | en nuestro repositorio y la función | sí | activo | Se puede cerrar de verdad, abre en móvil, cada cifra llega a su ficha | Todo hay que escribirlo | **Sí.** Es el único que deja cerrar la puerta |
| Vistas | Tableau Public / Flourish | cuenta | propietaria | **en su servidor, públicos** | no | activo | Gráficos rápidos y bonitos | **Lo publicado es público**: no hay compuerta posible | **No.** Chocan con la decisión de protección |
| Protección | **compuerta propia** (HMAC) | nada | — | `lago/` fuera de `web/` | sí | — | 200/401/404 en la terminal; la clave nunca llega al navegador | El freno por IP no es fuerte en serverless, y el código lo dice | **Sí** |
| Protección | clave en el JavaScript | nada | — | en la carpeta pública | — | — | Nada | `curl` se lleva el lago y la clave de paso | **No.** Es la compuerta de mentira |

**Lo que perdimos al descartar.** Al quedarnos con `urllib` perdimos el registro automático
de cargas de dlt: hoy no sabemos *cuándo* cambió una cifra, solo *cuál* es. Al descartar
Flourish perdimos gráficos mucho mejores que los nuestros. Las dos pérdidas son reales y
las dos se cambiaron por lo mismo: control sobre dónde quedan los datos.

## Protección

- **Nivel:** compuerta, y **solo agregados** para el tema de seguridad.
- **Qué protegemos, y de quién:** no protegemos secretos de Estado —casi todo es público—.
  Protegemos (a) el trabajo mientras está en curso y (b), sobre todo, la **decisión de no
  reexponer datos de personas** que en origen vienen con ubicación.
- **La decisión que más nos costó:** el *Price Paid Data* trae cada venta con dirección
  completa, postcode, precio y fecha. Es OGL-3.0: podríamos publicarlo. **No lo hacemos.**
  Con dirección y precio se sabe quién compró qué y por cuánto; cruzado con el padrón
  electoral, con nombre. La pregunta del sistema —¿cuánto cuesta vivir aquí?— se responde
  igual de bien con el índice agregado, que no expone a nadie. *Que un dato sea público y
  reutilizable no obliga a publicarlo.*
- **Pruebas de terminal** (`node servidor.js` y luego):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/                            # 200
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/datos?f=catalogo.json" # 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/lago/catalogo.json          # 404
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/datos?f=../.env"       # 401
curl -s http://localhost:3000/app.js | grep -c CLAVE                                       # 0
```

  Además: cookie con el vencimiento alterado → **401** (la firma HMAC no cuadra);
  `f=../.env` **con** sesión válida → **404** (la lista blanca la rechaza antes).
- **Revisión de secretos en el historial:** `.env` entró al `.gitignore` **antes** del primer
  commit; `CLAVE` y `SECRETO` solo existen como variables de entorno.
  `git log -p | grep -i -E "clave|secret|password|api_key|token"` → vacío.

## Herramienta elegida para las vistas

- **Qué necesitábamos mostrar:** cifras con procedencia a un clic, dos series temporales,
  un mapa coroplético de 33 polígonos y una tabla comparativa, en un teléfono.
- **Qué teníamos que proteger:** un lago que no puede quedar como archivo estático.
- **Por qué esta herramienta cumple las dos:** HTML/JS sin framework con MapLibre GL sirve
  la cáscara como estático y **los datos solo por una función con sesión**. Ninguna
  herramienta sin código de las que probamos permite eso: en Tableau Public y Flourish,
  publicar *es* hacer público.
- **Cuál descartamos por poco:** **Observable Framework**, de código abierto y muy superior
  para gráficos. Quedó fuera porque precalcula instantáneas dentro del sitio publicado —los
  datos volverían a ser un archivo estático— y porque no publica versión nueva desde marzo
  de 2026.

## Nuestra posición

### Gobierno de datos · «Los datos también se mueren»

La evidencia es de nuestro propio sistema, no prestada. El 2026-09-21, **TfL StopPoint**
—la fuente natural para el transporte de Londres— devolvió **504 Gateway Timeout** de forma
sostenida en `/StopPoint?lat,lon,radius` y en `/Line/Mode/*/StopPoints`, mientras
`/AirQuality`, del mismo host, respondía 200. No fue nuestra red: fue el endpoint. El mismo
día, la capa de **wards de diciembre de 2025** del ONS resultó publicada solo como
MapServer, cuya consulta devuelve `400 Invalid URL`, y **Overpass** falló en sus tres
espejos con timeout de despachador.

Tres fuentes oficiales, tres formas distintas de morirse, un solo día. Ninguna avisó.
Por eso cada ficha lleva `probado` con el día en que el enlace respondió, y por eso el pie
del sistema dice desde cuándo no se comprueba. **Quién responde:** hoy, el papel de Datos
del grupo; cuando termine el curso, nadie — y eso hay que decirlo en la portada antes de
que la fecha de prueba cumpla un año, no después.

### Ciberseguridad · «Parecer protegido no es estar protegido»

Lo probamos contra nosotros mismos. La compuerta de mentira era tentadora y corta: comparar
la clave en `app.js` y dejar el lago en `web/`. Habría *parecido* idéntica desde el
navegador —el mismo formulario, el mismo mensaje de error— y `curl https://…/lago/catalogo.json`
se habría llevado las 21 fichas, y `grep CLAVE app.js`, la clave de paso.

La diferencia no se ve en la pantalla: se ve en la terminal. Por eso la prueba de este
tramo no es que la interfaz pida clave, sino que **`/lago/catalogo.json` devuelva 404 y
`/api/datos` devuelva 401**. Y por eso dejamos escrito, en el código del freno por IP, que
en serverless *no es defensa fuerte, solo encarece*: una medida que se anuncia como más de
lo que es vuelve a ser apariencia de seguridad, esta vez dirigida a nosotros.

## Bitácora de IA

Construido con **Claude Code** (Opus 5). Lo que la IA hizo y lo que hubo que corregirle:

| Tramo | Qué le encargamos | Qué entregó | Qué le corregimos |
|---|---|---|---|
| Rastreo | Candidatos de fuente para Londres | Una lista plausible de portales y endpoints | **Se abrió cada enlace antes de catalogar.** Sobrevivieron casi todos, pero la forma de la consulta estaba mal en tres: el bbox de TfL **no existe** (404), los wards 2025 son MapServer (400) y Overpass rechaza GET (406) |
| Ingesta | Un script por fuente con la forma del contrato | Scripts correctos en estructura | Cuatro correcciones sobre datos reales: Nomis usa `time`, no `date`; `date="*"` no es válido; `age="MAKE:5YEAR"` no existe (son códigos `1...19`); y años sin estimación llegan con **valor vacío**, que se omite en vez de interpolar |
| Ingesta | Bajar el UK HPI de 5 regiones | 60 peticiones por región, una por mes | Se cambió por `month.json?_pageSize=60`: **300 peticiones → 5** |
| Ingesta | Unir población y precio por borough | Unión por **nombre** | Falló justo en el foco: el ONS dice «Westminster» y el UK HPI, «city-of-westminster». Se añadió tabla `ALIAS` **y** un corte que aborta si algún borough queda sin pareja — fallaba en silencio, devolviendo una columna vacía |
| Ingesta | Paradas de transporte | Consulta por radio | Un círculo no es un borough: se añadió **punto-en-polígono** contra el límite oficial del ONS |
| Verificación | Reglas de dato personal para el Reino Unido | Correo y móvil británico | Faltaba el **postcode**, que es cuasi-identificador |
| Verificación | — | — | **La prueba de romper el lago encontró un hueco nuestro:** habíamos eximido el campo `nota` para evitar falsos positivos de postcode, y de paso quedaron exentos correos y teléfonos. Se separaron las dos reglas: contacto se busca **siempre**, postcode solo fuera de la prosa |
| Protección | Una compuerta | Compuerta correcta con HMAC | Se le exigió el caso `f=../.env`, el de la cookie manipulada y que el servidor local **no** enmascarara el 404 del lago con la cáscara |
| Vistas | Secciones desde el lago | Render completo | Un `const cat` duplicado que no compilaba; y las cifras de la prosa se calculan del lago, no se teclean |

**Lo que no le delegamos:** qué ciudad, qué foco, a quién sirve el sistema, qué fuente
excluir por privacidad y qué herramienta queda. Eso lo firmamos nosotros.

## Revisión cruzada

- Tres cifras auditadas por el grupo **_<X>_**: _pendiente_
- Ataque del grupo **_<Y>_**: _pendiente_
- **Vueltas atrás en la ruta**, ya ocurridas:
  1. **De la ingesta al rastreo** — TfL StopPoint cayó (504); se catalogó como `caido` y el
     tramo se resolvió con OpenStreetMap.
  2. **De la ingesta al rastreo** — los wards de 2025 no son consultables; se bajó a la capa
     de 2024, con la consecuencia declarada de que las dos escalas no son de la misma cosecha.
  3. **Del permiso a la pregunta** — el Price Paid Data habría respondido mejor «cuánto
     cuesta una vivienda», pero el semáforo lo excluyó; la pregunta se reformuló hacia el
     índice agregado.
  4. **De la verificación a la verificación** — romper el lago a propósito mostró que la
     regla de datos personales tenía un hueco. Se arregló la regla, no la prueba.

---

Réplica del [Cerebro Lima](https://cerebro-lima.vercel.app/) para el
[taller](https://topicos-si.vercel.app/Tallerdatos) de Tópicos de Sistemas de Información.
Profesor: Santiago Jiménez Londoño.
