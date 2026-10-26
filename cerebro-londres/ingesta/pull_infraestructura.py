#!/usr/bin/env python3
"""Ingesta · infraestructura: transporte público dentro de Westminster.

VUELTA ATRÁS, anotada. El plan era usar la TfL Unified API (/StopPoint por
centro y radio). El 2026-09-21 esa familia de endpoints devolvió 504 Gateway
Timeout de forma sostenida —/StopPoint?lat,lon,radius y /Line/Mode/*/StopPoints,
en varios intentos y con radios distintos— mientras /AirQuality del mismo host
respondía 200. No es la red de aquí: es la fuente. Queda en el catálogo como
«caido» con el error exacto, y el tramo se resuelve con OpenStreetMap, que sí
responde y además permite recortar por el polígono oficial del borough.

Que la fuente natural esté caída no es excusa para no tener el dato; es una
razón para decir de dónde salió el que hay.
"""
import collections, json, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

ESPEJOS = ["https://overpass-api.de/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter",
           "https://overpass.private.coffee/api/interpreter"]
AREA = "3600051781"                       # relación OSM 51781 = City of Westminster (ref:gss E09000033)
FOCO, FOCO_COD = "City of Westminster", "E09000033"


def overpass(consulta):
    ultimo = None
    for url in ESPEJOS:
        try:
            d = C.get_json(url, datos="data=" + consulta, intentos=2, espera=6)
            if "elements" in d:
                return d["elements"]
        except RuntimeError as e:
            ultimo = e
            print(f"    ! {url.split('/')[2]} no respondió", file=sys.stderr)
    raise RuntimeError(f"ningún espejo de Overpass respondió · {ultimo}")


def consulta(cuerpo):
    return f"[out:json][timeout:180];area({AREA})->.a;({cuerpo});out tags center;"


# Estaciones de metro/tren y paradas de autobús, dentro del área oficial del borough
estaciones = overpass(consulta(
    'node["railway"="station"](area.a);way["railway"="station"](area.a);'
    'node["station"="subway"](area.a);'))
paradas_bus = overpass(consulta('node["highway"="bus_stop"](area.a);'))
ciclo = overpass(consulta(
    'node["amenity"="bicycle_rental"](area.a);way["amenity"="bicycle_rental"](area.a);'))

# Una estación puede estar mapeada como nodo y como vía: se deduplica por nombre
nombres_est = sorted({e.get("tags", {}).get("name") for e in estaciones
                      if e.get("tags", {}).get("name")})
redes = collections.Counter(
    e.get("tags", {}).get("network", "sin red declarada") for e in estaciones)

print(f"  estaciones      : {len(estaciones):>4} elementos · {len(nombres_est)} nombres distintos")
print(f"  paradas de bus  : {len(paradas_bus):>4}")
print(f"  puntos de bici  : {len(ciclo):>4}")

fuentes = [
    {"id": "osm_transporte", "nombre": "OpenStreetMap · Overpass API (transporte)",
     "entidad": "OSM", "url": "https://wiki.openstreetmap.org/wiki/Overpass_API",
     "resolucion": "punto (dentro del área oficial del borough)",
     "vigencia": C.hoy(), "probado": C.hoy(), "estado": "vivo", "licencia": "ODbL-1.0",
     "personas": "no", "proteccion": "abierto", "uso": "sección Territorio · infraestructura",
     "nota": ("© OpenStreetMap contributors, ODbL. El área es la relación 51781, verificada por "
              f"ref:gss={FOCO_COD}: se cruza por código, no por nombre. Cobertura voluntaria.")},
    # La fuente que NO sirvió también se declara, aquí y en el catálogo
    {"id": "tfl_stoppoint", "nombre": "TfL Unified API · StopPoint",
     "entidad": "TfL", "url": "https://api-portal.tfl.gov.uk/api-details#api=StopPoint",
     "resolucion": "parada", "vigencia": "—", "probado": C.hoy(), "estado": "caido",
     "licencia": "terminos-del-servicio", "personas": "no", "proteccion": "abierto",
     "uso": "descartada para esta sección",
     "nota": ("504 Gateway Timeout sostenido el 2026-09-21 en /StopPoint?lat,lon,radius y en "
              "/Line/Mode/*/StopPoints, con varios radios y reintentos. /AirQuality del mismo "
              "host respondía 200, así que la caída es del endpoint, no del servicio. "
              "Reemplazada por OpenStreetMap. Volver a probar.")},
]

cifras = {
    "estaciones_n": C.cifra(len(nombres_est), "estaciones", "osm_transporte", C.hoy(),
                            f"Estaciones de metro y tren con nombre dentro de {FOCO}"),
    "paradas_bus_n": C.cifra(len(paradas_bus), "paradas", "osm_transporte", C.hoy(),
                             "Paradas de autobús mapeadas en OpenStreetMap"),
    "bicicleta_puntos_n": C.cifra(len(ciclo), "puntos", "osm_transporte", C.hoy(),
                                  "Puntos de alquiler de bicicleta"),
}

ruta = C.escribir(
    "infraestructura", fuentes, cifras,
    listas={"estaciones": nombres_est, "redes": redes.most_common(10)},
    distrito_foco=FOCO,
    salvedades=["TfL StopPoint caída (504) el 2026-09-21; el conteo viene de OpenStreetMap, "
                "cuya cobertura es voluntaria y puede diferir del registro oficial de TfL."])
print(f"\n  → {ruta.relative_to(C.RAIZ)} · {len(cifras)} cifras")
