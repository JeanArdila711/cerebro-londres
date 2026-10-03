#!/usr/bin/env python3
"""Ingesta · privación: English Indices of Deprivation 2025 (MHCLG), por LSOA.

Fuente: File 7 del IoD2025 (ranks, scores y deciles por LSOA), 9,4 MB para
toda Inglaterra. La API de contenido de gov.uk solo da metadatos de la
publicación; el archivo real está entre sus adjuntos (hay 17; este es el
único en CSV con el dato completo por LSOA, los demás son XLSX por dominio).

Es el equivalente a la pobreza distrital y al IDH que usa Cerebro Lima: el
indicador de privación más citado del Reino Unido. Reemplaza al IoD2019, que
el London Datastore todavía sirve con ese nombre viejo.

Rango relativo, no absoluto: decil 1 es el 10% MÁS privado de Inglaterra,
decil 10 el menos. No dice «cuánta» privación hay, dice «más que quién».
"""
import csv, io, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

CSV_URL = ("https://assets.publishing.service.gov.uk/media/691ded56d140bbbaa59a2a7d/"
           "File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv")
FOCO_COD = "E09000033"
FOCO = "Westminster"              # así nombra este archivo al borough, sin «City of»
FOCO_SALIDA = "City of Westminster"  # nombre que usa el resto del lago

C_LAD = "Local Authority District code (2024)"
C_LAD_NM = "Local Authority District name (2024)"
C_LSOA = "LSOA code (2021)"
C_LSOA_NM = "LSOA name (2021)"
C_SCORE = "Index of Multiple Deprivation (IMD) Score"
C_RANK = "Index of Multiple Deprivation (IMD) Rank (where 1 is most deprived)"
C_DECILE = "Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)"

print("  bajando File 7 (≈9,4 MB)…")
texto = C.get(CSV_URL, crudo="iod2025_file7.csv")
print(f"  {len(texto)/1e6:.1f} MB descargados")

londres, foco_filas = [], []
for fila in csv.DictReader(io.StringIO(texto)):
    if not fila[C_LAD].startswith("E09"):
        continue
    londres.append(fila)
    if fila[C_LAD] == FOCO_COD:
        foco_filas.append(fila)

print(f"  LSOA de Greater London: {len(londres)} · de Westminster: {len(foco_filas)}")
if not foco_filas:
    sys.exit(f"sin LSOA para {FOCO_COD}: no se escribe el lago")

# --- Promedio del score por borough, para comparar los 33 -------------------
por_borough = {}
for f in londres:
    nombre = f[C_LAD_NM]
    por_borough.setdefault(nombre, []).append(float(f[C_SCORE]))
ranking = sorted(
    ({"nombre": n, "score_medio": round(sum(v) / len(v), 2), "lsoa_n": len(v)} for n, v in por_borough.items()),
    key=lambda b: -b["score_medio"])  # score más alto = más privado
for i, b in enumerate(ranking, 1):
    b["puesto_privacion"] = i
foco_rank = next(b for b in ranking if b["nombre"] == FOCO)

# --- El LSOA más y menos privado dentro de Westminster ----------------------
foco_ordenado = sorted(foco_filas, key=lambda f: int(f[C_RANK]))
mas_privado, menos_privado = foco_ordenado[0], foco_ordenado[-1]
score_medio_foco = sum(float(f[C_SCORE]) for f in foco_filas) / len(foco_filas)

fuentes = [{
    "id": "imd_2025",
    "nombre": "English Indices of Deprivation 2025 · File 7 (MHCLG)",
    "entidad": "MHCLG",
    "url": "https://www.gov.uk/government/statistics/english-indices-of-deprivation-2025",
    "resolucion": "LSOA 2021",
    "vigencia": "publicado 2025-10-30",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "abierto, solo agregados",
    "uso": "sección Territorio · privación relativa por zona",
    "nota": ("Rango relativo entre LSOA de Inglaterra, no una medida absoluta. Reemplaza "
             "al IoD2019 que el London Datastore todavía enlaza con ese nombre."),
}]

cifras = {
    "lsoa_westminster_n": C.cifra(len(foco_filas), "LSOA", "imd_2025", C.hoy(),
                                   "Unidades censales de Westminster con dato de privación"),
    "score_medio_westminster": C.cifra(round(score_medio_foco, 2), "puntaje IMD", "imd_2025", C.hoy(),
                                        "Promedio simple de los LSOA de Westminster; más alto = más privado"),
    "puesto_privacion_westminster": C.cifra(foco_rank["puesto_privacion"], "puesto de 32", "imd_2025", C.hoy(),
                                             "1 = el borough en promedio más privado de los 32 con dato"),
    "lsoa_mas_privado": C.cifra(mas_privado[C_LSOA_NM], "LSOA", "imd_2025", C.hoy(),
                                 f"Rank nacional {mas_privado[C_RANK]} de ~33.000, decil {mas_privado[C_DECILE]}"),
    "lsoa_menos_privado": C.cifra(menos_privado[C_LSOA_NM], "LSOA", "imd_2025", C.hoy(),
                                   f"Rank nacional {menos_privado[C_RANK]} de ~33.000, decil {menos_privado[C_DECILE]}"),
}

listas = {
    "ranking_boroughs": ranking,
    "lsoa_westminster": [{
        "lsoa": f[C_LSOA_NM], "codigo": f[C_LSOA],
        "score": float(f[C_SCORE]), "rank_nacional": int(f[C_RANK]), "decil": int(f[C_DECILE]),
    } for f in foco_ordenado],
}

ruta = C.escribir(
    "privacion", fuentes, cifras, listas=listas,
    territorio=FOCO_SALIDA,
    nota=(f"Westminster: puesto {foco_rank['puesto_privacion']} de 32 boroughs con dato por score promedio "
          "(falta City of London, sin boroughs code E09 propio en este archivo tampoco). Un promedio "
          "esconde la dispersión interna: Westminster tiene LSOA entre el decil más privado y el menos "
          "privado del país al mismo tiempo, visible en la lista lsoa_westminster."),
)
print(f"  Westminster: puesto {foco_rank['puesto_privacion']} de {len(ranking)} por privación media")
print(f"  más privado: {mas_privado[C_LSOA_NM]} (decil {mas_privado[C_DECILE]}) · menos: {menos_privado[C_LSOA_NM]} (decil {menos_privado[C_DECILE]})")
print(f"  → {ruta}")
