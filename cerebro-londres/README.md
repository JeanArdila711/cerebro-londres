# Londres · sistema de información sobre el City of Westminster

Grupo: Jean Carlo Ardila (Datos e Interfaz), David Cossio (Seguridad) y Juan Pablo Posso (Curaduría) · Enlace: https://cerebro-londres-cerebro-londres.vercel.app/ · Repositorio: https://github.com/JeanArdila711/cerebro-londres · Revisado: **2026-11-01**

Réplica del **Cerebro Lima** para el taller de Tópicos de Sistemas de Información. Ciudad:
**Londres**. Foco: **City of Westminster** (E09000033), dentro de los 33 boroughs de Greater
London. El sistema está detrás de una compuerta; la clave se entrega aparte al profesor.

| | |
|---|---|
| Fuentes catalogadas | **178** fichas · 23 integradas (21 externas y 2 tablas derivadas) · 15 declaradas · 125 candidatas · 5 caídas · 10 excluidas |
| Temas en el lago | **21**, más el catálogo (22 archivos JSON en `lago/`) |
| Comprobaciones antes de publicar | **434**, ninguna falló el 2026-11-01 |
| Escalas | 33 boroughs · 18 wards de Westminster (y 704 wards de Londres) · 123 LSOA de Westminster |
| Diccionario | `Diccionario_de_datos_TallerDatos.xlsx`: 21 fuentes (F01 a F40), 147 campos (cada cifra, serie y lista del lago), 19 encargos a la IA |

### Papeles del grupo

Los cuatro papeles de la guía, con quién los ocupa. Jean ocupa dos porque somos tres.

| Papel | Quién | Qué hace en este proyecto |
|---|---|---|
| **Datos** (custodia técnica) | Jean Carlo Ardila | Scripts de ingesta, el lago, el catálogo y la verificación (`ingesta/`, `lago/`, `verificacion/`) |
| **Interfaz** (habla por el consumidor) | Jean Carlo Ardila | La web: baldosas, mapa, chips de fuente, preguntas y avisos (`web/`) |
| **Seguridad** (privacidad y compuerta) | David Cossio | La compuerta (`api/`), las variables de entorno, las pruebas de terminal y la revisión de secretos |
| **Curaduría** (significado, calidad, licencia) | Juan Pablo Posso | El Excel del diccionario: licencia tal como aparece en la fuente, fecha de prueba, qué significa cada campo |

Cada fuente integrada lleva el ID del Excel (F01, F02…). Es el mismo que se ve en la ficha de
cada cifra, así que la ficha, el Excel y este README hablan de la misma fuente. La tabla que
los une es `catalogo/ids_taller.json`.

### El piso técnico de la entrega

| Requisito | Estado | Cómo se comprueba |
|---|---|---|
| Abre desde un teléfono | Sí | El grupo lo revisó en un celular. El CSS tiene cortes en 768 y 440 px |
| Cada cifra muestra fuente, vigencia y fecha de prueba a un clic | Sí | Las baldosas llevan el ID Fxx en su línea de vigencia y abren la ficha al tocarlas. Los bloques de gráficos, los avisos con cifras, las cintas y el mini-mapa de la portada, la sección «Preguntas», la leyenda, el HUD y los popups del mapa llevan un chip Fxx que abre la misma ficha; el buscador muestra el Fxx en cada resultado. Los títulos que nombran una escala («Atlas de los 33 boroughs») no son cifras y no llevan chip |
| Los datos aproximados se ven como tales | Sí | El chip y la baldosa de una fuente aproximada dicen «≈ aprox.» en ámbar, la ficha lo explica en «Tipo de dato», y el Excel lo repite con «(PROXY)». La lista vive en `catalogo/aproximados.json` y `verificar.py` falla si el lago y la lista se separan |
| Al menos una vista sobre el territorio | Sí | Mapa coroplético de 33 boroughs, 18 wards de Westminster y vista 3D (MapLibre GL, sin token) |
| El lago se reconstruye desde los scripts | Sí | `bash ingesta/todo.sh` |
| Dos herramientas exploradas por tramo | Sí | Bitácora de exploración, más abajo |
| Ninguna pieza depende de una llave paga | Sí | Cero API keys; las únicas variables son `CLAVE` y `SECRETO`, propias |
| La compuerta pasa las pruebas de terminal | Sí | Resultado del 2026-11-01 en «Protección» |

Un límite que conviene decir: el plan gratuito de Vercel (Hobby) es solo para uso personal no
comercial. Para un trabajo de curso alcanza; para un servicio real habría que cambiar de plan.

```
cerebro-londres/
├── ingesta/        un script por tema, sin llaves, solo biblioteca estándar; todo.sh los corre en orden
├── catalogo/       rastreo.json (lo que no entró), catalogo.json (generado), ids_taller.json (slug → Fxx), aproximados.json (qué fuente es PROXY y por qué), semaforo.json y atribuciones.json
├── lago/           el dato limpio; cada cifra con su fuente
│   └── raw/        los crudos: .gitignore y .vercelignore
├── territorio/     boroughs y wards en GeoJSON WGS84
├── verificacion/   verificar.py, probar_verificador.sh y cruzar_excel.py (Excel = lago)
├── explorar/       la segunda herramienta de cada tramo (DuckDB sobre el lago)
├── api/            la compuerta: entrar · sesion · datos · salir
├── web/            lo único público: la cáscara, sin datos
└── servidor.js     imita el enrutado de Vercel para probar en local
```

## Cómo se corre

```bash
cp .env.example .env            # y poner CLAVE y SECRETO
bash ingesta/todo.sh            # reconstruye el lago entero, en el orden que exigen las dependencias
python3 verificacion/verificar.py       # 434 comprobaciones, 0 fallos
python3 verificacion/cruzar_excel.py    # el Excel dice lo mismo que el lago (necesita openpyxl)
node servidor.js                        # http://localhost:3000
```

El orden de `todo.sh` importa: `pull_territorio` y `pull_demografia` van primero porque de ellos
leen el atlas, las correlaciones y otros temas, y `pull_catalogo` va al final porque lee lo que
cada tema declaró. Correr los scripts en orden alfabético, como hacía este README antes, rompe
`pull_atlas` y `pull_correlaciones` con el lago vacío.

Una nota para probar en local: la cookie de sesión lleva el flag `Secure`. Los navegadores lo
exceptúan en `localhost`; `curl` no, así que un login probado con `curl` contra el servidor
local da 401 aunque la clave sea correcta. Para esa prueba hay que usar un navegador.

---

## Para quién y qué pregunta

- **Usuario:** el público general interesado en el estado de Westminster: residentes,
  autoridades locales e inversionistas, no un único perfil. Es lo que dice el documento de la
  entrega 1 y lo que dicen ahora la portada y la UI.
- **Preguntas** (las seis de la portada; cada una la responde una cifra viva del lago, con su
  vigencia y su ficha): ¿cuánta gente reside aquí? · ¿cuánto cuesta una vivienda media? ·
  ¿qué registra la policía en un mes? · ¿cuánto pesa la planta turística? · ¿qué
  infraestructura ferroviaria hay? · ¿cuánta atención pública despierta?
- **Lo que responde el sistema y lo que queda pendiente** (las tres preguntas de la entrega 1):
  - (b) ¿Cómo se compara Westminster con los otros 32 boroughs en población, densidad y precio
    de vivienda? **Respondida**: el atlas y el comparador cruzan F02, F05 y F07, y se amplía con
    censo, Council Tax, privación, esperanza de vida, sinhogarismo y educación.
  - (c) ¿Qué tan seguro es Westminster frente a los otros boroughs? **Respondida** con F17 y
    F04, con la salvedad de que la tasa divide sobre residentes y no sobre población presente.
  - (a) ¿Qué transporte, alojamiento, patrimonio protegido y riesgo de inundación tiene un
    punto cualquiera de Westminster? **Cubierta solo en parte.** Los datos de las cuatro
    cosas están en el lago, pero no construimos la consulta que las cruza para un punto
    elegido: el mapa solo deja tocar puntos de patrimonio (grado I) y de riesgo de inundación,
    y transporte y alojamiento salen como conteos del borough. La razón es de alcance, no de
    datos.
  - Además, la pregunta de la sección 6 del documento (seguridad frente a la actividad
    turística y de transporte) sigue a medias: la actividad solo cubre Westminster, no los 33
    boroughs.
  - La UI lo declara en la sección final «Preguntas» (`#preguntas`).
- **Escala y comparación:** dos escalas, como Lima. Los **33 boroughs** para comparar
  (Westminster contra los otros 32) y los **18 wards** de Westminster para ver dónde pasa lo que
  pasa; la privación baja a **123 LSOA**. Se compara contra la media de Greater London y la de
  Inglaterra, que son las que publica el UK HPI.
- **Datos aproximados (PROXY).** Seis fuentes entregan aproximaciones y no mediciones: F06 y
  F10 (Open-Meteo: valores de modelo, no sensores), F09 (TfL: pronóstico cualitativo), F01
  (Wikimedia: atención, no afluencia) y F03 y F08 (OpenStreetMap: conteos voluntarios; las
  habitaciones son una cota inferior). Se ven como tales: el chip y la baldosa dicen
  «≈ aprox.» en ámbar y la ficha explica por qué. Ninguna cifra simulada: lo aproximado es
  siempre un dato real de una fuente que no mide lo que parece. El atlas y las correlaciones
  son tablas derivadas del propio lago y se rotulan «derivado» en la ficha. Cada sección lo
  dice además en un aviso junto a la cifra.
- **Lo que decidimos no mostrar, y por qué:**
  - El *Price Paid Data* de HM Land Registry: cada venta con dirección, postcode, precio y
    fecha. Es público y su licencia lo permite, pero identifica un hogar y lo que pagó.
  - Los registros individuales de *stop and search* (cada fila es una persona detenida), el
    registro de incidentes de la London Fire Brigade (trae UPRN y código postal completo) y las
    víctimas de homicidio fila por fila (edad, sexo, etnia).
  - Contracts Finder: la licencia sirve, pero un registro real traía nombre, correo y celular
    de una persona en el campo `contactPoint`.
  - La etnia o la religión por LSOA: se rastreó y no se integró a propósito.
  - Lo que sí mostramos y es delicado: el nombre del LSOA más y menos privado. Se explica en
    «Nuestra posición».

## La réplica

**Qué replicamos tal cual:** la anatomía por carpetas, la forma del contrato
(`{tema, probado, fuentes[], cifras{}, series{}, listas{}}` con
`cifra = {valor, unidad, fuente, vigencia, nota, estado}`), el verificador que termina en error
con un solo FAIL, la compuerta con cookie firmada por HMAC y el lago fuera de la carpeta pública,
y las vistas en HTML/JS sin framework con MapLibre GL.

**Qué cambiamos, y por qué:**

| Lima | Londres | Por qué |
|---|---|---|
| 43 distritos + 14 zonas | 33 boroughs + 18 wards | La división administrativa de la ciudad |
| INEI (censo y proyecciones) | ONS vía Nomis | El instituto de estadística equivalente |
| BCRP · precio del m² | UK HPI · precio medio de vivienda | **No es la misma unidad**, y la unidad viaja con la cifra |
| MININTER · denuncias | data.police.uk y MPS por borough | El registro de delitos equivalente |
| Regex de celular colombiano | Móvil británico **y postcode** | El postcode es cuasi-identificador |
| Fichas sin `probado` ni `personas` | **Ambos campos, obligatorios** | Lo que pide el enunciado |
| Licencia escrita de 34 maneras | **Lista cerrada** | Se normaliza desde la primera ficha |
| Fichas sin ID común | **ID Fxx por fuente** (`catalogo/ids_taller.json`) | Une la ficha, el Excel y este README |
| `process.cwd()` para encontrar `lago/` | `__dirname` | Ver abajo |
| Clientes `GET` y `POST` de formulario | `get_json_post` con cabeceras | La API de DfE rechaza con 403 un `POST` sin `Content-Type: application/json` |
| Hojas de cálculo en CSV | Lector de `.ods` con `zipfile` y `xml.etree` | Council Tax y sinhogarismo solo se publican en ODS |

**La compuerta no funcionó a la primera en producción.** El ejemplo de la guía resuelve `lago/`
con `process.cwd()`. En nuestro despliegue en Vercel el sistema mostraba `lago: 0/22 temas` y
`/api/datos` devolvía 404. Hubo dos causas a la vez: el repositorio tiene el código en la
subcarpeta `cerebro-londres/`, así que el *Root Directory* tuvo que quedar en esa carpeta, y
`process.cwd()` no apunta a la raíz del proyecto en el runtime de Vercel. Con `__dirname` y
`includeFiles` en `vercel.json`, los 22 JSON volvieron a servirse y se comprobó en producción.

**Dos campos que el catálogo de Lima no lleva.** Descargamos `catalogo.json` del Cerebro Lima y
sus 149 fichas tienen `id, nombre, entidad, url, resolucion, vigencia, estado, licencia, uso,
nota, tema`; ninguna trae `probado` ni `personas`. Aquí los dos son obligatorios y el
verificador falla si faltan.

**Fuentes catalogadas · integradas · caídas · descartadas** (detalle en `catalogo/`): 178 fichas;
23 integradas (21 externas más el atlas y las correlaciones, que son tablas derivadas del
propio lago); 15 declaradas (transcritas de un PDF o de una página, sin script); 125
candidatas; 5 caídas; 10 excluidas. El catálogo cuenta también lo que no sirvió, con el error
literal en cada ficha.

**Huecos: lo que buscamos y no existe abierto, o no alcanzamos a integrar.**

- **Presupuesto municipal ejecutado.** El London Datastore responde, pero tras un 307 y devolviendo
  ~10 MB sin filtrar. El sistema **no tiene sección Municipio**, y decirlo es mejor que llenarla
  con cualquier cosa. Council Tax Banda D (F23) cuenta cuánto recauda Westminster, no en qué lo gasta.
- **Población por ward.** Existe a escala LSOA (Nomis NM_2014_1) pero exige una tabla de
  correspondencia LSOA→ward que no está. Los wards se dibujan; no tienen población propia.
- **Renta dentro del borough.** El IMD (F12) da un índice de privación por LSOA, no ingresos en
  libras. Westminster tiene a la vez Mayfair y Church Street, y el sistema solo ve la
  desigualdad a través de ese índice.
- **Sinhogarismo por persona.** El registro individual (H-CLIC) no es público; entran solo
  conteos de **hogares** por autoridad local.
- **Turismo e infraestructura a escala de los 33 boroughs.** F03 y F08 cubren solo Westminster;
  la seguridad sí cubre los 33. Por eso la pregunta «seguridad frente a actividad» queda a medias.
- **Población presente.** Las tasas por 1.000 residentes no cuentan a quien trabaja o visita
  Westminster a diario, y no encontramos una fuente abierta de población flotante.

### La puerta de salida del tramo: ¿es reproducible?

Sí, y lo comprobamos de nuevo el 2026-11-01. En una **copia limpia del repositorio, con
`lago/` vacío**, `bash ingesta/todo.sh` terminó con código 0, sin un solo script caído, y
`verificacion/verificar.py` dio **389 comprobaciones, 0 fallos** (hoy son 434: se añadieron las de fuentes aproximadas, semáforo y umbral de celdas). La copia produjo los mismos 22
archivos que el lago real, con las mismas fuentes y las mismas cifras en cada tema. No
comparamos los valores, y es a propósito: casi todas las fuentes están vivas.

Comparando cifra a cifra entre dos corridas (lo vimos en septiembre y sigue siendo cierto),
**algunas cambian**, y conviene mirar cuáles antes de gritar que la ingesta no es reproducible:

| Tema | Cifras que cambian | ¿Por qué |
|---|---|---|
| `sensores` | temperatura, humedad, viento | Son el clima **de ahora**. Cambiar es lo correcto |
| `seguridad` | `delitos_12m`, `pct_sin_resultado` | Se publica un mes nuevo, y los resultados judiciales de meses viejos se actualizan |
| `turismo`, `infraestructura` | alojamientos, hoteles, puntos de bici | OpenStreetMap se edita de forma continua |
| `aire_laqn` | índice DAQI y puesto | Se pide el día anterior; entre 14 y 22 boroughs tienen estación activa según el día |

Ninguna es un fallo de reproducibilidad: **son fuentes vivas**, y el sistema las fecha en vez de
fingir que son estables. Lo que sí es estable: población, límites, precios históricos, censo 2021 y
el catálogo. La distinción importa, porque `git diff -- lago/` va a mostrar cambios **siempre**, y
quien mantenga esto tiene que saber cuáles esperar. Un cambio en `poblacion_westminster` sin que
el ONS haya publicado nada sí sería una alarma. El orden de `todo.sh` existe porque correr los scripts
en orden alfabético rompía el atlas con el lago vacío.

## ¿Se puede usar?

Una fila por fuente integrada, más las caídas y las excluidas. El Excel trae la licencia tal
como aparece en cada fuente, con la página donde se leyó y la fecha de consulta (2026-11-01).

| Fuente | Licencia | ¿Personas? | Estado | Condición |
|---|---|---|---|---|
| F01 · Wikimedia · vistas de artículos | CC0 | no | integrado | Sin condiciones (CC0) |
| F02 · ONS (Nomis) · población por borough | OGL v3.0 | no | integrado | Atribución a la fuente y enlace a la licencia |
| F03 · OpenStreetMap · turismo (Overpass) | ODbL 1.0 | no | integrado | **Compartir igual** lo derivado y «© OpenStreetMap contributors» |
| F04 · data.police.uk · delitos por calle | OGL v3.0 | **sí en origen** (se agrega) | integrado | **Solo agregados**: ningún registro individual llega al lago |
| F05 · HM Land Registry · UK HPI | OGL v3.0 | no | integrado | Atribución a la fuente y enlace a la licencia |
| F06 · Open-Meteo · clima | CC BY 4.0 | no | integrado | Atribución; la API gratuita es solo para uso no comercial; son valores de **modelo** |
| F07 · ONS Open Geography · límites | OGL v3.0 | no | integrado | «Contains OS data © Crown copyright»; atribución y enlace a la licencia |
| F08 · OpenStreetMap · transporte (Overpass) | ODbL 1.0 | no | integrado | **Compartir igual** lo derivado y «© OpenStreetMap contributors» |
| F09 · TfL · AirQuality | Términos de TfL (OGL 2.0 con enmiendas) | no | integrado | «Powered by TfL Open Data»; cualitativo y para todo Londres |
| F10 · Open-Meteo · calidad del aire (CAMS) | CC BY 4.0 | no | integrado | Atribución (incluye CAMS); API gratuita solo no comercial; valores de **modelo** |
| F12 · MHCLG · Índice de Privación 2025 | OGL v3.0 | no (conteos agregados por zona) | integrado | Atribución a la fuente y enlace a la licencia; nivel LSOA, **no se cruza** con etnia ni religión |
| F13 · ONS (Nomis) · Censo 2021 | OGL v3.0 | no (conteos agregados por zona) | integrado | Atribución a la fuente y enlace a la licencia; conteos con control de divulgación |
| F17 · MPS · delitos por borough | OGL v2.0 | no (conteos agregados por zona) | integrado | Atribución a la fuente y enlace a la licencia |
| F19 · LAQN (Imperial College) · índice diario | OGL v2.0 | no | integrado | Con atribución. **Dos documentos de la misma fuente no coinciden**: la documentación de la API dice OGL v2; el PDF de términos v1.1 del King's College London ERG no la menciona y, en su cláusula 9, prohíbe dar el dato a terceros o modificarlo. Se usa solo agregado y detrás de la sesión |
| F23 · MHCLG · Council Tax | OGL v3.0 | no (conteos agregados por zona) | integrado | Atribución a la fuente y enlace a la licencia |
| F24 · MHCLG · sinhogarismo | OGL v3.0 | no (conteos agregados por zona) | integrado | Atribución a la fuente y enlace a la licencia; cuenta **hogares**, no personas |
| F25 · OHID · esperanza de vida (Fingertips) | OGL v3.0 | no (conteos agregados por zona) | integrado | Atribución a la fuente y enlace a la licencia |
| F27 · Planning Data · riesgo de inundación | OGL v3.0 | no | integrado | Atribución a la fuente y enlace a la licencia |
| F28 · DfT · NaPTAN (paradas) | OGL v3.0 | no | integrado | Atribución a la fuente y enlace a la licencia |
| F29 · DfE · ausentismo escolar | OGL v3.0 | no (conteos agregados por zona) | integrado | Atribución a la fuente y enlace a la licencia; la fuente suprime City of London |
| F40 · Planning Data · edificios protegidos | OGL v3.0 | no | integrado | Atribución a la fuente y enlace a la licencia |
| F02+F05+F07 · Atlas de los 33 boroughs (derivada) | derivado | no | integrado | Derivada del lago: hereda las condiciones de F02, F05 y F07 |
| F02+F05+F07 · Correlaciones (derivada) | derivado | no | integrado | Derivada del atlas: una correlación es asociación, nunca efecto |
| CQC · establecimientos de salud | sin confirmar | no | **caído** | 502 en tres intentos del 2026-09-25 |
| Defra UK-AIR · red AURN | sin confirmar | no | **caído** | Agotó el tiempo en dos intentos del 2026-09-25 |
| ONS · wards de diciembre de 2025 (ruta MapServer) | OGL v3.0 | no | **caído** | La ruta MapServer da 400; la misma capa como FeatureServer (`WD_DEC_2025_UK_BGC`) sí responde y alimenta los 704 wards de Londres de F07 |
| TfL · StopPoint | Términos de TfL (OGL 2.0 con enmiendas) | no | **caído** | 504 sostenido el 2026-09-21; se reemplazó con OSM |
| TfL · StopPoint por caja | Términos de TfL (OGL 2.0 con enmiendas) | no | **caído** | La consulta por caja envolvente no existe en la API (404) |
| DfT · STATS19 | OGL v3.0 | **sí** | **excluido** | Víctimas con banda de edad y sexo |
| EPC · certificados energéticos | sin confirmar | **sí** | **excluido** | Certificado por dirección de vivienda |
| Inside Airbnb · Londres | CC BY 4.0 | **sí** | **excluido** | Trae nombre de pila del anfitrión; solo entraría agregado |
| GLA · cobertura arbórea 2024 | todos los derechos reservados | no | **excluido** | «All Rights Reserved»: no se reutiliza |
| GLA · cobertura verde 2024 | todos los derechos reservados | no | **excluido** | «All Rights Reserved»: no se reutiliza |
| London Fire Brigade · incidentes | OGL v2.0 | **sí** | **excluido** | Trae UPRN y código postal completo: identifica viviendas |
| MPS · homicidios | OGL v2.0 | **sí** | **excluido** | Una fila por víctima con edad, sexo y etnia |
| data.police.uk · stop and search | OGL v3.0 | **sí** | **excluido** | Cada registro es una persona detenida; solo entraría agregado |
| HM Land Registry · Price Paid Data | OGL v3.0 | **sí** | **excluido** | **No se publica**: dirección, postcode, precio y fecha identifican un hogar |
| Contracts Finder (F18) · contratación pública | OGL v3.0 | **sí** | **excluido** | Un registro real traía nombre, correo y celular de una persona en `contactPoint` |

## Bitácora de exploración

Dos herramientas por tramo, sobre los **mismos datos**. «Sin verificar» quiere decir que la
fila sale de la documentación de la herramienta y no de una corrida nuestra.

| Tramo | Herramienta | Qué pidió para empezar | Licencia | Dónde quedan los datos | ¿Se rehace con un comando? | Estado del proyecto | Qué resolvió | Qué no pudo | ¿Quedó? ¿Por qué? |
|---|---|---|---|---|---|---|---|---|---|
| Ingesta | **urllib** (estándar) | nada | PSF | en `lago/` | sí, `bash ingesta/todo.sh` | biblioteca estándar | Baja y limpia las fuentes sin instalar nada; también lee `.ods` con `zipfile` | No versiona esquemas ni registra cargas | **Sí.** Cero dependencias en el camino crítico |
| Ingesta | dlt | `pip install dlt[duckdb]` · 38 paquetes | Apache-2.0 | en una base DuckDB aparte | sí | activo | Infiere y versiona el esquema, registra cada carga en `_dlt_loads` | Su salida no es el contrato del taller: habría que traducirla | **No.** 38 paquetes para scripts pequeños |
| Lago | **JSON + biblioteca estándar** | nada | — | `lago/*.json` | sí | — | Es el archivo que sirve la compuerta, legible y auditable | No consulta: para una mediana hay que escribir el bucle | **Sí.** El lago tiene que poder leerse sin herramientas |
| Lago | **DuckDB** | `pip install duckdb` · **1 paquete** | MIT | lee el JSON **sin convertirlo** | sí, `explorar/duckdb_lago.py` | activo, 1.5.5 | SQL sobre el mismo archivo; media, mediana y ranking en una consulta | No baja datos ni conoce el contrato | **Sí, como acompañante** en `explorar/`, no como sustituto |
| Verificación | **script propio** | nada | — | — | sí | — | 434 comprobaciones; atrapa los 13 casos rotos a propósito | Las reglas hay que escribirlas | **Sí.** Y sabe fallar, que es el punto |
| Verificación | Frictionless | `pip install frictionless` · 39 paquetes | MIT | — | sí | activo | Valida esquema tabular estándar | Nuestro lago **no es tabular**: es JSON anidado con cifras y series | **No.** La forma del contrato no le encaja |
| Territorio | **ONS Open Geography** | nada | OGL-3.0 | `territorio/*.geojson` | sí | activo | Los 33 boroughs oficiales, el polígono exacto del foco y los 704 wards de Londres | La ruta MapServer de los wards 2025 da 400 (se halló la FeatureServer) | **Sí**: boroughs y wards de Londres de 2025, wards de Westminster de 2024 |
| Territorio | OSM/Overpass para límites | nada | ODbL | — | sí | activo | Da el área y sirvió para **verificar** que la relación 51781 es Westminster (`ref:gss=E09000033`) | ODbL contagiaría la licencia a los límites derivados | **No para los límites**, sí para los puntos |
| Vistas | **HTML/JS + MapLibre** | nada | BSD-3 (MapLibre) | en nuestro repositorio y la función | sí | activo (MapLibre GL 4.7.1) | Se puede cerrar de verdad, abre en móvil, cada cifra llega a su ficha | Todo hay que escribirlo | **Sí.** Es el único que deja cerrar la puerta |
| Vistas | Tableau Public | cuenta | propietaria | **en el perfil público de Tableau** | no | activo | Gráficos rápidos y bonitos | Los libros y los datos publicados los puede descargar cualquiera: no hay compuerta posible | **No.** Choca con la decisión de protección |
| Vistas | Flourish | cuenta | propietaria | **en Flourish; lo publicado en el plan gratuito es público** | no | activo | Gráficos animados mucho mejores que los nuestros | En el plan gratuito no se puede cerrar y lleva su atribución | **No.** Mismo choque |
| Vistas | Observable Framework | Node (sin verificar) | sin verificar | los cargadores precalculan **instantáneas dentro del sitio publicado** | sin verificar | no publica versión nueva desde marzo de 2026 (sin verificar) | Muy buen manejo de gráficos y mapas con datos | Las instantáneas serían un archivo estático más: los datos volverían a la carpeta pública | **No, por poco.** Es la que casi elegimos |
| Protección | **compuerta propia** (HMAC) | nada | — | `lago/` fuera de `web/` | sí | — | 200/401/404 en la terminal; la clave nunca llega al navegador | El freno por IP no es fuerte en serverless, y el código lo dice | **Sí** |
| Protección | clave en el JavaScript | nada | — | en la carpeta pública | — | — | Nada | `curl` se lleva el lago y la clave de paso | **No.** Es la compuerta de mentira |

**Lo que perdimos al descartar.** Al quedarnos con `urllib` perdimos el registro automático de
cargas de dlt: hoy no sabemos *cuándo* cambió una cifra, solo *cuál* es. Al descartar Flourish
y Observable perdimos gráficos mejores que los nuestros. Las pérdidas son reales y se cambiaron
por lo mismo: control sobre dónde quedan los datos.

## Protección

- **Nivel:** compuerta. Dentro de ella, los temas con origen sensible (seguridad) van **solo como
  agregados**, y lo que identifica a una persona **no se publica**.
- **Umbral de celdas pequeñas: 5.** El sistema no publica sola ninguna celda de conteo de casos
  con menos de 5. Hoy se agrupó una: «Fraud and forgery» (2 casos en 12 meses, F17) se une con
  la categoría más pequeña que llega al umbral, «Possession of weapons», y la suma sigue
  cuadrando con el total; suprimirla sin más habría dejado el 2 recuperable restando del total.
  `verificar.py` lo comprueba sobre las tablas de conteo de casos de F04 y F17 (ninguna celda
  bajo el umbral, y las categorías suman el total), y la vista de Seguridad lo declara. El umbral
  se aplica a lo que el sistema agrega a partir de casos; las tablas que ya publica la fuente con
  su propio control (el censo F13, sinhogarismo F24, donde varios boroughs tienen 0 a 3 hogares
  en B&B, y F29, que suprime City of London) se muestran como las publica, sin agrupar.
- **Atribución en la vista donde se usa el dato.** Al pie de cada sección va la atribución de las
  fuentes cuyo ID aparece en ella, con la frase exacta que exige cada licencia (OGL, ODbL,
  CC BY, la de F19 tal como la pide su documentación). La ficha de cada fuente la repite.
- **Semáforo por fuente.** Las 21 fuentes externas integradas llevan el mismo semáforo que las
  rastreadas (origen · personas · acceso, en `catalogo/semaforo.json`); se ve en la ficha y
  `cruzar_excel.py` lo contrasta con el Excel (origen, personas y acceso). Open-Meteo (F06, F10)
  figura con origen «sin-confirmar»: no sabemos qué tipo de organización lo publica y no lo suponemos.
- **Qué protegemos, y de quién:** no protegemos secretos de Estado; casi todo es público.
  Protegemos (a) el trabajo mientras está en curso y (b), sobre todo, la **decisión de no
  reexponer datos de personas** que en origen vienen con ubicación. La compuerta sirve para
  que la reexposición no sea un archivo que cualquiera descarga.
- **La decisión que más nos costó:** el *Price Paid Data* trae cada venta con dirección completa,
  postcode, precio y fecha. Es OGL-3.0: podríamos publicarlo. **No lo hacemos.** Con dirección y
  precio se sabe quién compró qué y por cuánto; cruzado con el padrón electoral, con nombre. La
  pregunta del sistema —¿cuánto cuesta vivir aquí?— se responde igual de bien con el índice
  agregado, que no expone a nadie. *Que un dato sea público y reutilizable no obliga a
  publicarlo.*
- **Pruebas de terminal** contra el sistema publicado, 2026-11-01, sin cookie:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://cerebro-londres-cerebro-londres.vercel.app/                              # 200
curl -s -o /dev/null -w "%{http_code}\n" "https://cerebro-londres-cerebro-londres.vercel.app/api/datos?f=catalogo.json"   # 401
curl -s -o /dev/null -w "%{http_code}\n" https://cerebro-londres-cerebro-londres.vercel.app/lago/catalogo.json            # 404
curl -s -o /dev/null -w "%{http_code}\n" "https://cerebro-londres-cerebro-londres.vercel.app/api/datos?f=../.env"         # 401
curl -s https://cerebro-londres-cerebro-londres.vercel.app/app.js | grep -c CLAVE                                         # 0
```

  Esos fueron los resultados de hoy. En local (septiembre) se probaron además: cookie con el
  vencimiento alterado → **401** (la firma HMAC no cuadra) y `f=../.env` **con** sesión válida →
  **404** (la lista blanca la rechaza antes). Las respuestas llevan `X-Robots-Tag: noindex, nofollow`.
- **Revisión de secretos en el historial:** `.env` entró al `.gitignore` antes del primer commit y
  ninguno de los 17 commits lo toca. `CLAVE` y `SECRETO` solo existen como variables de entorno.
  Corrimos la búsqueda de la guía:

```bash
git log --all -p | grep -n -i -E "clave|secret|password|api_key|token"
```

  **No da vacío**: da 123 líneas, porque el código que lee esas variables (`api/entrar.js`,
  `api/_sesion.js`, `.env.example`, este README) las nombra. Lo que importa es si algún valor
  llegó al historial, y buscamos las asignaciones: las únicas líneas añadidas con
  `CLAVE=` o `SECRETO=` son los dos placeholders de `.env.example`
  (`una-clave-para-el-curso` y `cadena-larga-y-aleatoria-para-firmar-la-sesion`). No revisamos
  una por una las 123 líneas. Una versión anterior de este README afirmaba que el resultado era
  vacío; era falso, y lo corrigió la auditoría de este tramo.

## Herramienta elegida para las vistas

- **Qué necesitábamos mostrar:** cifras con procedencia a un clic, series temporales, un mapa
  coroplético de 33 polígonos con vista 3D y tablas comparativas, todo en un teléfono.
- **Qué teníamos que proteger:** un lago que no puede quedar como archivo estático, y que no
  puede exponer datos de personas.
- **Por qué esta herramienta cumple las dos:** HTML/JS sin framework con MapLibre GL sirve la
  cáscara como estático y **los datos solo por una función con sesión**. Ninguna herramienta
  sin código de las que revisamos permite eso: en Tableau Public y Flourish, publicar *es* hacer
  público.
- **Cuál descartamos por poco:** **Observable Framework**, de código abierto y muy superior para
  gráficos. Quedó fuera porque precalcula instantáneas dentro del sitio publicado —los datos
  volverían a ser un archivo estático— y porque, según la guía, no publica versión nueva desde
  marzo de 2026 (dato de la guía; no lo verificamos). Qué tendría que cambiar para que la
  respuesta fuera otra: que los datos pudieran servirse por una función con sesión en vez de
  quedar dentro del sitio, o que el nivel de protección fuera «abierto», donde Observable ganaría.

## Nuestra posición

### Gobierno de datos · «Los datos también se mueren»

La guía pregunta quién va a mantener el sistema cuando termine el curso y qué debería decir la
portada el día en que la fecha de prueba más reciente tenga más de un año.

La evidencia es de nuestro propio sistema. El 2026-09-21, **TfL StopPoint** —la fuente natural
para el transporte de Londres— devolvió **504 Gateway Timeout** de forma sostenida en
`/StopPoint?lat,lon,radius` y en `/Line/Mode/*/StopPoints`, mientras `/AirQuality`, del mismo
host, respondía 200. No fue nuestra red: fue el endpoint. El mismo día, la capa de **wards de
diciembre de 2025** del ONS resultó publicada solo como MapServer, cuya consulta devuelve
`400 Invalid URL`, y **Overpass** falló en sus tres espejos con timeout de despachador. Tres
fuentes oficiales, tres formas distintas de morirse, un solo día. Ninguna avisó.

Hoy la evidencia sigue ahí: TfL StopPoint está catalogada como `caido`, y las fechas de prueba
del lago no son todas la misma (15 fuentes del 2026-10-26 y 6 del 2026-10-02), porque cada
script se corre por separado. Por eso cada ficha lleva `probado`, y por eso el pie del sistema
dice entre qué fechas se probó el lago y avisa que, si una fecha supera un año, el indicador debe
revalidarse contra la fuente original.

**Quién responde.** Hoy, el grupo, por papeles: Datos e Interfaz (Jean Carlo Ardila), Seguridad (David Cossio) y Curaduría (Juan Pablo Posso). Cuando
termine el curso no hay nadie designado, y eso hay que decirlo antes de que la fecha de prueba
cumpla un año: o se apaga el despliegue, o la portada pasa a decir que el lago no se ha
revalidado desde tal día. Hoy la portada no lo dice con esas palabras, solo el pie.

**Ciclo de vida, escrito en código.** `.github/workflows/verificar.yml` corre `verificar.py` y
`cruzar_excel.py` en cada push y pull request, y el día 1 de cada mes reconstruye el lago desde
las fuentes en un entorno limpio y lo verifica. No hace commit: el trabajo falla, y el correo de
GitHub avisa, si un script termina con error (una fuente cayó o cambió de forma) o si la
verificación no pasa; un valor distinto que cumple las reglas no dispara nada. No lo hemos visto correr en GitHub todavía; sí
probamos en una copia limpia local (sin `lago/raw` ni `.env`) que ambas verificaciones pasan.

### Ciberseguridad · «Parecer protegido no es estar protegido»

La guía pregunta qué parte del sistema parece protegida sin estarlo y cómo se demostraría con
una terminal.

Lo probamos contra nosotros mismos, y encontramos tres casos.

1. **La compuerta de mentira.** Era tentadora y corta: comparar la clave en `app.js` y dejar el
   lago en `web/`. Habría *parecido* idéntica desde el navegador —el mismo formulario, el mismo
   mensaje de error—, y `curl .../lago/catalogo.json` se habría llevado las 21 fichas, y
   `grep CLAVE app.js`, la clave de paso. La diferencia no se ve en la pantalla: se ve en la
   terminal, y por eso la prueba no es que la interfaz pida clave sino que
   `/lago/catalogo.json` devuelva 404 y `/api/datos` devuelva 401 (resultados de hoy, arriba).
2. **El freno por IP.** En serverless no es defensa fuerte, solo encarece, y lo dejamos escrito
   en el código: una medida anunciada como más de lo que es vuelve a ser apariencia.
3. **Nuestro propio README.** Afirmaba que el grep del historial daba «vacío». No era cierto:
   da 123 líneas, de las cuales solo importan las dos asignaciones de placeholder. Un
   enunciado de seguridad que nadie volvió a ejecutar era apariencia de seguridad, esta vez
   escrita por nosotros. Lo encontró la auditoría y lo corregimos.

Un cuarto caso no es de la compuerta sino del dato: el nombre del LSOA más y menos privado
(F12) es público y oficial, pero señala una unidad de ~1.500 personas como la más privada de
Inglaterra. Cruzado con otro dato (etnia por LSOA, que rastreamos y no integramos a propósito)
podría estigmatizar un barrio o discriminar en seguros y vivienda. Decidimos mantenerlo al nivel
LSOA que ya trae la fuente, sin bajar a dirección, y **no cruzarlo** con ningún campo de etnia o
religión dentro de este lago. En el Excel está clasificado como «Sensible».

## Bitácora de IA

Construido con **Claude Code** (el modelo cambió entre sesiones; el detalle por encargo está en
la hoja «3. Bitácora IA» del Excel). Lo que la IA hizo y lo que hubo que corregirle:

| Tramo | Herramienta | Qué le encargamos | Qué entregó | Qué le corregimos |
|---|---|---|---|---|
| Rastreo | Claude Code | Candidatos de fuente para Londres | Una lista plausible de portales y endpoints | **Se abrió cada enlace antes de catalogar.** Sobrevivieron casi todos, pero la forma de la consulta estaba mal en tres: el bbox de TfL **no existe** (404), los wards 2025 son MapServer (400) y Overpass rechaza GET (406) |
| Ingesta | Claude Code | Un script por fuente con la forma del contrato | Scripts correctos en estructura | Cuatro correcciones sobre datos reales: Nomis usa `time`, no `date`; `date="*"` no es válido; `age="MAKE:5YEAR"` no existe (son códigos `1...19`); y años sin estimación llegan con **valor vacío**, que se omite en vez de interpolar |
| Ingesta | Claude Code | Bajar el UK HPI de 5 regiones | 60 peticiones por región, una por mes | Se cambió por `month.json?_pageSize=60`: **300 peticiones → 5** |
| Ingesta | Claude Code | Unir población y precio por borough | Unión por **nombre** | Falló justo en el foco: el ONS dice «Westminster» y el UK HPI, «city-of-westminster». Se añadió tabla `ALIAS` **y** un corte que aborta si algún borough queda sin pareja — fallaba en silencio, devolviendo una columna vacía |
| Ingesta | Claude Code | Paradas de transporte | Consulta por radio | Un círculo no es un borough: se añadió **punto-en-polígono** contra el límite oficial del ONS |
| Ingesta | Claude Code | Calidad del aire por borough (LAQN) | Convirtió la banda de texto a un número propio de 1 a 4 | Los 18 boroughs dieron empatados en 1,0. La fuente ya trae un índice DAQI de 1 a 10: se usó ese |
| Ingesta | Claude Code | Censo 2021 por los 33 boroughs | La ficha decía que bastaba cambiar `geography` por `TYPE432` | Nomis no lo acepta para listar los 33 boroughs: hay que pasar los 33 códigos ONS (E09000001 a E09000033) separados por coma |
| Ingesta | Claude Code | Ausentismo escolar por autoridad local (API de DfE) | Un `POST` que pedía boroughs, región y país en una sola consulta | La API respondió 403 sin `Content-Type: application/json`, y filtrar por región o país devuelve todas las autoridades locales que contiene. Se añadió `get_json_post` y se separó en dos consultas |
| Verificación | Claude Code | Reglas de dato personal para el Reino Unido | Correo y móvil británico | Faltaba el **postcode**, que es cuasi-identificador |
| Verificación | Claude Code | — | — | **La prueba de romper el lago encontró un hueco nuestro:** habíamos eximido el campo `nota` para evitar falsos positivos de postcode, y de paso quedaron exentos correos y teléfonos. Se separaron las dos reglas: contacto se busca **siempre**, postcode solo fuera de la prosa |
| Protección | Claude Code | Una compuerta | Compuerta correcta con HMAC | Se le exigió el caso `f=../.env`, el de la cookie manipulada y que el servidor local **no** enmascarara el 404 del lago con la cáscara |
| Despliegue | Claude Code | Publicar el sistema en Vercel | `api/datos.js` con `process.cwd()` para hallar `lago/`, como el ejemplo de la guía | En producción mostraba `lago: 0/22`. Se pasó a `__dirname`, se fijó el Root Directory en `cerebro-londres` y se verificó con los 22 JSON en 200 |
| Vistas | Claude Code | Secciones desde el lago | Render completo | Un `const cat` duplicado que no compilaba; y las cifras de la prosa se calculan del lago, no se teclean |
| Vistas | Claude Code (revisor) | Mostrar el ID Fxx de cada fuente a un clic | Chips en bloques, mapa y baldosas | La revisión con contexto limpio halló que el laboratorio de correlaciones citaba solo F02+F05+F07 cuando sus cruces usan también F23, F12, F25 y F17, y que un `textContent` había pasado a `innerHTML` sin necesidad. Se corrigieron las dos |
| Excel | Claude Code | Copiar la licencia tal como aparece en la fuente, para las 21 fuentes | Una frase por fuente, con su URL y fecha de consulta | En F19 (LAQN) la documentación de la API dice OGL v2 y otro PDF de la misma fuente la contradice. Se leyeron los dos PDFs completos el 2026-11-01 y se decidió registrar OGL-2.0, con el conflicto y la cláusula 9 escritos en la nota de la fuente |
| Auditoría | Claude Code | Contrastar el sistema con la guía de entrega | Un informe con lo que cumplía y lo que no | Encontró que el README afirmaba un resultado falso del historial y que la UI y el Excel tenían cifras escritas a mano que ya no cuadraban |
| Licencias | Claude Code | Decidir la licencia de F19 (LAQN), donde dos documentos de la misma fuente se contradicen | Leyó los dos PDFs completos con `pdftotext` en vez de resumirlos | Los dos no son compatibles en lo que importa: la documentación de la API dice OGL v2 y trae el texto de atribución; el PDF de términos v1.1 del King's College London ERG no menciona la OGL y, en su cláusula 9, prohíbe dar el dato a terceros o modificarlo. Se registró OGL-2.0 por ser lo que declara la documentación de la API, y la contradicción y el límite de uso (solo agregado, detrás de la sesión) quedaron escritos en la ficha |

**Lo que no le delegamos:** qué ciudad, qué foco, a quién sirve el sistema, qué fuente excluir por
privacidad y qué herramienta queda. Eso lo firmamos nosotros.

## Revisión cruzada

- Tres cifras auditadas por el grupo **_<X>_**: _pendiente_
- Ataque del grupo **_<Y>_**: _pendiente_
- **Vueltas atrás en la ruta**, ya ocurridas:
  1. **De la ingesta al rastreo** — TfL StopPoint cayó (504); se catalogó como `caido` y el
     tramo se resolvió con OpenStreetMap.
  2. **De la ingesta al rastreo** — los wards de 2025 no respondían por la ruta MapServer; se
     bajó a la capa de 2024 y después se halló la FeatureServer de 2025. Hoy los 704 wards de
     Londres son de 2025 y los 18 de Westminster siguen en 2024, y la UI lo declara.
  3. **Del permiso a la pregunta** — el Price Paid Data habría respondido mejor «cuánto
     cuesta una vivienda», pero el semáforo lo excluyó; la pregunta se reformuló hacia el
     índice agregado.
  4. **De la verificación a la verificación** — romper el lago a propósito mostró que la
     regla de datos personales tenía un hueco. Se arregló la regla, no la prueba.
  5. **Del despliegue a la compuerta** — el sistema publicado mostraba `lago: 0/22`; se volvió
     al código de `api/datos.js` y a la configuración del proyecto en Vercel, no a los datos.
  6. **Del Excel a la ingesta** — al copiar las licencias literales apareció el conflicto de
     F19. Se leyeron los dos PDFs de la fuente y el lago pasó de «sin confirmar» a OGL-2.0,
     con la contradicción escrita en la ficha.

---

Réplica del [Cerebro Lima](https://cerebro-lima.vercel.app/) para el
[taller](https://topicos-si.vercel.app/Tallerdatos) de Tópicos de Sistemas de Información.
Profesor: Santiago Jiménez Londoño.
