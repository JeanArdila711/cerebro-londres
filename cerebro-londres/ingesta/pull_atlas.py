#!/usr/bin/env python3
"""Derivado · atlas de los 33 boroughs: la tabla con la que se comparan.

No baja una fuente nueva por cada columna: junta lo que ya está en el lago
(población del ONS, precio de la vivienda del UK HPI) y calcula el área desde
el polígono oficial, para poder hablar de densidad.

Cada columna dice de qué fuente sale. Un atlas sin procedencia es una tabla
bonita que nadie puede auditar.
"""
import json, math, re, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

FOCO_COD, FOCO = "E09000033", "City of Westminster"
UKHPI = "https://landregistry.data.gov.uk/data/ukhpi/region"


# El ONS y el UK Land Registry no llaman igual a los mismos boroughs. El ONS
# dice «Westminster»; el UK HPI, «city-of-westminster». Derivar el identificador
# del nombre falla justo en el borough del foco, y falla en silencio: devuelve
# una lista sin precio en vez de un error. Por eso la correspondencia se escribe
# a mano y se comprueba que no quede ningún borough sin pareja.
ALIAS = {
    "Westminster": "city-of-westminster",
    "City of London": "city-of-london",
}


def slug(nombre):
    if nombre in ALIAS:
        return ALIAS[nombre]
    return re.sub(r"[^a-z0-9-]", "", nombre.lower().replace(" ", "-"))


def area_km2(geom):
    """Área de un polígono en coordenadas geográficas, por la fórmula del área
    esférica (shoelace corregido por la latitud). Suficiente para densidad."""
    R = 6371.0088
    partes = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    total = 0.0
    for poligono in partes:
        for i, anillo in enumerate(poligono):
            s = 0.0
            for j in range(len(anillo) - 1):
                x1, y1 = math.radians(anillo[j][0]), math.radians(anillo[j][1])
                x2, y2 = math.radians(anillo[j + 1][0]), math.radians(anillo[j + 1][1])
                s += (x2 - x1) * (2 + math.sin(y1) + math.sin(y2))
            a = abs(s * R * R / 2.0)
            total += a if i == 0 else -a          # los anillos interiores restan
    return round(total, 2)


demo = json.loads((C.LAGO / "demografia.json").read_text(encoding="utf-8"))
boroughs = {b["codigo"]: dict(b) for b in demo["listas"]["boroughs"]}
anio = demo["cifras"]["poblacion_westminster"]["vigencia"]

geo = json.loads((C.RAIZ / "territorio" / "boroughs.geojson").read_text(encoding="utf-8"))
for f in geo["features"]:
    cod = f["properties"]["codigo"]
    if cod in boroughs:
        boroughs[cod]["area_km2"] = area_km2(f["geometry"])

sin_precio = []
for cod, b in boroughs.items():
    url = f"{UKHPI}/{slug(b['nombre'])}/month.json?_pageSize=1&_sort=-refMonth"
    try:
        items = C.get_json(url, intentos=2).get("result", {}).get("items", [])
    except RuntimeError:
        items = []
    v = items[0].get("averagePrice") if items else None
    if isinstance(v, (int, float)):
        b["precio_medio_gbp"] = int(v)
        b["precio_mes"] = items[0].get("refMonth")
    else:
        sin_precio.append(b["nombre"])

for b in boroughs.values():
    if b.get("area_km2"):
        b["densidad_hab_km2"] = round(b["poblacion"] / b["area_km2"])

if sin_precio:
    # Un borough sin precio es un fallo de correspondencia, no un dato que falta.
    sys.exit(f"sin precio para {len(sin_precio)} boroughs: {sin_precio}. "
             f"Revisa ALIAS en este script antes de publicar.")

filas = sorted(boroughs.values(), key=lambda b: -b["poblacion"])
foco = boroughs[FOCO_COD]
print(f"  {len(filas)} boroughs · sin precio: {sin_precio or 'ninguno'}")
print(f"  {FOCO}: {foco['poblacion']:,} hab · {foco.get('area_km2')} km² · "
      f"{foco.get('densidad_hab_km2'):,} hab/km² · £{foco.get('precio_medio_gbp', 0):,}")


def puesto(clave, mayor_primero=True):
    con = [b for b in filas if b.get(clave) is not None]
    orden = sorted(con, key=lambda b: -b[clave] if mayor_primero else b[clave])
    return [b["codigo"] for b in orden].index(FOCO_COD) + 1, len(orden), orden


fuentes = [
    {"id": "atlas_derivado", "nombre": "Atlas de los 33 boroughs (tabla derivada del lago)",
     "entidad": "Cerebro Londres", "url": "https://github.com/", "resolucion": "borough",
     "vigencia": str(anio), "probado": C.hoy(), "estado": "vivo", "licencia": "derivado",
     "personas": "no", "proteccion": "abierto", "uso": "sección Atlas · coropleta del mapa",
     "nota": ("Columnas: poblacion (ONS mid-year, vía Nomis), area_km2 (calculada sobre el "
              "polígono ONS), densidad (derivada) y precio_medio_gbp (UK HPI). El área se "
              "calcula por área esférica sobre la capa generalizada: sirve para densidad, "
              "no para catastro. ODbL no aplica aquí; ninguna columna viene de OSM.")},
]

p_dens, n_dens, orden_dens = puesto("densidad_hab_km2")
p_precio, n_precio, orden_precio = puesto("precio_medio_gbp")
p_pob, n_pob, _ = puesto("poblacion")

cifras = {
    "boroughs_n": C.cifra(len(filas), "boroughs", "atlas_derivado", str(anio), "Greater London"),
    "westminster_puesto_poblacion": C.cifra(
        p_pob, f"puesto de {n_pob}", "atlas_derivado", str(anio), "De mayor a menor población"),
    "westminster_puesto_densidad": C.cifra(
        p_dens, f"puesto de {n_dens}", "atlas_derivado", str(anio), "De mayor a menor densidad"),
    "westminster_puesto_precio": C.cifra(
        p_precio, f"puesto de {n_precio}", "atlas_derivado", foco.get("precio_mes", str(anio)),
        "De mayor a menor precio medio de vivienda"),
    "borough_mas_denso": C.cifra(
        orden_dens[0]["nombre"], "borough", "atlas_derivado", str(anio),
        f"{orden_dens[0]['densidad_hab_km2']:,} hab/km²"),
    "borough_mas_caro": C.cifra(
        orden_precio[0]["nombre"], "borough", "atlas_derivado",
        orden_precio[0].get("precio_mes", str(anio)),
        f"£{orden_precio[0]['precio_medio_gbp']:,} de media"),
    "borough_mas_barato": C.cifra(
        orden_precio[-1]["nombre"], "borough", "atlas_derivado",
        orden_precio[-1].get("precio_mes", str(anio)),
        f"£{orden_precio[-1]['precio_medio_gbp']:,} de media"),
}

ruta = C.escribir("atlas_boroughs", fuentes, cifras, listas={"boroughs": filas},
                  ancla=FOCO, sin_precio=sin_precio,
                  nota=("Una cifra de ciudad esconde las diferencias de adentro: por eso el "
                        "sistema trabaja en dos escalas, los 33 boroughs y los wards del foco."))
print(f"  → {ruta.relative_to(C.RAIZ)} · el más caro: {orden_precio[0]['nombre']} · "
      f"el más denso: {orden_dens[0]['nombre']}")
