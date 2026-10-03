#!/usr/bin/env python3
"""Ingesta · patrimonio: edificios protegidos de Westminster (Planning Data, MHCLG).

Fuente: planning.data.gov.uk, dataset listed-building, que republica el
listado de Historic England. Tres grados, de menor a mayor importancia:
II, II* y I. Es el equivalente al patrimonio y las huacas que usa Cerebro Lima.

Mismo mecanismo que riesgo.py: se acota por geometry_curie contra la geometría
oficial de Westminster (E09000033), porque el bbox de esta API no existe.
A diferencia de riesgo (2 entidades), aquí hay miles: se pagina con offset
hasta agotar el total que la API misma declara en `count`.

El lago guarda el conteo por grado completo, y como lista solo los de grado I
(los más significativos, ~200): guardar los 4.000+ haría un archivo de varios
MB para un dato que en pantalla se usa como punto en el mapa, no como tabla.
"""
import sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

API = "https://www.planning.data.gov.uk/entity.json"
FOCO_CURIE = "statistical-geography:E09000033"
FOCO = "City of Westminster"


def paginar(dataset):
    salida, offset = [], 0
    while True:
        url = (f"{API}?dataset={dataset}&geometry_curie={FOCO_CURIE}"
               f"&geometry_relation=intersects&limit=100&offset={offset}")
        d = C.get_json(url, crudo=f"planning_{dataset}_{offset}.json")
        ents = d.get("entities", [])
        if not ents:
            break
        salida.extend(ents)
        offset += 100
        if offset > d.get("count", offset):
            break
    return salida


edificios = paginar("listed-building")
print(f"  edificios protegidos en Westminster: {len(edificios)}")
if not edificios:
    sys.exit("sin edificios protegidos: no se escribe el lago")

por_grado = {}
for e in edificios:
    g = e.get("listed-building-grade") or "sin grado"
    por_grado[g] = por_grado.get(g, 0) + 1

grado_i = [e for e in edificios if e.get("listed-building-grade") == "I"]

fuentes = [{
    "id": "planning_listed",
    "nombre": "Planning Data · listed buildings (Historic England)",
    "entidad": "MHCLG",
    "url": "https://www.planning.data.gov.uk/dataset/listed-building",
    "resolucion": "punto",
    "vigencia": "continua (entry-date por entidad)",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Territorio · analizar un punto",
    "nota": ("Republica el listado de Historic England. Grados II, II* y I, de menor "
             "a mayor importancia. Mismo filtro por geometry_curie que riesgo.py: el "
             "bbox de esta API no funciona."),
}]

cifras = {
    "edificios_protegidos_n": C.cifra(
        len(edificios), "edificios", "planning_listed", C.hoy(),
        "Total de edificios con alguna protección patrimonial en Westminster"),
    "grado_i_n": C.cifra(
        por_grado.get("I", 0), "edificios", "planning_listed", C.hoy(),
        "Grado I: el de mayor importancia histórica o arquitectónica"),
    "grado_ii_estrella_n": C.cifra(
        por_grado.get("II*", 0), "edificios", "planning_listed", C.hoy(), "Grado II*"),
    "grado_ii_n": C.cifra(
        por_grado.get("II", 0), "edificios", "planning_listed", C.hoy(), "Grado II, el más común"),
}

listas = {
    "por_grado": [{"grado": g, "n": n} for g, n in sorted(por_grado.items())],
    "grado_i": [{
        "nombre": e.get("name") or "(sin nombre)",
        "referencia": e.get("reference"),
        "punto": e.get("point"),
        "documentacion": e.get("documentation-url", ""),
    } for e in grado_i],
}

ruta = C.escribir(
    "patrimonio", fuentes, cifras, listas=listas,
    territorio=FOCO,
    nota=(f"Se guardan los {len(grado_i)} de grado I con nombre y punto; los de grado II y "
          "II* solo se cuentan, para que el archivo no pese varios MB por un dato que en "
          "pantalla es un punto en el mapa."),
)
print(f"  grado I: {len(grado_i)} · II*: {por_grado.get('II*',0)} · II: {por_grado.get('II',0)}")
print(f"  → {ruta}")
