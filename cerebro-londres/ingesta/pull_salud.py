#!/usr/bin/env python3
"""Ingesta · salud: esperanza de vida al nacer por borough (OHID Fingertips).

Fuente: Fingertips (antes Public Health England), indicador 90366 «Life
expectancy at birth», por autoridad local, desagregado por sexo. Primera
fuente de salud del lago: hasta ahora no había ninguna.

El endpoint de metadatos por grupo (api/indicator_metadata/by_group_id)
responde 500 en este perfil; se encontró el indicador probando el volcado
masivo del grupo «Life expectancy and causes of death» (perfil 26, Local
Authority Health Profiles) y leyendo su propia cabecera.

Se usa el periodo «2023 - 25»: Fingertips agrupa tres años para suavizar el
ruido estadístico normal en áreas pequeñas (un solo año puede moverse por
pocas decenas de muertes). El dato de un único año (2025) también existe,
pero es menos estable.

El volcado completo del indicador para toda Inglaterra pesa ~27 MB; se baja
una vez y se filtra a los 33 boroughs de Londres.
"""
import csv, io, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

CSV_URL = ("https://fingertips.phe.org.uk/api/all_data/csv/by_indicator_id"
           "?indicator_ids=90366&child_area_type_id=501&parent_area_type_id=15")
FOCO_COD = "E09000033"
FOCO = "Westminster"                 # así nombra Fingertips al borough, sin «City of»
FOCO_SALIDA = "City of Westminster"  # nombre que usa el resto del lago
PERIODO = "2023 - 25"

print("  bajando esperanza de vida, toda Inglaterra (≈27 MB)…")
texto = C.get(CSV_URL, crudo="fingertips_90366.csv")
print(f"  {len(texto)/1e6:.1f} MB descargados")

filas = [f for f in csv.DictReader(io.StringIO(texto))
         if f["Area Code"].startswith("E09") and f["Time period"] == PERIODO]
print(f"  filas de Londres en el periodo {PERIODO}: {len(filas)}")
if not filas:
    sys.exit(f"sin datos para el periodo {PERIODO}: no se escribe el lago")

por_borough, suprimidos = {}, []
for f in filas:
    if not f["Value"]:
        # City of London: muestra demasiado pequeña para calcular una tasa fiable
        # (lo dice la propia fuente en «Value note»), no un fallo del script.
        suprimidos.append((f["Area Name"], f["Sex"], f.get("Value note", "")))
        continue
    por_borough.setdefault(f["Area Name"], {})[f["Sex"]] = float(f["Value"])
if suprimidos:
    print(f"  sin valor publicado (muestra chica): {suprimidos}")

faltantes = [b for b, s in por_borough.items() if "Male" not in s or "Female" not in s]
if faltantes:
    sys.exit(f"boroughs sin los dos sexos: {faltantes}")

boroughs = []
for nombre, sexos in por_borough.items():
    media = round((sexos["Male"] + sexos["Female"]) / 2, 1)
    boroughs.append({"nombre": nombre, "hombres": sexos["Male"], "mujeres": sexos["Female"],
                      "promedio": media, "brecha_mujer_hombre": round(sexos["Female"] - sexos["Male"], 1)})
boroughs.sort(key=lambda b: -b["promedio"])
for i, b in enumerate(boroughs, 1):
    b["puesto"] = i

foco = next(b for b in boroughs if b["nombre"] == FOCO)
mas_alta, mas_baja = boroughs[0], boroughs[-1]

fuentes = [{
    "id": "fingertips_vida",
    "nombre": "OHID Fingertips · Life expectancy at birth (indicador 90366)",
    "entidad": "OHID",
    "url": "https://fingertips.phe.org.uk/profile/health-profiles",
    "resolucion": "autoridad local, por sexo",
    "vigencia": PERIODO,
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "abierto, solo agregados",
    "uso": "sección Salud · esperanza de vida por borough",
    "nota": ("Primera fuente de salud del lago. Periodo trienal (2023-25) para suavizar "
             "ruido estadístico en áreas pequeñas. El endpoint de metadatos del perfil "
             "responde 500; el indicador se encontró leyendo la cabecera del volcado "
             "masivo del grupo «Life expectancy and causes of death»."),
}]

cifras = {
    "esperanza_vida_westminster": C.cifra(foco["promedio"], "años", "fingertips_vida", PERIODO,
                                           "Promedio simple de hombres y mujeres"),
    "esperanza_vida_hombres_westminster": C.cifra(foco["hombres"], "años", "fingertips_vida", PERIODO, ""),
    "esperanza_vida_mujeres_westminster": C.cifra(foco["mujeres"], "años", "fingertips_vida", PERIODO, ""),
    "brecha_mujer_hombre_westminster": C.cifra(foco["brecha_mujer_hombre"], "años", "fingertips_vida", PERIODO,
                                                "Cuántos años más vive una mujer que un hombre, en promedio"),
    "puesto_esperanza_vida_westminster": C.cifra(foco["puesto"], "puesto de 33", "fingertips_vida", PERIODO,
                                                  "1 = la esperanza de vida promedio más alta de los 33 boroughs"),
    "borough_mas_esperanza_vida": C.cifra(mas_alta["nombre"], "borough", "fingertips_vida", PERIODO,
                                           f"{mas_alta['promedio']} años en promedio"),
    "borough_menos_esperanza_vida": C.cifra(mas_baja["nombre"], "borough", "fingertips_vida", PERIODO,
                                             f"{mas_baja['promedio']} años en promedio"),
}

listas = {"boroughs": boroughs}

ruta = C.escribir(
    "salud", fuentes, cifras, listas=listas,
    territorio=FOCO_SALIDA,
    nota=(f"Diferencia entre el borough de mayor y menor esperanza de vida: "
          f"{round(mas_alta['promedio'] - mas_baja['promedio'], 1)} años, dentro de la misma ciudad. "
          "City of London queda fuera: la propia fuente no publica el dato porque su población "
          "residente es demasiado pequeña para una tasa fiable (no es un fallo del script)."),
)
print(f"  Westminster: {foco['promedio']} años, puesto {foco['puesto']} de {len(boroughs)}")
print(f"  más alta: {mas_alta['nombre']} ({mas_alta['promedio']}) · más baja: {mas_baja['nombre']} ({mas_baja['promedio']})")
print(f"  → {ruta}")
