#!/usr/bin/env python3
"""Ingesta · turismo: alojamiento y atracciones en Westminster, desde OpenStreetMap.

Fuente: Overpass API (OSM), licencia ODbL — que obliga a compartir igual lo que
se derive de la base, no solo a citar. Es la licencia más exigente del sistema
y por eso va marcada aparte en el catálogo.

Cobertura voluntaria: OSM complementa un registro oficial, no lo sustituye.
Lo que no está mapeado no existe para este script, y eso no es lo mismo que
no existir en la calle.

Overpass falló en tres espejos el 2026-09-21 con timeout de despachador. Por eso
el script recorre espejos y sube el timeout de la consulta, en vez de rendirse.
"""
import collections, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

ESPEJOS = ["https://overpass-api.de/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter",
           "https://overpass.private.coffee/api/interpreter"]
# Área de Westminster por su relación en OSM (3600051781 = 3600000000 + id de relación)
AREA = "3600051781"
FOCO = "City of Westminster"


def overpass(consulta):
    """Recorre los espejos. El primero que responda, gana."""
    ultimo = None
    for url in ESPEJOS:
        try:
            d = C.get_json(url, datos="data=" + consulta, intentos=2, espera=6)
            if "elements" in d:
                print(f"    (espejo: {url.split('/')[2]})")
                return d["elements"]
        except RuntimeError as e:
            ultimo = e
            print(f"    ! {url.split('/')[2]} no respondió", file=sys.stderr)
    raise RuntimeError(f"ningún espejo de Overpass respondió · {ultimo}")


def contar(clave, valores):
    filtro = "|".join(valores)
    q = (f'[out:json][timeout:180];area({AREA})->.a;'
         f'(node["{clave}"~"^({filtro})$"](area.a);'
         f'way["{clave}"~"^({filtro})$"](area.a);'
         f'relation["{clave}"~"^({filtro})$"](area.a););out tags center;')
    els = overpass(q)
    tipos = collections.Counter(e.get("tags", {}).get(clave) for e in els)
    nombrados = [e for e in els if e.get("tags", {}).get("name")]
    return els, tipos, nombrados


aloj, tipos_aloj, aloj_nom = contar("tourism", ["hotel", "hostel", "guest_house", "apartment"])
print(f"  alojamiento : {len(aloj):>5} · {dict(tipos_aloj)}")

atrac, tipos_atrac, atrac_nom = contar("tourism", ["attraction", "museum", "gallery", "artwork", "viewpoint"])
print(f"  atracciones : {len(atrac):>5} · {dict(tipos_atrac)}")

# Habitaciones declaradas: solo donde OSM las trae. Es una cota inferior, no un total.
habitaciones = sum(int(e["tags"]["rooms"]) for e in aloj
                   if str(e.get("tags", {}).get("rooms", "")).isdigit())
con_rooms = sum(1 for e in aloj if str(e.get("tags", {}).get("rooms", "")).isdigit())

fuentes = [{
    "id": "osm_overpass",
    "nombre": "OpenStreetMap · Overpass API",
    "entidad": "OSM",
    "url": "https://wiki.openstreetmap.org/wiki/Overpass_API",
    "resolucion": "punto (dentro del borough)",
    "vigencia": C.hoy(),
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "ODbL-1.0",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Turismo · capa de puntos del mapa",
    "nota": ("© OpenStreetMap contributors, ODbL: obliga a compartir igual lo derivado de la "
             "base, no solo a citar. Cobertura voluntaria: complementa el registro oficial, "
             "no lo sustituye. Los espejos fallan bajo carga; el script los recorre."),
}]

cifras = {
    "alojamientos_n": C.cifra(len(aloj), "establecimientos", "osm_overpass", C.hoy(),
                              f"Hoteles, hostales, casas de huéspedes y apartamentos en {FOCO}"),
    "hoteles_n": C.cifra(tipos_aloj.get("hotel", 0), "hoteles", "osm_overpass", C.hoy(),
                         "Etiquetados tourism=hotel"),
    "atracciones_n": C.cifra(len(atrac), "puntos", "osm_overpass", C.hoy(),
                             "Atracciones, museos, galerías, obras de arte y miradores"),
    "museos_n": C.cifra(tipos_atrac.get("museum", 0), "museos", "osm_overpass", C.hoy(),
                        "Etiquetados tourism=museum"),
    "habitaciones_declaradas": C.cifra(
        habitaciones, "habitaciones", "osm_overpass", C.hoy(),
        f"Cota INFERIOR: solo {con_rooms} de {len(aloj)} alojamientos declaran «rooms» en OSM"),
}

ruta = C.escribir(
    "turismo", fuentes, cifras,
    listas={"alojamiento_por_tipo": tipos_aloj.most_common(),
            "atracciones_por_tipo": tipos_atrac.most_common(),
            "atracciones_nombradas": sorted(
                {e["tags"]["name"] for e in atrac_nom})[:120]},
    distrito_foco=FOCO,
    nota="Conteos de OpenStreetMap, no de un registro oficial de turismo.")
print(f"\n  → {ruta.relative_to(C.RAIZ)} · {len(cifras)} cifras")
