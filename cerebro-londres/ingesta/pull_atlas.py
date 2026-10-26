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


# Proyección del British National Grid (EPSG:27700): meridiano central 2°O,
# paralelo de origen 49°N, factor de escala 0,9996012717, falso origen
# (400000, -100000). Serie de Redfearn para la Transverse Mercator, la misma
# que publica el Ordnance Survey. El profesor pidió un plano métrico, no
# grados: un shoelace en lon/lat distorsiona el área porque un grado de
# longitud no mide lo mismo que uno de latitud.
#
# ponytail: se proyecta directo desde WGS84 (elipsoide GRS80/WGS84), sin el
# Helmert de 7 parámetros hacia el datum OSGB36. Ese ajuste solo traslada y
# rota ~unos cientos de metros en toda Gran Bretaña — el área de un polígono
# no cambia con una traslación ni una rotación, así que para «calcular área
# en EPSG:27700 en vez de grados» esto ya resuelve el problema real. Si algún
# día se necesitan coordenadas que calcen con mapas oficiales en OSGB36,
# agregar el Helmert antes de la proyección.
_A, _F = 6378137.0, 1 / 298.257223563          # WGS84
_B = _A * (1 - _F)
_E2 = (_A ** 2 - _B ** 2) / _A ** 2
_N = (_A - _B) / (_A + _B)
_F0 = 0.9996012717
_PHI0, _LAMBDA0 = math.radians(49), math.radians(-2)
_N0, _E0 = -100000.0, 400000.0


def _a_grid(lat, lon):
    """lat/lon en grados (WGS84) → (easting, northing) en metros, estilo EPSG:27700."""
    phi, lam = math.radians(lat), math.radians(lon)
    sin_phi, cos_phi, tan_phi = math.sin(phi), math.cos(phi), math.tan(phi)
    nu = _A * _F0 / math.sqrt(1 - _E2 * sin_phi ** 2)
    rho = _A * _F0 * (1 - _E2) / (1 - _E2 * sin_phi ** 2) ** 1.5
    eta2 = nu / rho - 1

    dphi, sphi = phi - _PHI0, phi + _PHI0
    Ma = (1 + _N + 5 / 4 * _N ** 2 + 5 / 4 * _N ** 3) * dphi
    Mb = (3 * _N + 3 * _N ** 2 + 21 / 8 * _N ** 3) * math.sin(dphi) * math.cos(sphi)
    Mc = (15 / 8 * _N ** 2 + 15 / 8 * _N ** 3) * math.sin(2 * dphi) * math.cos(2 * sphi)
    Md = 35 / 24 * _N ** 3 * math.sin(3 * dphi) * math.cos(3 * sphi)
    M = _B * _F0 * (Ma - Mb + Mc - Md)

    I_ = M + _N0
    II_ = nu / 2 * sin_phi * cos_phi
    III_ = nu / 24 * sin_phi * cos_phi ** 3 * (5 - tan_phi ** 2 + 9 * eta2)
    IIIA_ = nu / 720 * sin_phi * cos_phi ** 5 * (61 - 58 * tan_phi ** 2 + tan_phi ** 4)
    IV_ = nu * cos_phi
    V_ = nu / 6 * cos_phi ** 3 * (nu / rho - tan_phi ** 2)
    VI_ = nu / 120 * cos_phi ** 5 * (5 - 18 * tan_phi ** 2 + tan_phi ** 4
                                      + 14 * eta2 - 58 * tan_phi ** 2 * eta2)

    dlam = lam - _LAMBDA0
    northing = I_ + II_ * dlam ** 2 + III_ * dlam ** 4 + IIIA_ * dlam ** 6
    easting = _E0 + IV_ * dlam + V_ * dlam ** 3 + VI_ * dlam ** 5
    return easting, northing


def area_km2(geom):
    """Área de un polígono proyectado a metros (EPSG:27700-like), shoelace plano."""
    partes = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    total = 0.0
    for poligono in partes:
        for i, anillo in enumerate(poligono):
            puntos = [_a_grid(lat, lon) for lon, lat in anillo]
            s = sum(x1 * y2 - x2 * y1
                     for (x1, y1), (x2, y2) in zip(puntos, puntos[1:]))
            a = abs(s) / 2.0
            total += a if i == 0 else -a          # los anillos interiores restan
    return round(total / 1_000_000, 2)             # m² → km²


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
     "entidad": "Cerebro Londres", "url": "https://landregistry.data.gov.uk/app/ukhpi", "resolucion": "borough",
     "vigencia": str(anio), "probado": C.hoy(), "estado": "vivo", "licencia": "derivado",
     "personas": "no", "proteccion": "abierto", "uso": "sección Atlas · coropleta del mapa",
     "nota": ("Columnas: poblacion (ONS mid-year, vía Nomis), area_km2 (calculada sobre el "
              "polígono ONS), densidad (derivada) y precio_medio_gbp (UK HPI). El área se "
              "proyecta a metros (Transverse Mercator del British National Grid, EPSG:27700) "
              "sobre la capa generalizada: sirve para densidad, no para catastro. ODbL no "
              "aplica aquí; ninguna columna viene de OSM.")},
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
