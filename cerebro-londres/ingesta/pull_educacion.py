#!/usr/bin/env python3
"""Ingesta · educación: ausentismo persistente en escuelas, por autoridad local
(DfE · Explore Education Statistics API, dataset «Persistent absence in schools»).

Primera fuente de educación del catálogo (F29 del Excel): matrícula, asistencia
y resultados por autoridad local. De las 25 publicaciones que expone la API de
EES, se eligió «Pupil attendance in schools» por ser la única con cadencia
semanal y nivel de autoridad local ya en el primer dataset que trae.

La API no acepta códigos ONS (E09000033) en la query: usa IDs opacos propios
(p. ej. «0uyT5» para Westminster) que solo se conocen pidiendo antes el
endpoint de metadatos del dataset (/meta) y buscando el `code` E09 dentro de
sus opciones de localización. Se resuelve así en vez de hardcodear los IDs,
que no son estables entre datasets.

«Ausentismo persistente» = alumnos que faltan al 10% o más de las sesiones
lectivas posibles en lo que va del curso. Cifra acumulada semana a semana,
no una medición puntual: compararla contra la misma semana de otro borough
tiene sentido, contra otra semana del calendario no.
"""
import sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

API = "https://api.education.gov.uk/statistics/v1"
DATASET_ID = "55629501-e98b-0c75-adba-f95a0cfbb5e9"  # Persistent absence in schools
FOCO_COD, FOCO = "E09000033", "City of Westminster"

meta = C.get_json(f"{API}/data-sets/{DATASET_ID}/meta", crudo="dfe_absentismo_meta.json")

indicador = next(i["id"] for i in meta["indicators"] if i["label"] == "Persistent absence rate")
filtro_todas = next(o["id"] for o in meta["filters"][0]["options"] if o["label"] == "All schools")

las = next(l["options"] for l in meta["locations"] if l["level"]["code"] == "LA")
boroughs_id = {o["code"]: {"id": o["id"], "nombre": o["label"]} for o in las if o["code"].startswith("E09")}
reg_londres_id = next(o["id"] for l in meta["locations"] if l["level"]["code"] == "REG"
                       for o in l["options"] if o["code"] == "E12000007")
nat_inglaterra_id = next(o["id"] for l in meta["locations"] if l["level"]["code"] == "NAT"
                          for o in l["options"] if o["code"] == "E92000001")

if FOCO_COD not in boroughs_id:
    sys.exit(f"{FOCO_COD} no aparece entre las localizaciones del dataset: no se escribe el lago")

# El código de semana (p. ej. «W30») no ordena bien como texto: se parsea a (año, semana).
def orden_periodo(tp):
    return (int(tp["period"]), int(tp["code"].lstrip("W")))

ultimo = max(meta["timePeriods"], key=orden_periodo)

# Pedir LA y REG/NAT en una sola consulta con `locations: in` no sirve: el filtro por
# una ubicación REG o NAT devuelve TODAS las LA que contiene, no solo su fila agregada.
# Se separan en dos llamadas, cada una con su propio `geographicLevels`.
resp_boroughs = C.get_json_post(f"{API}/data-sets/{DATASET_ID}/query", {
    "criteria": {
        "filters": {"eq": filtro_todas},
        "geographicLevels": {"eq": "LA"},
        "locations": {"in": [{"level": "LA", "id": b["id"]} for b in boroughs_id.values()]},
        "timePeriods": {"eq": {"period": ultimo["period"], "code": ultimo["code"]}},
    },
    "indicators": [indicador],
    "page": 1, "pageSize": 200,
}, crudo="dfe_absentismo_query_boroughs.json")

resp_comparadores = C.get_json_post(f"{API}/data-sets/{DATASET_ID}/query", {
    "criteria": {
        "filters": {"eq": filtro_todas},
        "geographicLevels": {"in": ["REG", "NAT"]},
        "locations": {"in": [{"level": "REG", "id": reg_londres_id}, {"level": "NAT", "id": nat_inglaterra_id}]},
        "timePeriods": {"eq": {"period": ultimo["period"], "code": ultimo["code"]}},
    },
    "indicators": [indicador],
}, crudo="dfe_absentismo_query_comparadores.json")

resp = {"results": resp_boroughs["results"] + resp_comparadores["results"]}

por_codigo = {b["id"]: cod for cod, b in boroughs_id.items()}
nombre_de = {b["id"]: b["nombre"] for b in boroughs_id.values()}

boroughs, suprimidos = [], []
valor_londres = valor_inglaterra = None
for r in resp["results"]:
    crudo = r["values"][indicador]
    if r["geographicLevel"] == "REG":
        valor_londres = float(crudo)
        continue
    if r["geographicLevel"] == "NAT":
        valor_inglaterra = float(crudo)
        continue
    la_id = r["locations"]["LA"]
    cod, nombre = por_codigo[la_id], nombre_de[la_id]
    if crudo in ("c", "x", "z"):
        suprimidos.append({"codigo": cod, "nombre": nombre})
        continue
    boroughs.append({"codigo": cod, "nombre": nombre, "ausentismo_persistente_pct": float(crudo)})

print(f"  boroughs con dato: {len(boroughs)} · suprimidos: {len(suprimidos)} ({', '.join(s['nombre'] for s in suprimidos) or 'ninguno'})")
if not boroughs or valor_londres is None or valor_inglaterra is None:
    sys.exit("faltan comparadores de Londres o Inglaterra: no se escribe el lago")

boroughs.sort(key=lambda b: -b["ausentismo_persistente_pct"])
for i, b in enumerate(boroughs, 1):
    b["puesto"] = i
foco = next(b for b in boroughs if b["codigo"] == FOCO_COD)

vigencia = ultimo["label"]

fuentes = [{
    "id": "dfe_absentismo",
    "nombre": "Pupil attendance in schools · Persistent absence in schools (DfE, Explore Education Statistics API)",
    "entidad": "DfE",
    "url": "https://explore-education-statistics.service.gov.uk/find-statistics/pupil-attendance-in-schools",
    "resolucion": "autoridad local, semanal acumulado",
    "vigencia": vigencia,
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "agregados; celdas con cohorte chica se suprimen en origen (ej. City of London)",
    "uso": "sección Sociedad · educación",
    "nota": ("«Ausentismo persistente» = alumnos con 10% o más de sesiones perdidas en lo que va "
             "del curso, acumulado semana a semana: no es una tasa de la semana aislada, compara "
             "bien entre boroughs en la misma semana, no entre semanas distintas del calendario. "
             "Incluye primaria, secundaria y especial juntas (filtro «All schools»). City of London "
             "queda suprimido por tamaño de cohorte, no por falta de dato."),
}]

cifras = {
    "ausentismo_persistente_westminster": C.cifra(
        foco["ausentismo_persistente_pct"], "%", "dfe_absentismo", vigencia,
        "Alumnos con 10% o más de sesiones perdidas en lo que va del curso"),
    "ausentismo_persistente_londres": C.cifra(
        round(valor_londres, 2), "%", "dfe_absentismo", vigencia, "Promedio de la región de Londres"),
    "ausentismo_persistente_inglaterra": C.cifra(
        round(valor_inglaterra, 2), "%", "dfe_absentismo", vigencia, "Promedio nacional"),
    "puesto_ausentismo_westminster": C.cifra(
        foco["puesto"], f"puesto de {len(boroughs)}", "dfe_absentismo", vigencia,
        "1 = el borough con más ausentismo persistente"),
}

listas = {"boroughs": boroughs, "suprimidos": suprimidos}

ruta = C.escribir(
    "educacion", fuentes, cifras, listas=listas,
    territorio=FOCO,
    nota=(f"Westminster: {foco['ausentismo_persistente_pct']}% de ausentismo persistente, puesto "
          f"{foco['puesto']} de {len(boroughs)} boroughs con dato ({vigencia}), frente a "
          f"{valor_londres}% de Londres y {valor_inglaterra}% de Inglaterra."),
)
print(f"  Westminster: {foco['ausentismo_persistente_pct']}% · puesto {foco['puesto']} de {len(boroughs)} ({vigencia})")
print(f"  Londres: {valor_londres}% · Inglaterra: {valor_inglaterra}%")
print(f"  → {ruta}")
