#!/usr/bin/env python3
"""Utilidades compartidas por la ingesta.

Solo biblioteca estándar y ninguna llave: es la condición del taller.
El script base de Lima es autónomo; aquí se factoriza el HTTP y la escritura
del lago porque son idénticos en los diez temas. El contrato no cambia.
"""
import datetime, json, pathlib, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
import zipfile
from io import BytesIO

RAIZ = pathlib.Path(__file__).resolve().parent.parent
LAGO = RAIZ / "lago"
CRUDO = LAGO / "raw"
UA = {"User-Agent": "taller-sistemas-de-informacion/1.0 (curso universitario)"}

# Listas cerradas desde la primera ficha. El enunciado advierte que el catálogo
# de Lima escribe la licencia de 34 maneras y el MEF como dos entidades.
LICENCIAS = {"OGL-3.0", "ODbL-1.0", "CC0-1.0", "CC-BY-4.0", "derivado", "terminos-del-servicio",
             # rastreo 2026-09-25: el código dice lo que declara la fuente, sin inventar versiones
             "OGL-2.0", "CC-BY", "CC-BY-SA", "ODC-BY", "uso-personal",
             "todos-los-derechos-reservados", "sin-declarar", "sin-confirmar"}
ENTIDADES = {"ONS", "HM Land Registry", "Home Office", "TfL", "GLA", "OSM",
             "Wikimedia", "Open-Meteo", "NASA", "Cerebro Londres",
             # rastreo 2026-09-25
             "World Bank", "OECD", "Eurostat", "UN DESA", "IMF", "Bank of England",
             "MHCLG", "DfT", "DfE", "DESNZ", "Environment Agency", "Defra", "Met Office",
             "Imperial College London", "UK Power Networks", "NESO", "Ordnance Survey",
             "ORR", "CAA", "NHS England", "OHID", "CQC", "UK Government", "Companies House",
             "Metropolitan Police Service", "MOPAC", "London Fire Brigade", "HMRC", "GiGL",
             "London Borough of Camden", "London Elects", "Electoral Commission",
             "VisitBritain", "ALVA", "Inside Airbnb", "TomTom", "Google", "Mastodon",
             "Reddit", "Bluesky", "ESA", "Copernicus (UE)", "Mapzen", "Overture Maps Foundation",
             "postcodes.io", "Breathe London"}


def hoy():
    return datetime.date.today().isoformat()


def get(url, intentos=4, espera=3, crudo=None, datos=None, pausa=0.4, cabeceras=None):
    """GET (o POST si `datos`) con reintentos y respeto por el 429. Devuelve texto.

    Los reintentos no son adorno. El 2026-09-21, sobre estas mismas fuentes:
    Wikimedia Pageviews devolvió 429 al pedir nueve artículos seguidos, y Overpass
    dio error de timeout en tres espejos. Un script sin espera no baja estos datos.

    `cabeceras` se suma a UA: algunas APIs (como la de DfE) rechazan con 403 un
    POST sin `Content-Type: application/json` explícito.
    """
    cuerpo = datos.encode() if isinstance(datos, str) else datos
    ultimo = None
    for n in range(intentos):
        try:
            time.sleep(pausa)                       # cortesía con la fuente
            peticion = urllib.request.Request(url, data=cuerpo, headers={**UA, **(cabeceras or {})})
            with urllib.request.urlopen(peticion, timeout=90) as r:
                texto = r.read().decode("utf-8", "replace")
            if crudo:
                CRUDO.mkdir(parents=True, exist_ok=True)
                (CRUDO / crudo).write_text(texto, encoding="utf-8")
            return texto
        except urllib.error.HTTPError as e:
            ultimo = e
            if e.code in (429, 503) and n < intentos - 1:
                # Si la fuente dice cuánto esperar, se le hace caso.
                reintento = e.headers.get("Retry-After")
                time.sleep(float(reintento) if (reintento or "").isdigit()
                           else espera * 4 * (n + 1))
            elif e.code < 500 and e.code != 429:
                break                               # 404/403: reintentar no arregla nada
            elif n < intentos - 1:
                time.sleep(espera * (n + 1))
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            ultimo = e
            if n < intentos - 1:
                time.sleep(espera * (n + 1))
    raise RuntimeError(f"no respondió tras {intentos} intentos: {url} · {ultimo}")


def get_json(url, **kw):
    return json.loads(get(url, **kw))


def get_json_post(url, cuerpo_json, **kw):
    """POST con cuerpo JSON y Content-Type explícito (algunas APIs lo exigen, p. ej. DfE)."""
    return json.loads(get(url, datos=json.dumps(cuerpo_json), cabeceras={"Content-Type": "application/json"}, **kw))


def get_bin(url, intentos=4, espera=3, crudo=None, pausa=0.4):
    """Como get(), pero sin decodificar: para binarios (.ods, .xlsx, imágenes).

    get() siempre decodifica a UTF-8, lo que corrompe cualquier archivo que
    no sea texto. Mismo patrón de reintentos, separado para no arriesgar el
    comportamiento de get(), que ya usan diez scripts.
    """
    ultimo = None
    for n in range(intentos):
        try:
            time.sleep(pausa)
            peticion = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(peticion, timeout=90) as r:
                cuerpo = r.read()
            if crudo:
                CRUDO.mkdir(parents=True, exist_ok=True)
                (CRUDO / crudo).write_bytes(cuerpo)
            return cuerpo
        except urllib.error.HTTPError as e:
            ultimo = e
            if e.code in (429, 503) and n < intentos - 1:
                reintento = e.headers.get("Retry-After")
                time.sleep(float(reintento) if (reintento or "").isdigit()
                           else espera * 4 * (n + 1))
            elif e.code < 500 and e.code != 429:
                break
            elif n < intentos - 1:
                time.sleep(espera * (n + 1))
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            ultimo = e
            if n < intentos - 1:
                time.sleep(espera * (n + 1))
    raise RuntimeError(f"no respondió tras {intentos} intentos: {url} · {ultimo}")


def cifra(valor, unidad, fuente, vigencia, nota="", estado="integrado"):
    """Ninguna cifra sin valor, unidad, vigencia y fuente. Es el contrato."""
    return {"valor": valor, "unidad": unidad, "fuente": fuente,
            "vigencia": vigencia, "nota": nota, "estado": estado}


def serie(puntos, unidad, fuente):
    return {"fuente": fuente, "unidad": unidad, "puntos": puntos}


def escribir(tema, fuentes, cifras=None, series=None, listas=None, **extra):
    """Escribe lago/<tema>.json con la forma del contrato y lo valida de entrada."""
    for f in fuentes:
        if f.get("licencia") not in LICENCIAS:
            raise ValueError(f"licencia fuera de la lista cerrada: {f.get('licencia')!r} en {f.get('id')}")
        if f.get("entidad") not in ENTIDADES:
            raise ValueError(f"entidad fuera de la lista cerrada: {f.get('entidad')!r} en {f.get('id')}")
        for campo in ("id", "nombre", "url", "probado", "personas"):
            if not f.get(campo):
                raise ValueError(f"fuente {f.get('id')!r} sin campo obligatorio {campo!r}")

    ids = {f["id"] for f in fuentes}
    for clave, c in (cifras or {}).items():
        if c["fuente"] not in ids:
            raise ValueError(f"cifra {clave!r} apunta a una fuente que no está declarada: {c['fuente']!r}")

    doc = {"tema": tema, "probado": hoy(), "fuentes": fuentes,
           "cifras": cifras or {}, "series": series or {}, "listas": listas or {}}
    doc.update(extra)
    LAGO.mkdir(parents=True, exist_ok=True)
    destino = LAGO / f"{tema}.json"
    destino.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    return destino


_NS_TABLE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
_NS_TEXT = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"


def leer_ods(contenido, hoja, max_columnas=20):
    """Lee una hoja de un .ods (OpenDocument Spreadsheet) sin librerías externas.

    Un .ods es un zip con content.xml adentro: no hace falta odfpy ni pandas
    para leerlo, solo zipfile y xml.etree, que ya trae Python. Varios
    conjuntos del gobierno británico (como Council Tax levels de MHCLG) solo
    se publican en este formato, con cientos de hojas basura heredadas de
    hojas de cálculo viejas (referencias externas, plantillas en blanco):
    se pide la hoja por nombre, no por posición, para no depender del orden.

    Devuelve una lista de filas; cada fila es una lista de textos de celda,
    con las celdas repetidas (number-columns-repeated, típico en ODS para
    columnas vacías) expandidas hasta max_columnas.
    """
    z = zipfile.ZipFile(BytesIO(contenido))
    root = ET.fromstring(z.read("content.xml"))
    tabla = next(t for t in root.findall(f".//{{{_NS_TABLE}}}table")
                 if t.get(f"{{{_NS_TABLE}}}name") == hoja)
    filas = []
    for fila in tabla.findall(f"{{{_NS_TABLE}}}table-row"):
        vals = []
        for celda in fila.findall(f"{{{_NS_TABLE}}}table-cell"):
            rep = int(celda.get(f"{{{_NS_TABLE}}}number-columns-repeated", "1"))
            texto = "".join(p.text or "" for p in celda.iter(f"{{{_NS_TEXT}}}p"))
            vals.extend([texto] * min(rep, max_columnas))
        filas.append(vals[:max_columnas])
    return filas


def _punto_en_anillo(lon, lat, anillo):
    """Ray casting clásico: ¿el punto está dentro del anillo (lista de [lon, lat])?"""
    dentro = False
    n = len(anillo)
    x1, y1 = anillo[0]
    for i in range(1, n + 1):
        x2, y2 = anillo[i % n]
        if (y1 > lat) != (y2 > lat):
            x_cruce = (x2 - x1) * (lat - y1) / (y2 - y1) + x1
            if lon < x_cruce:
                dentro = not dentro
        x1, y1 = x2, y2
    return dentro


def punto_en_multipoligono(lon, lat, geometria):
    """¿El punto está dentro de un GeoJSON Polygon o MultiPolygon?

    El primer anillo de cada polígono es el borde exterior; los siguientes
    son huecos (un punto en un hueco no cuenta como adentro). Sin librerías
    de geometría: solo listas y ray casting, suficiente para clasificar
    puntos de transporte dentro de un borough.
    """
    poligonos = geometria["coordinates"] if geometria["type"] == "MultiPolygon" else [geometria["coordinates"]]
    for poligono in poligonos:
        if not _punto_en_anillo(lon, lat, poligono[0]):
            continue
        if any(_punto_en_anillo(lon, lat, hueco) for hueco in poligono[1:]):
            continue
        return True
    return False


def clasificador_de_boroughs(geojson_boroughs):
    """A partir de territorio/boroughs.geojson, da una función punto → borough.

    Precalcula la caja envolvente de cada borough para no probar el punto
    contra los 33 polígonos: normalmente la caja descarta todos menos uno.
    """
    preparados = []
    for f in geojson_boroughs["features"]:
        coords = f["geometry"]["coordinates"]
        poligonos = coords if f["geometry"]["type"] == "MultiPolygon" else [coords]
        lons = [pt[0] for pol in poligonos for anillo in pol for pt in anillo]
        lats = [pt[1] for pol in poligonos for anillo in pol for pt in anillo]
        preparados.append((f["properties"], f["geometry"], (min(lons), min(lats), max(lons), max(lats))))

    def clasificar(lon, lat):
        for props, geom, (x0, y0, x1, y1) in preparados:
            if x0 <= lon <= x1 and y0 <= lat <= y1 and punto_en_multipoligono(lon, lat, geom):
                return props
        return None

    return clasificar
