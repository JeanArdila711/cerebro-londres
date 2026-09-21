#!/usr/bin/env python3
"""Ingesta · demografía: población de Westminster y de los 33 boroughs.

Fuente: ONS mid-year population estimates vía la API de Nomis (NM_31_1),
sin llave. Se cruza por CÓDIGO GSS (E09…), nunca por nombre: «Westminster»
y «City of Westminster» son la misma cosa escrita de dos maneras, y
«City of London» es un borough distinto que se parece demasiado a «London».
"""
import sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

NOMIS = "https://www.nomisweb.co.uk/api/v01/dataset/NM_31_1.data.json"
FOCO = "E09000033"          # City of Westminster
FOCO_NOMBRE = "City of Westminster"
TIPO_LA = "TYPE432"         # local authorities: district / unitary


def pedir(**q):
    partes = "&".join(f"{k}={v}" for k, v in q.items())
    return C.get_json(f"{NOMIS}?{partes}", crudo=f"nomis_{q.get('age','x')}_{q.get('date','x')}.json")


def obs_londres(d):
    """Solo los 33 boroughs de Greater London (códigos E09…)."""
    return [o for o in d.get("obs", []) if o["geography"]["geogcode"].startswith("E09")]


# --- Total por borough, último año disponible -------------------------------
d = pedir(geography=TIPO_LA, date="latest", sex=7, age=0, measures=20100)
obs = obs_londres(d)
anio = obs[0]["time"]["value"] if obs else "?"
boroughs = sorted(
    ({"codigo": o["geography"]["geogcode"],
      "nombre": o["geography"]["description"],
      "poblacion": int(o["obs_value"]["value"])} for o in obs),
    key=lambda b: -b["poblacion"])
print(f"  boroughs: {len(boroughs)} · año {anio}")
if len(boroughs) != 33:
    sys.exit(f"se esperaban 33 boroughs de Greater London y llegaron {len(boroughs)}")

foco = next(b for b in boroughs if b["codigo"] == FOCO)
puesto = [b["codigo"] for b in boroughs].index(FOCO) + 1
total_londres = sum(b["poblacion"] for b in boroughs)

# --- Serie histórica del foco ----------------------------------------------
serie_foco = pedir(geography=FOCO, date="latestMINUS30-latest", sex=7, age=0, measures=20100)
# Nomis devuelve el año con valor vacío cuando no hay estimación para esa
# geografía. Un hueco se omite; no se interpola ni se arrastra el anterior.
puntos = sorted(
    ([str(o["time"]["value"]), int(o["obs_value"]["value"])]
     for o in serie_foco.get("obs", []) if str(o["obs_value"]["value"]).strip() != ""),
    key=lambda p: p[0])

# --- Sexo, en el último año -------------------------------------------------
sexos = {}
for etiqueta, cod in (("hombres", 5), ("mujeres", 6)):
    r = pedir(geography=FOCO, date="latest", sex=cod, age=0, measures=20100)
    o = r.get("obs", [])
    if o:
        sexos[etiqueta] = int(o[0]["obs_value"]["value"])

# --- Estructura por edad (tramos quinquenales), último año ------------------
piramide = []
r = pedir(geography=FOCO, date="latest", sex=7, age="1...19", measures=20100)
for o in r.get("obs", []):
    etiqueta = o["age"]["description"]
    if etiqueta.lower().startswith("all"):
        continue
    piramide.append([etiqueta, int(o["obs_value"]["value"])])
print(f"  pirámide: {len(piramide)} tramos quinquenales")

fuentes = [{
    "id": "ons_mye_nomis",
    "nombre": "ONS · Population estimates - local authority based by five year age band (Nomis NM_31_1)",
    "entidad": "ONS",
    "url": "https://www.nomisweb.co.uk/datasets/pestsyoala",
    "resolucion": "borough",
    "vigencia": str(anio),
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Gente · atlas de los 33 boroughs",
    "nota": "Mid-year estimates. API sin llave. Se cruza por código GSS E09, no por nombre.",
}]

cifras = {
    "poblacion_westminster": C.cifra(
        foco["poblacion"], "personas", "ons_mye_nomis", str(anio),
        f"Estimación de mitad de año para {FOCO_NOMBRE} ({FOCO})"),
    "puesto_poblacion": C.cifra(
        puesto, "puesto de 33", "ons_mye_nomis", str(anio),
        "Entre los 33 boroughs de Greater London, de mayor a menor"),
    "poblacion_greater_london": C.cifra(
        total_londres, "personas", "ons_mye_nomis", str(anio),
        "Suma de los 33 boroughs"),
    "pct_de_londres": C.cifra(
        round(100 * foco["poblacion"] / total_londres, 2), "%", "ons_mye_nomis", str(anio),
        "Peso de Westminster en la población de Greater London"),
}
for clave, cod, etiqueta_cifra in (("pct_menores_16", 24, "Menores de 16 años"),
                                   ("pct_65_mas", 25, "De 65 años o más")):
    r65 = pedir(geography=FOCO, date="latest", sex=7, age=cod, measures=20100)
    o65 = [x for x in r65.get("obs", []) if str(x["obs_value"]["value"]).strip() != ""]
    if o65:
        n = int(o65[0]["obs_value"]["value"])
        cifras[clave] = C.cifra(round(100 * n / foco["poblacion"], 2), "%", "ons_mye_nomis",
                                str(anio), f"{etiqueta_cifra} sobre el total del borough")

for etiqueta, valor in sexos.items():
    cifras[f"{etiqueta}_westminster"] = C.cifra(
        valor, "personas", "ons_mye_nomis", str(anio), f"{etiqueta.capitalize()} en {FOCO_NOMBRE}")

ruta = C.escribir(
    "demografia", fuentes, cifras,
    series={"poblacion_westminster": C.serie(puntos, "personas", "ons_mye_nomis")},
    listas={"boroughs": boroughs, "piramide_quinquenal": piramide},
    ambito="Greater London · foco City of Westminster")

print(f"  {FOCO_NOMBRE}: {foco['poblacion']:,} hab ({anio}) · puesto {puesto}/33 · "
      f"{cifras['pct_de_londres']['valor']}% de Londres")
print(f"  serie: {len(puntos)} años · → {ruta.relative_to(C.RAIZ)}")
