#!/usr/bin/env python3
"""Ingesta · transporte por borough: paradas NaPTAN, los 33 boroughs (no solo Westminster).

Fuente: NaPTAN (DfT), área administrativa 490 = Londres. A diferencia de
osm_transporte (que solo cubre Westminster, vía OSM, con mapeo voluntario),
NaPTAN es el registro OFICIAL y cubre toda la ciudad.

El CSV no trae el borough de cada parada, solo coordenadas y una «localidad»
(un barrio, no una unidad administrativa). Se clasifica por punto dentro de
polígono contra los 33 boroughs oficiales que ya están en el repo
(territorio/boroughs.geojson, bajados para pull_territorio.py): ver
comun.clasificador_de_boroughs.

StopType de NaPTAN, lo que importa aquí: BCT/BCS son parada o bahía de bus,
RSE es entrada de estación de tren, TMU es parada de metro o tranvía, FTD es
terminal o muelle de ferri. Solo se cuentan las paradas «active»: el registro
también guarda paradas retiradas, y contarlas infla el número.
"""
import csv, io, json, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

CSV_URL = "https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv&atcoAreaCodes=490"
FOCO = "Westminster"                 # así lo nombra boroughs.geojson (campo LAD25NM del ONS)
FOCO_SALIDA = "City of Westminster"  # nombre que usa el resto del lago
MODO = {"BCT": "bus (en calle)", "BCS": "bus (bahía)", "RSE": "entrada de estación de tren",
        "TMU": "metro o tranvía", "FTD": "ferri"}

print("  bajando NaPTAN, área 490 (≈4,5 MB)…")
texto = C.get(CSV_URL, crudo="naptan_490.csv")
filas = [f for f in csv.DictReader(io.StringIO(texto)) if f["Status"] == "active"]
print(f"  {len(filas)} paradas activas")

geo = json.loads((C.RAIZ / "territorio" / "boroughs.geojson").read_text(encoding="utf-8"))
clasificar = C.clasificador_de_boroughs(geo)

por_borough, sin_borough = {}, 0
for f in filas:
    try:
        lon, lat = float(f["Longitude"]), float(f["Latitude"])
    except ValueError:
        sin_borough += 1
        continue
    props = clasificar(lon, lat)
    if not props:
        sin_borough += 1          # fuera de los 33 (p. ej. en el límite, o en el Támesis)
        continue
    b = por_borough.setdefault(props["nombre"], {"nombre": props["nombre"], "paradas_n": 0, "por_modo": {}})
    b["paradas_n"] += 1
    modo = MODO.get(f["StopType"], f["StopType"])
    b["por_modo"][modo] = b["por_modo"].get(modo, 0) + 1

print(f"  clasificadas en un borough: {len(filas) - sin_borough} · sin clasificar: {sin_borough}")
if len(por_borough) != 33:
    print(f"  ! solo {len(por_borough)} de 33 boroughs tienen al menos una parada (revisar, no se detiene el script)")

boroughs = sorted(por_borough.values(), key=lambda b: -b["paradas_n"])
for i, b in enumerate(boroughs, 1):
    b["puesto"] = i
    b["por_modo"] = [{"modo": m, "n": n} for m, n in sorted(b["por_modo"].items(), key=lambda x: -x[1])]

foco = next(b for b in boroughs if b["nombre"] == FOCO)
mas_paradas, menos_paradas = boroughs[0], boroughs[-1]

fuentes = [{
    "id": "dft_naptan",
    "nombre": "NaPTAN · National Public Transport Access Nodes (área 490, Londres)",
    "entidad": "DfT",
    "url": "https://www.gov.uk/government/publications/national-public-transport-access-node-schema",
    "resolucion": "parada, clasificada por borough contra el polígono oficial",
    "vigencia": "continua",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Infraestructura · transporte en los 33 boroughs",
    "nota": ("Registro oficial, no mapeo voluntario: complementa a osm_transporte (solo "
             "Westminster). El borough de cada parada se calculó por punto dentro de "
             "polígono, no viene en el archivo original."),
}]

cifras = {
    "paradas_londres_n": C.cifra(len(filas) - sin_borough, "paradas", "dft_naptan", C.hoy(),
                                  "Activas y clasificadas en uno de los 33 boroughs"),
    "paradas_westminster": C.cifra(foco["paradas_n"], "paradas", "dft_naptan", C.hoy(), ""),
    "puesto_paradas_westminster": C.cifra(foco["puesto"], "puesto de 33", "dft_naptan", C.hoy(),
                                           "1 = el borough con más paradas"),
    "borough_mas_paradas": C.cifra(mas_paradas["nombre"], "borough", "dft_naptan", C.hoy(),
                                    f"{mas_paradas['paradas_n']} paradas"),
    "borough_menos_paradas": C.cifra(menos_paradas["nombre"], "borough", "dft_naptan", C.hoy(),
                                      f"{menos_paradas['paradas_n']} paradas"),
}

listas = {"boroughs": boroughs}

ruta = C.escribir(
    "transporte_boroughs", fuentes, cifras, listas=listas,
    territorio="Greater London (33 boroughs)",
    nota=(f"{sin_borough} paradas no cayeron dentro de ningún polígono de los 33 boroughs "
          "(bordes administrativos, estaciones sobre el río, o coordenadas imprecisas del propio "
          "registro): se cuentan aparte, no se fuerzan a un borough."),
)
print(f"  Westminster: {foco['paradas_n']} paradas, puesto {foco['puesto']} de {len(boroughs)}")
print(f"  más paradas: {mas_paradas['nombre']} ({mas_paradas['paradas_n']}) · menos: {menos_paradas['nombre']} ({menos_paradas['paradas_n']})")
print(f"  → {ruta}")
