#!/usr/bin/env python3
"""Ingesta · censo: Censo 2021 de Inglaterra y Gales, residentes habituales por
autoridad local (ONS, vía Nomis · dataset NM_2021_1, tabla TS001).

Profundiza demografia.py, que solo trae la estimación de mitad de año: el
censo es la única fuente con el desglose hogar vs. establecimiento colectivo
(residencias, cárceles, cuarteles…) por borough. Es decenal: 2021 es el más
reciente, no hay forma de pedir un año más nuevo.

Nomis acepta una lista de hasta cientos de códigos ONS separados por coma en
un solo GET: se piden los 33 boroughs de una vez, sin API key.
"""
import csv, io, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

API = "https://www.nomisweb.co.uk/api/v01/dataset/NM_2021_1.data.csv"
FOCO_COD, FOCO = "E09000033", "City of Westminster"
BOROUGHS = [f"E09{str(i).zfill(6)}" for i in range(1, 34)]

url = (f"{API}?date=latest&geography={','.join(BOROUGHS)}&measures=20100"
       "&select=geography_name,geography_code,c2021_restype_3_name,obs_value")
texto = C.get(url, crudo="censo2021_boroughs.csv")
filas = list(csv.DictReader(io.StringIO(texto)))

por_borough = {}
for f in filas:
    cod = f["GEOGRAPHY_CODE"]
    por_borough.setdefault(cod, {"codigo": cod, "nombre": f["GEOGRAPHY_NAME"]})
    tipo, valor = f["C2021_RESTYPE_3_NAME"], int(f["OBS_VALUE"])
    if tipo == "Total: All usual residents":
        por_borough[cod]["total"] = valor
    elif tipo == "Lives in a household":
        por_borough[cod]["en_hogar"] = valor
    elif tipo == "Lives in a communal establishment":
        por_borough[cod]["en_establecimiento_colectivo"] = valor

boroughs = sorted(por_borough.values(), key=lambda b: -b["total"])
print(f"  boroughs con dato: {len(boroughs)}")
if len(boroughs) != 33 or FOCO_COD not in por_borough:
    sys.exit(f"se esperaban 33 boroughs con las tres cifras de censo y llegaron {len(boroughs)}")

for i, b in enumerate(boroughs, 1):
    b["puesto_poblacion"] = i
foco = next(b for b in boroughs if b["codigo"] == FOCO_COD)
pct_colectivo = round(100 * foco["en_establecimiento_colectivo"] / foco["total"], 2)

fuentes = [{
    "id": "ons_censo2021",
    "nombre": "Censo 2021 · TS001, residentes habituales por autoridad local (Nomis NM_2021_1)",
    "entidad": "ONS",
    "url": "https://www.nomisweb.co.uk/census/2021",
    "resolucion": "autoridad local",
    "vigencia": "Censo 2021 (21-mar-2021)",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no: conteos agregados con control de divulgación",
    "proteccion": "abierto, agregados",
    "uso": "sección Sociedad · censo",
    "nota": ("El censo de Inglaterra y Gales es decenal: 2021 es el más reciente, no hay uno "
             "más nuevo para comparar. A diferencia de demografia.py (estimación de mitad de año, "
             "actualizada cada año), este es el único dato con el desglose hogar vs. establecimiento "
             "colectivo (residencias, cárceles, cuarteles, halls universitarios) por borough."),
}]

cifras = {
    "poblacion_censo2021_westminster": C.cifra(
        foco["total"], "residentes", "ons_censo2021", "2021-03-21",
        "Cifra censal, distinta de la estimación de mitad de año de demografia.json"),
    "en_hogar_censo2021_westminster": C.cifra(
        foco["en_hogar"], "residentes", "ons_censo2021", "2021-03-21", ""),
    "en_establecimiento_colectivo_censo2021_westminster": C.cifra(
        foco["en_establecimiento_colectivo"], "residentes", "ons_censo2021", "2021-03-21",
        f"{pct_colectivo}% del total: residencias, hoteles, cárceles, cuarteles, halls universitarios"),
    "puesto_poblacion_censo2021_westminster": C.cifra(
        foco["puesto_poblacion"], "puesto de 33", "ons_censo2021", "2021-03-21",
        "1 = el borough más poblado en el censo 2021"),
}

listas = {"boroughs": boroughs}

ruta = C.escribir(
    "censo", fuentes, cifras, listas=listas,
    territorio=FOCO,
    nota=(f"Westminster: {foco['total']:,} residentes habituales en el censo 2021, puesto "
          f"{foco['puesto_poblacion']} de 33 boroughs por población, de los cuales "
          f"{pct_colectivo}% vive en establecimientos colectivos (el más alto de Londres junto con "
          "boroughs universitarios: hoteles, residencias y cuarteles pesan más en el centro)."),
)
print(f"  Westminster: {foco['total']:,} residentes (puesto {foco['puesto_poblacion']} de 33) · {pct_colectivo}% en establecimiento colectivo")
print(f"  → {ruta}")
