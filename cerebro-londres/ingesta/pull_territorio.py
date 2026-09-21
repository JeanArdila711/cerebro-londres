#!/usr/bin/env python3
"""Ingesta · territorio: los 33 boroughs y los wards de Westminster, en GeoJSON.

Fuente: ONS Open Geography Portal (ArcGIS FeatureServer), sin llave.
Las dos escalas del sistema, como Lima tiene 43 distritos + 14 zonas:
  · 33 boroughs de Greater London  → para comparar
  · wards de Westminster           → para ver dónde pasa lo que pasa

Coordenadas en WGS84 (outSR=4326) y capas generalizadas (BGC), no las de
máxima resolución: una capa que pesa 40 MB no la abre un teléfono.
"""
import json, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

ARCGIS = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services"
FOCO_COD, FOCO = "E09000033", "City of Westminster"
TERR = C.RAIZ / "territorio"


def capa(servicio, where, campos):
    url = (f"{ARCGIS}/{servicio}/FeatureServer/0/query"
           f"?where={where}&outFields={campos}&returnGeometry=true&outSR=4326&f=geojson")
    return C.get_json(url, crudo=f"geo_{servicio[:28]}.json")


def redondear(g, nd=5):
    """~1 m de precisión. Recorta el archivo a la mitad sin que se note en pantalla."""
    if isinstance(g, list):
        if g and isinstance(g[0], (int, float)):
            return [round(c, nd) for c in g]
        return [redondear(x, nd) for x in g]
    return g


def escribir_geo(nombre, fc):
    for f in fc["features"]:
        f["geometry"]["coordinates"] = redondear(f["geometry"]["coordinates"])
        f.pop("id", None)
    TERR.mkdir(exist_ok=True)
    ruta = TERR / f"{nombre}.geojson"
    ruta.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return ruta, len(fc["features"]), ruta.stat().st_size


# --- Boroughs ---------------------------------------------------------------
b = capa("Local_Authority_Districts_DEC_2025_Boundaries_UK_BGC",
         "LAD25CD%20LIKE%20%27E09%25%27", "LAD25CD,LAD25NM")
for f in b["features"]:
    p = f["properties"]
    p["codigo"], p["nombre"] = p.pop("LAD25CD"), p.pop("LAD25NM")
    p["foco"] = p["codigo"] == FOCO_COD
rb, nb, sb = escribir_geo("boroughs", b)
print(f"  boroughs : {nb:>3} features · {sb/1024:>6.0f} kB")
if nb != 33:
    sys.exit(f"se esperaban 33 boroughs y llegaron {nb}")

# --- Wards de Westminster ---------------------------------------------------
# Hallazgo del rastreo: los wards de diciembre de 2025 están publicados como
# MapServer, que no acepta la consulta que sí acepta el FeatureServer (400
# «Invalid URL»). La capa equivalente de diciembre de 2024 sí es FeatureServer,
# así que las dos escalas del sistema NO son de la misma cosecha: boroughs 2025,
# wards 2024. Queda dicho aquí y en la ficha del catálogo.
w = capa("Wards_December_2024_Boundaries_UK_BGC",
         f"LAD24CD%3D%27{FOCO_COD}%27", "WD24CD,WD24NM,LAD24CD")
for f in w["features"]:
    p = f["properties"]
    p["codigo"], p["nombre"] = p.pop("WD24CD"), p.pop("WD24NM")
    p.pop("LAD24CD", None)
rw, nw, sw = escribir_geo("wards_westminster", w)
print(f"  wards    : {nw:>3} features · {sw/1024:>6.0f} kB")

fuentes = [{
    "id": "ons_geography",
    "nombre": "ONS Open Geography Portal · Local Authority Districts (December 2025) and Wards (December 2024), generalised",
    "entidad": "ONS",
    "url": "https://geoportal.statistics.gov.uk/",
    "resolucion": "borough y ward",
    "vigencia": "boroughs 2025-12 · wards 2024-12",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "mapa · secciones Territorio y Atlas",
    "nota": ("Capas BGC (generalizadas, clipped) en WGS84. Las dos escalas no son de la misma "
             "cosecha: los wards de diciembre de 2025 solo están como MapServer, que devuelve 400 "
             "a la consulta, así que se usan los de diciembre de 2024. Contiene OS data © Crown "
             "copyright and database right 2024/2025; la atribución de OS va en la vista."),
}]

cifras = {
    "boroughs_n": C.cifra(nb, "boroughs", "ons_geography", "2025-12", "Greater London"),
    "wards_westminster_n": C.cifra(nw, "wards", "ons_geography", "2024-12",
                                   f"Divisiones electorales dentro de {FOCO}"),
}

ruta = C.escribir(
    "geo", fuentes, cifras,
    listas={"wards": sorted(f["properties"]["nombre"] for f in w["features"])},
    ambito="Greater London · foco City of Westminster",
    capas={"boroughs": {"archivo": "territorio/boroughs.geojson", "features": nb, "bytes": sb},
           "wards_westminster": {"archivo": "territorio/wards_westminster.geojson",
                                 "features": nw, "bytes": sw}})
print(f"\n  → {ruta.relative_to(C.RAIZ)} · {nb} boroughs, {nw} wards")
