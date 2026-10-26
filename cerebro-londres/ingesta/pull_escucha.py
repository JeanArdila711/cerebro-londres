#!/usr/bin/env python3
"""Ingesta · escucha: cuánta gente busca Westminster y sus lugares en Wikipedia.

Es la línea de base del taller, portada a Londres: el mismo script de la lámina
del lago, con la misma forma de contrato. Sin llaves, solo biblioteca estándar.

Un título que coincide no es la cosa: se exige que el artículo sea `standard`
(no una desambiguación) y se usa el título canónico que devuelve la API.
"""
import json, sys, urllib.parse
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

DESDE, HASTA = "20250101", "20260831"
WIKI = "en.wikipedia"          # Londres se documenta sobre todo en inglés
FOCO = "City of Westminster"

LUGARES = {
    "westminster":        "City of Westminster",
    "buckingham_palace":  "Buckingham Palace",
    "westminster_abbey":  "Westminster Abbey",
    "oxford_street":      "Oxford Street",
    "soho":               "Soho, London",
    "trafalgar_square":   "Trafalgar Square",
}

# Comparación: los 33 boroughs, no 4 — el profesor marcó que «si comparan
# boroughs, que sean los 33». Título canónico de Wikipedia en inglés por
# patrón («London Borough of X»), con las excepciones reales: los tres Royal
# Borough, la City y Westminster (que ya está en LUGARES, no se repite aquí).
ROYAL = {"Kensington and Chelsea", "Kingston upon Thames", "Greenwich"}
BOROUGHS_33 = json.loads((C.LAGO / "demografia.json").read_text(encoding="utf-8"))["listas"]["boroughs"]


def _titulo_wikipedia(nombre):
    if nombre == "City of London":
        return "City of London"
    prefijo = "Royal Borough of " if nombre in ROYAL else "London Borough of "
    return prefijo + nombre


PARES = {
    b["nombre"].lower().replace(" ", "_").replace(",", ""): _titulo_wikipedia(b["nombre"])
    for b in BOROUGHS_33 if b["nombre"] != "Westminster"
}


def canonico(titulo, wiki=WIKI):
    """Devuelve el título canónico, o None si no es un artículo."""
    idioma = wiki.split(".")[0]
    t = urllib.parse.quote(titulo.replace(" ", "_"), safe="")
    r = C.get_json(f"https://{idioma}.wikipedia.org/api/rest_v1/page/summary/{t}")
    if r.get("type") != "standard":
        print(f"  ! «{titulo}» no es un artículo sino {r.get('type')}", file=sys.stderr)
        return None
    return r["titles"]["canonical"]


def vistas(titulo_canonico, wiki=WIKI):
    t = urllib.parse.quote(titulo_canonico, safe="")
    url = (f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
           f"{wiki}/all-access/user/{t}/monthly/{DESDE}/{HASTA}")
    items = C.get_json(url).get("items", [])
    return [[i["timestamp"][:4] + "-" + i["timestamp"][4:6], i["views"]] for i in items], url


fuentes = [{
    "id": "wikimedia_pageviews",
    "nombre": "Wikimedia Pageviews API",
    "entidad": "Wikimedia",
    "url": "https://wikimedia.org/api/rest_v1/metrics/pageviews/",
    "resolucion": "articulo",
    "vigencia": f"{DESDE[:4]}-{HASTA[:4]}",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "CC0-1.0",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Escucha social",
    "nota": "Vistas de usuarios (excluye bots declarados). Mide atención, no visitas físicas.",
}]

series, cifras, fallos = {}, {}, []

for clave, titulo in {**LUGARES, **PARES}.items():
    try:
        canon = canonico(titulo)
    except RuntimeError as e:
        print(f"  ! «{titulo}»: {str(e)[:70]}", file=sys.stderr)
        fallos.append(titulo)
        continue
    if not canon:
        fallos.append(titulo)
        continue
    try:
        puntos, url = vistas(canon)
    except RuntimeError as e:
        print(f"  ! «{titulo}»: {str(e)[:70]}", file=sys.stderr)
        fallos.append(titulo)
        continue
    if not puntos:
        fallos.append(titulo)
        continue
    series[f"wiki_{clave}"] = C.serie(puntos, "vistas de personas", "wikimedia_pageviews")
    print(f"  {titulo:<45} {len(puntos):>2} meses · último {puntos[-1][0]} = {puntos[-1][1]:,}")

foco = series.get("wiki_westminster")
if not foco:
    sys.exit(f"sin serie para el foco «{FOCO}»: no se escribe el lago")

pts = foco["puntos"]
ultimo = pts[-1]
pico = max(pts, key=lambda p: p[1])
cifras["vistas_ultimo_mes"] = C.cifra(
    ultimo[1], "vistas de personas", "wikimedia_pageviews", ultimo[0],
    f"Artículo «{FOCO}» en {WIKI}")
cifras["vistas_pico_mes"] = C.cifra(
    pico[1], "vistas de personas", "wikimedia_pageviews", pico[0], "Mes de mayor atención del período")

# Puesto del foco frente a los boroughs de comparación, en el último mes disponible
ranking = sorted(
    ((k, s["puntos"][-1][1]) for k, s in series.items()
     if k.replace("wiki_", "") in {"westminster", *PARES}),
    key=lambda x: -x[1])
puesto = [k for k, _ in ranking].index("wiki_westminster") + 1
cifras["puesto_entre_boroughs"] = C.cifra(
    puesto, f"puesto de {len(ranking)}", "wikimedia_pageviews", ultimo[0],
    f"Entre los {len(ranking)} de 33 boroughs con artículo de Wikipedia resuelto "
    f"({len(fallos)} cayeron o no tienen artículo propio bajo este patrón de título)")

ruta = C.escribir(
    "escucha", fuentes, cifras, series,
    nota=("Mide atención en Wikipedia, no visitantes. Los picos suelen seguir a hechos "
          "noticiosos, no a llegadas de turistas."),
    territorio=FOCO,
    caidas=fallos)

print(f"\n{FOCO}: {len(pts)} meses, último {ultimo[0]} con {ultimo[1]:,} vistas")
print(f"series: {len(series)} · caídas: {len(fallos)} · → {ruta.relative_to(C.RAIZ)}")
