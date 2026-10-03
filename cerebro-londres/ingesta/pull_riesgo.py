#!/usr/bin/env python3
"""Ingesta · riesgo: zonas de inundación que tocan Westminster (Planning Data, MHCLG).

Fuente: planning.data.gov.uk, dataset flood-risk-zone. Republica el Flood Map
for Planning de la Environment Agency, clasificado en zonas 1 (bajo), 2 y 3
(alto, el que de verdad importa para decidir dónde construir o vivir).

OJO, decisión de diseño que costó un rastreo fallido: el parámetro `bbox` de
esta API no existe — lo ignora en silencio y devuelve entidades de cualquier
parte de Inglaterra (las primeras del índice, que resultaron ser de las Islas
Scilly). La forma correcta de acotar a un territorio es `geometry_curie`, que
pide la geometría intersecte la de OTRA entidad ya conocida: aquí, la de
Westminster en el dataset local-authority-district (prefix «statistical-
geography», referencia E09000033). Confirmado con dos consultas independientes
(un punto central y el curie del borough completo): coinciden en 2 entidades.

Esto NO es el monitoreo de inundación en tiempo real (ese es otro dataset,
de la Environment Agency, candidata aparte en el catálogo): es la zona de
riesgo estructural, la que no cambia día a día.
"""
import sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

API = "https://www.planning.data.gov.uk/entity.json"
FOCO_CURIE = "statistical-geography:E09000033"
FOCO = "City of Westminster"


def consultar(dataset, **extra):
    partes = f"dataset={dataset}&geometry_curie={FOCO_CURIE}&geometry_relation=intersects&limit=100"
    for k, v in extra.items():
        partes += f"&{k}={v}"
    d = C.get_json(f"{API}?{partes}", crudo=f"planning_{dataset}.json")
    return d.get("entities", [])


zonas = consultar("flood-risk-zone")
print(f"  zonas de riesgo que tocan Westminster: {len(zonas)}")
if not zonas:
    sys.exit("sin zonas de riesgo: no se escribe el lago (revisar el curie o la API)")

por_nivel = {}
for z in zonas:
    nivel = z.get("flood-risk-level", "sin dato")
    por_nivel[nivel] = por_nivel.get(nivel, 0) + 1

nivel_max = max((z.get("flood-risk-level", "0") for z in zonas), key=lambda n: int(n) if n.isdigit() else -1)

fuentes = [{
    "id": "planning_flood",
    "nombre": "Planning Data · flood risk zones (Environment Agency Flood Map for Planning)",
    "entidad": "MHCLG",
    "url": "https://www.planning.data.gov.uk/dataset/flood-risk-zone",
    "resolucion": "polígono",
    "vigencia": "continua (entry-date por entidad)",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Territorio · analizar un punto",
    "nota": ("Clasificación estructural de riesgo de inundación, no monitoreo en vivo. "
             "El bbox de esta API no funciona: se filtra por geometry_curie contra la "
             "geometría oficial de Westminster (E09000033)."),
}]

cifras = {
    "zonas_riesgo_n": C.cifra(len(zonas), "zonas", "planning_flood", C.hoy(),
                               "Polígonos de riesgo de inundación que tocan el territorio de Westminster"),
    "nivel_maximo": C.cifra(nivel_max, "nivel (1 bajo · 2 medio · 3 alto)", "planning_flood", C.hoy(),
                             "El nivel de riesgo más alto que toca el borough"),
}

listas = {
    "zonas": [{
        "referencia": z.get("reference"),
        "nivel": z.get("flood-risk-level"),
        "tipo": z.get("flood-risk-type"),
        "punto": z.get("point"),
        "fuente_url": z.get("documentation-url", ""),
    } for z in zonas],
}

ruta = C.escribir(
    "riesgo", fuentes, cifras, listas=listas,
    territorio=FOCO,
    nota=("Por nivel: " + ", ".join(f"{k}={v}" for k, v in sorted(por_nivel.items())) +
          ". El centro administrativo de Westminster cae dentro de zona 2 y de zona 3 "
          "al mismo tiempo (dos polígonos superpuestos, no es un error del script)."),
)
print(f"  → {ruta}")
