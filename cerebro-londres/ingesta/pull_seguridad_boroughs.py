#!/usr/bin/env python3
"""Ingesta · seguridad por borough: delitos de los 33 boroughs, no solo Westminster.

Fuente: MPS Recorded Crime: Geographic Breakdown (London Datastore, id exy3m).
El conjunto trae tres resoluciones (ward, borough, LSOA) y cada una con varias
copias históricas con el mismo nombre de archivo y hashes distintos en la URL:
la fecha de «last_modified» del portal no sirve para elegir la más reciente
(viene vacía o estancada en 2017). Se eligió a mano la copia cuya cabecera
llega hasta el mes más reciente (probado: 202608).

Complementa a seguridad.json (police_uk, solo Westminster, API en vivo) con
los otros 32 boroughs, para poder comparar. Se cruza por NOMBRE porque la MPS
publica por «BOCU» (unidad policial), no por código GSS — y aquí el cruce por
nombre sí es seguro: los 32 nombres de BOCU que corresponden a un borough
coinciden letra por letra con los nombres del ONS ya usados en demografia.json.

Lo que NO entra, a propósito: «Aviation Policing» (Heathrow, no es un borough)
y «Unknown» (delitos sin BOCU resuelto) se cuentan aparte, nunca se reparten
entre boroughs. City of London no aparece: tiene su propia policía (City of
London Police), no la Metropolitana — queda fuera del alcance de esta fuente,
y del alcance de cualquier comparación hecha sobre datos de la MPS.
"""
import csv, io, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

CSV_URL = "https://data.london.gov.uk/download/exy3m/pf6/MPS%20Borough%20Level%20Crime%20(most%20recent%2024%20months).csv"
FOCO = "City of Westminster"
FOCO_BOCU = "Westminster"
FUERA_DE_ALCANCE = {"Aviation Policing", "Unknown"}

texto = C.get(CSV_URL, crudo="mps_borough_crime.csv")
filas = list(csv.DictReader(io.StringIO(texto)))
meses = sorted(k for k in filas[0] if k.isdigit())
ultimos12 = meses[-12:]
print(f"  {len(filas)} filas · {len(meses)} meses ({meses[0]} a {meses[-1]}) · últimos 12: {ultimos12[0]}-{ultimos12[-1]}")

if len(meses) < 12:
    sys.exit(f"se esperaban al menos 12 meses y llegaron {len(meses)}")

# --- Totales de los últimos 12 meses, por BOCU ------------------------------
totales = {}
for f in filas:
    b = f["BOCU"]
    totales[b] = totales.get(b, 0) + sum(int(f[m] or 0) for m in ultimos12)

bocus_boroughs = {b: n for b, n in totales.items() if b not in FUERA_DE_ALCANCE}
sin_asignar = sum(n for b, n in totales.items() if b in FUERA_DE_ALCANCE)
print(f"  boroughs con delitos: {len(bocus_boroughs)} · sin asignar (aviación + desconocido): {sin_asignar}")

# --- Cruzar con población para la tasa --------------------------------------
demo = __import__("json").loads((C.LAGO / "demografia.json").read_text(encoding="utf-8"))
poblacion = {b["nombre"]: b["poblacion"] for b in demo["listas"]["boroughs"]}

faltantes = sorted(set(bocus_boroughs) - set(poblacion))
if faltantes:
    sys.exit(f"BOCU sin borough del ONS que le corresponda (revisar nombres): {faltantes}")

boroughs = []
for nombre, delitos in bocus_boroughs.items():
    pob = poblacion[nombre]
    boroughs.append({
        "nombre": nombre,
        "delitos_12m": delitos,
        "poblacion": pob,
        # OJO: tasa sobre población RESIDENTE (mid-year), no sobre quien está
        # físicamente en el borough. Westminster es el caso extremo del
        # sistema: miles de trabajadores, turistas y gente de paso a diario
        # que no cuenta en este denominador. La tasa mide delitos por
        # residente, no delitos por persona presente — se advierte en la
        # nota de la fuente, no solo aquí en el código.
        "tasa_x1000": round(delitos / pob * 1000, 2),
    })
boroughs.sort(key=lambda b: -b["tasa_x1000"])
for i, b in enumerate(boroughs, 1):
    b["puesto_tasa"] = i

foco = next(b for b in boroughs if b["nombre"] == FOCO_BOCU)
mas_alta, mas_baja = boroughs[0], boroughs[-1]

# --- Categorías, solo para el foco (igual que seguridad.json) --------------
por_categoria_foco = {}
for f in filas:
    if f["BOCU"] != FOCO_BOCU:
        continue
    g = f["Group"]
    por_categoria_foco[g] = por_categoria_foco.get(g, 0) + sum(int(f[m] or 0) for m in ultimos12)
categoria_top = max(por_categoria_foco.items(), key=lambda x: x[1])

fuentes = [{
    "id": "lds_mps_delito_borough",
    "nombre": "MPS Recorded Crime: Geographic Breakdown · nivel borough (London Datastore)",
    "entidad": "Metropolitan Police Service",
    "url": "https://data.london.gov.uk/dataset/recorded_crime_summary",
    "resolucion": "borough (BOCU), mensual",
    "vigencia": f"{ultimos12[0]} a {ultimos12[-1]}",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-2.0",
    "personas": "no",
    "proteccion": "abierto, solo agregados",
    "uso": "sección Seguridad · comparar los 33 boroughs",
    "nota": ("Cuenta delitos registrados, no víctimas. Cruzado por nombre de BOCU contra "
             "los boroughs del ONS; City of London queda fuera porque tiene su propia "
             "policía, no la Metropolitana. La tasa por 1.000 habitantes divide sobre "
             "población RESIDENTE: en boroughs con mucha población flotante (Westminster "
             "el primero, por el centro comercial y turístico) la tasa por residente "
             "sobreestima el riesgo frente a quien solo pasa por ahí."),
}]

cifras = {
    "boroughs_con_dato_n": C.cifra(len(boroughs), "boroughs", "lds_mps_delito_borough", C.hoy(),
                                    "De los 33 de Greater London; falta City of London"),
    "delitos_12m_westminster": C.cifra(foco["delitos_12m"], "delitos registrados", "lds_mps_delito_borough",
                                        ultimos12[-1], "Últimos 12 meses en Westminster"),
    "tasa_westminster": C.cifra(foco["tasa_x1000"], "delitos por 1.000 habitantes", "lds_mps_delito_borough",
                                 ultimos12[-1],
                                 "Delitos de 12 meses sobre población RESIDENTE mid-year, no sobre la "
                                 "población flotante (trabajadores, turistas, tránsito) que a diario "
                                 "multiplica varias veces la gente presente en Westminster: la tasa real "
                                 "por persona-presente es más baja que esta"),
    "puesto_tasa_westminster": C.cifra(foco["puesto_tasa"], f"puesto de {len(boroughs)}", "lds_mps_delito_borough",
                                        ultimos12[-1], "1 = la tasa más alta de los boroughs con dato"),
    "borough_tasa_mas_alta": C.cifra(mas_alta["nombre"], "borough", "lds_mps_delito_borough", ultimos12[-1],
                                      f"{mas_alta['tasa_x1000']} por 1.000 habitantes"),
    "borough_tasa_mas_baja": C.cifra(mas_baja["nombre"], "borough", "lds_mps_delito_borough", ultimos12[-1],
                                      f"{mas_baja['tasa_x1000']} por 1.000 habitantes"),
    "categoria_top_westminster": C.cifra(categoria_top[0], "categoría", "lds_mps_delito_borough", ultimos12[-1],
                                          f"{categoria_top[1]:,} casos en 12 meses"),
}

listas = {
    "boroughs": boroughs,
    "por_categoria_westminster": [{"categoria": g, "n": n} for g, n in sorted(por_categoria_foco.items(), key=lambda x: -x[1])],
}

ruta = C.escribir(
    "seguridad_boroughs", fuentes, cifras, listas=listas,
    territorio="Greater London (32 de 33 boroughs; sin City of London)",
    nota=(f"Sin asignar a ningún borough (Aviation Policing + Unknown): {sin_asignar} delitos en 12 meses, "
          "no se reparten entre boroughs. La tasa usa la población mid-year ya integrada en demografia.json: "
          "mismo año de referencia, mismo criterio para los 32."),
)
print(f"  Westminster: puesto {foco['puesto_tasa']} de {len(boroughs)} por tasa ({foco['tasa_x1000']}/1000)")
print(f"  más alta: {mas_alta['nombre']} ({mas_alta['tasa_x1000']}) · más baja: {mas_baja['nombre']} ({mas_baja['tasa_x1000']})")
print(f"  → {ruta}")
