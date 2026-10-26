#!/usr/bin/env python3
"""Ingesta · economía y vivienda: precio de la vivienda en Westminster y Londres.

Fuente: UK House Price Index, HM Land Registry (linked data, sin llave).
Es el equivalente del «precio del m²» del Cerebro Lima: la cifra con la que
un concejal discute si su borough es caro y respecto de qué.

Ojo con la unidad: el UK HPI publica PRECIO MEDIO DE VIVIENDA en libras, no
precio por metro cuadrado. No son intercambiables y la unidad va en el contrato.
"""
import sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

BASE = "https://landregistry.data.gov.uk/data/ukhpi/region"
FOCO, FOCO_NOMBRE = "city-of-westminster", "City of Westminster"
COMPARA = {"london": "London", "england": "England",
           "camden": "Camden", "kensington-and-chelsea": "Kensington and Chelsea"}
MESES = 60          # cinco años


def region(nombre, n=MESES):
    """Toda la serie de una región en UNA llamada.

    El endpoint por mes existe, pero pedir 60 meses × 5 regiones son 300
    peticiones para lo mismo. `month.json?_pageSize=` las reduce a una por región.
    """
    url = f"{BASE}/{nombre}/month.json?_pageSize={n}&_sort=-refMonth"
    d = C.get_json(url, crudo=f"ukhpi_{nombre}.json")
    return d.get("result", {}).get("items", [])


def valor(it, campo):
    """El linked data devuelve a veces el número suelto y a veces {'value': n}."""
    v = it.get(campo)
    if isinstance(v, list):
        v = v[0] if v else None
    if isinstance(v, dict):
        v = v.get("value")
    return v if isinstance(v, (int, float)) else None


series, ultimos, detalles = {}, {}, {}
for nombre, etiqueta in [(FOCO, FOCO_NOMBRE), *COMPARA.items()]:
    items = region(nombre)
    puntos = sorted(
        ([it["refMonth"], int(valor(it, "averagePrice"))]
         for it in items
         if it.get("refMonth") and valor(it, "averagePrice") is not None),
        key=lambda p: p[0])
    if not puntos:
        print(f"  ! {etiqueta}: sin datos", file=sys.stderr)
        continue
    clave = nombre.replace("-", "_")
    series[f"precio_medio_{clave}"] = C.serie(puntos, "£ por vivienda", "ukhpi")
    ultimos[clave] = puntos[-1]
    detalles[clave] = next((it for it in items if it.get("refMonth") == puntos[-1][0]), {})
    print(f"  {etiqueta:<28} £{puntos[-1][1]:>10,}  ({puntos[-1][0]}) · {len(puntos)} meses")

if "city_of_westminster" not in ultimos:
    sys.exit("sin precio para el foco: no se escribe el lago")

fmes, fval = ultimos["city_of_westminster"]

# Detalle por tipo de vivienda, en el último mes con dato
detalle = detalles.get("city_of_westminster", {})
tipos = {}
for campo, etiqueta in (("averagePriceFlatMaisonette", "piso"),
                        ("averagePriceTerraced", "adosada"),
                        ("averagePriceSemiDetached", "pareada"),
                        ("averagePriceDetached", "unifamiliar")):
    v = valor(detalle, campo)
    if v is not None:
        tipos[etiqueta] = int(v)

fuentes = [{
    "id": "ukhpi",
    "nombre": "UK House Price Index (HM Land Registry, linked data)",
    "entidad": "HM Land Registry",
    "url": "https://landregistry.data.gov.uk/app/ukhpi",
    "resolucion": "borough",
    "vigencia": f"{series['precio_medio_city_of_westminster']['puntos'][0][0]}–{fmes}",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Economía y vivienda",
    "nota": ("Precio MEDIO de vivienda en libras, no precio por m². El índice se revisa "
             "hacia atrás: los últimos meses pueden cambiar en publicaciones posteriores."),
}]

cifras = {
    "precio_medio_westminster": C.cifra(
        fval, "£ por vivienda", "ukhpi", fmes,
        "Cifra provisional: el UK HPI revisa los últimos meses en publicaciones posteriores"),
}
if "london" in ultimos:
    cifras["precio_medio_londres"] = C.cifra(
        ultimos["london"][1], "£ por vivienda", "ukhpi", ultimos["london"][0], "Media de Greater London")
    cifras["veces_la_media_de_londres"] = C.cifra(
        round(fval / ultimos["london"][1], 2), "veces", "ukhpi", fmes,
        "Cuántas veces la media londinense cuesta una vivienda en Westminster")
if "england" in ultimos:
    cifras["veces_la_media_de_inglaterra"] = C.cifra(
        round(fval / ultimos["england"][1], 2), "veces", "ukhpi", fmes,
        "Cuántas veces la media de Inglaterra")
for etiqueta, v in tipos.items():
    cifras[f"precio_medio_{etiqueta}"] = C.cifra(
        v, "£ por vivienda", "ukhpi", fmes, f"Precio medio de una vivienda tipo «{etiqueta}»")

# Variación interanual, calculada, no tecleada
pts = series["precio_medio_city_of_westminster"]["puntos"]
hace12 = next((p for p in pts if p[0] == f"{int(fmes[:4])-1}{fmes[4:]}"), None)
if hace12:
    cifras["variacion_interanual"] = C.cifra(
        round(100 * (fval - hace12[1]) / hace12[1], 2), "%", "ukhpi", fmes,
        f"Frente a {hace12[0]}: £{hace12[1]:,}")

ruta = C.escribir("economia", fuentes, cifras, series,
                  listas={"por_tipo_de_vivienda": [[k, v] for k, v in tipos.items()]},
                  distrito_foco=FOCO_NOMBRE)
print(f"\n  → {ruta.relative_to(C.RAIZ)} · {len(cifras)} cifras · {len(series)} series")
