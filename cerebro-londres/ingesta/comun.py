#!/usr/bin/env python3
"""Utilidades compartidas por la ingesta.

Solo biblioteca estándar y ninguna llave: es la condición del taller.
El script base de Lima es autónomo; aquí se factoriza el HTTP y la escritura
del lago porque son idénticos en los diez temas. El contrato no cambia.
"""
import datetime, json, pathlib, time, urllib.error, urllib.parse, urllib.request

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


def get(url, intentos=4, espera=3, crudo=None, datos=None, pausa=0.4):
    """GET (o POST si `datos`) con reintentos y respeto por el 429. Devuelve texto.

    Los reintentos no son adorno. El 2026-09-21, sobre estas mismas fuentes:
    Wikimedia Pageviews devolvió 429 al pedir nueve artículos seguidos, y Overpass
    dio error de timeout en tres espejos. Un script sin espera no baja estos datos.
    """
    cuerpo = datos.encode() if isinstance(datos, str) else datos
    ultimo = None
    for n in range(intentos):
        try:
            time.sleep(pausa)                       # cortesía con la fuente
            peticion = urllib.request.Request(url, data=cuerpo, headers=UA)
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
