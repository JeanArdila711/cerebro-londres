#!/usr/bin/env python3
"""Ingesta · sinhogarismo: Statutory homelessness in England, por autoridad local
(MHCLG), de las tablas detalladas trimestrales.

Hueco real del sistema (F24 del Excel): hay privación (IMD) y no hay nada de
personas sin hogar. El registro individual (H-CLIC) no es público; estas
tablas trimestrales solo traen conteos agregados por autoridad local.

Mismo patrón que finanzas.py (Council Tax) y privación.py: la página de la
publicación trimestral no trae el archivo, hay que ir a la colección «Live
tables on homelessness» y tomar el adjunto «Detailed local authority level
tables» más reciente. El archivo es .ods, con una hoja por tabla (A1..A13,
TA1..TA9…); se leen dos:
  - A1: evaluaciones iniciales y hogares con deber de prevención o alivio.
  - TA4: hogares en alojamiento temporal, incluido el desglose en B&B
    (el indicador de peor calidad: estancias en hotel, a veces con niños).
"""
import re, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

COLECCION = "https://www.gov.uk/government/statistical-data-sets/live-tables-on-homelessness"
CONTENT_API = "https://www.gov.uk/api/content/government/statistical-data-sets/live-tables-on-homelessness"
FOCO_COD, FOCO = "E09000033", "City of Westminster"


def numero(txt):
    txt = (txt or "").replace(",", "").strip()
    return int(txt) if txt.lstrip("-").isdigit() else None


print("  localizando el adjunto más reciente de tablas detalladas por LA (gov.uk Content API)…")
contenido = C.get_json(CONTENT_API, crudo="live_tables_homelessness_content.json")
cuerpo_html = contenido.get("details", {}).get("body", "")
candidatos = re.findall(
    r'href="(https://assets\.publishing\.service\.gov\.uk/media/[^"]+\.ods)"[^>]*>([^<]*)</a>', cuerpo_html)
candidatos = [(url, texto) for url, texto in candidatos if "Detailed local authority level tables" in texto]
if not candidatos:
    sys.exit("no se encontró ningún adjunto .ods de tablas detalladas por LA: revisar la colección a mano")
ODS_URL, PERIODO_TXT = candidatos[0]
PERIODO = PERIODO_TXT.split(":", 1)[1].strip() if ":" in PERIODO_TXT else PERIODO_TXT.strip()
print(f"  → {PERIODO}: {ODS_URL}")

crudo = C.get_bin(ODS_URL, crudo="homelessness_detailed_la.ods")
filas_a1 = C.leer_ods(crudo, "A1")
filas_ta4 = C.leer_ods(crudo, "TA4")


def por_borough(filas):
    salida = {}
    for f in filas:
        if f and re.fullmatch(r"E09\d{6}", f[0]):
            salida[f[0]] = f
    return salida


a1, ta4 = por_borough(filas_a1), por_borough(filas_ta4)
boroughs = []
for cod in a1:
    fa, ft = a1.get(cod), ta4.get(cod)
    if not fa or not ft:
        continue
    boroughs.append({
        "codigo": cod, "nombre": fa[1],
        "evaluaciones_iniciales": numero(fa[2]),
        "hogares_con_deber": numero(fa[3]),
        "hogares_en_ta": numero(ft[2]),
        "hogares_en_bb": numero(ft[3]),
    })

print(f"  boroughs con las dos tablas cruzadas: {len(boroughs)}")
if len(boroughs) != 33:
    sys.exit(f"se esperaban 33 boroughs de Greater London y llegaron {len(boroughs)}")

boroughs.sort(key=lambda b: -(b["hogares_en_ta"] or 0))
for i, b in enumerate(boroughs, 1):
    b["puesto_ta"] = i
foco = next(b for b in boroughs if b["codigo"] == FOCO_COD)
pct_bb = round(100 * foco["hogares_en_bb"] / foco["hogares_en_ta"], 1) if foco["hogares_en_ta"] else None

fuentes = [{
    "id": "mhclg_homelessness",
    "nombre": f"Statutory homelessness in England · Detailed local authority level tables ({PERIODO})",
    "entidad": "MHCLG",
    "url": COLECCION,
    "resolucion": "autoridad local, trimestral",
    "vigencia": PERIODO,
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no: conteos agregados por autoridad local",
    "proteccion": "agregados; el registro individual (H-CLIC) no es público",
    "uso": "sección Sociedad · sinhogarismo",
    "nota": ("El registro individual no es público: estas son las tablas detalladas trimestrales, "
             "conteos agregados por autoridad local, mismo patrón de colección de gov.uk que Council "
             "Tax y IMD. «Hogares en TA» cuenta HOGARES, no personas (un hogar puede tener varios "
             "menores). B&B es el peor alojamiento temporal: estancia de hotel, a veces con niños, "
             "normalmente de corta duración legal."),
}]

cifras = {
    "hogares_con_deber_westminster": C.cifra(
        foco["hogares_con_deber"], "hogares", "mhclg_homelessness", PERIODO,
        f"De {foco['evaluaciones_iniciales']} evaluaciones iniciales en el trimestre"),
    "hogares_en_ta_westminster": C.cifra(
        foco["hogares_en_ta"], "hogares", "mhclg_homelessness", PERIODO,
        "Hogares en alojamiento temporal al cierre del trimestre, no un acumulado"),
    "hogares_en_bb_westminster": C.cifra(
        foco["hogares_en_bb"], "hogares", "mhclg_homelessness", PERIODO,
        f"{pct_bb}% de los hogares en TA de Westminster están en B&B, el alojamiento de peor calidad"),
    "puesto_ta_westminster": C.cifra(
        foco["puesto_ta"], "puesto de 33", "mhclg_homelessness", PERIODO,
        "1 = el borough con más hogares en alojamiento temporal (cifra absoluta, no por habitante)"),
}

listas = {"boroughs": boroughs}

ruta = C.escribir(
    "sinhogarismo", fuentes, cifras, listas=listas,
    territorio=FOCO,
    nota=(f"Westminster: {foco['hogares_en_ta']} hogares en alojamiento temporal, puesto "
          f"{foco['puesto_ta']} de 33 boroughs ({PERIODO}), de los cuales {foco['hogares_en_bb']} "
          f"({pct_bb}%) en B&B. La cifra es absoluta, no por habitante: un borough grande siempre "
          "tiende a salir peor rankeado que uno chico con la misma tasa."),
)
print(f"  Westminster: {foco['hogares_en_ta']} hogares en TA (puesto {foco['puesto_ta']} de 33) · {foco['hogares_en_bb']} en B&B ({pct_bb}%)")
print(f"  → {ruta}")
