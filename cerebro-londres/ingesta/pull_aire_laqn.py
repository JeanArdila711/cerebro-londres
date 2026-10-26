#!/usr/bin/env python3
"""Ingesta · aire medido: London Air Quality Network (Imperial College), por borough.

Fuente: LAQN, la red real de estaciones de monitoreo de Londres (gestionada
por Imperial College London, financiada por los boroughs). A diferencia de
sensores.json (Open-Meteo: un MODELO interpolado al centroide de Westminster,
no una medición), esto es lectura real de estaciones físicas.

El endpoint de información de sitios no trae el dato del día: se usa
Daily/MonitoringIndex, encontrado en la documentación de la API (el patrón
«GetData» que se intentó primero no existe; el endpoint de salud 500 en
varias rutas probadas). Se pide el día de AYER, no hoy: el índice diario se
calcula al cierre del día y el de hoy puede venir incompleto.

OJO, límite real: solo 21 de los 33 boroughs tienen al menos una estación
activa hoy (de 258 estaciones históricas, 185 están cerradas). No es un
error del script: la red simplemente no cubre toda la ciudad por igual.

Licencia: no se encontró el texto en el sitio pese a buscarlo en varias
páginas. Queda «sin confirmar», no se supone abierta solo porque el dato
parece público y gratuito.
"""
import datetime, json, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

FECHA = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
URL = f"https://api.erg.ic.ac.uk/AirQuality/Daily/MonitoringIndex/GroupName=London/Date={FECHA}/Json"
FOCO = "Westminster"
FOCO_SALIDA = "City of Westminster"

print(f"  pidiendo el índice diario de calidad del aire del {FECHA}…")
texto = C.get(URL, crudo="laqn_daily_index.json")
d = json.loads(texto)
autoridades = d["DailyAirQualityIndex"]["LocalAuthority"]

boroughs = []
for la in autoridades:
    sitios = la.get("Site")
    if not sitios:
        continue
    sitios = sitios if isinstance(sitios, list) else [sitios]
    # Índice numérico real de la fuente (escala DAQI, 1 a 10), no la banda de
    # texto (Low/Moderate/High/Very High) pasada a mano a un número: la banda
    # colapsaba un día de aire limpio a «todos en 1», un empate que no dice
    # nada — el mismo error que el taller marca con la exposición a tsunami
    # de Lima, en cero en las 14 zonas y aun así con una «zona más expuesta».
    # DAQI real: por ESTACIÓN se toma el MÁXIMO entre sus contaminantes (así
    # define el índice el propio DAQI — una estación con NO2 alto y PM10 bajo
    # es «alta», no el promedio de las dos). Promediar especies entre sí
    # mezclaba contaminantes no comparables y diluía el peor caso real.
    maximos_por_sitio = []
    for s in sitios:
        especies = s.get("Species")
        especies = especies if isinstance(especies, list) else ([especies] if especies else [])
        valores = [int(e["@AirQualityIndex"]) for e in especies
                   if e.get("@AirQualityIndex") and e["@AirQualityIndex"].isdigit()]
        if valores:
            maximos_por_sitio.append(max(valores))
    if not maximos_por_sitio:
        continue
    boroughs.append({
        "nombre": la["@LocalAuthorityName"],
        "estaciones_n": len(sitios),
        "lecturas_n": len(maximos_por_sitio),
        "indice_medio": round(sum(maximos_por_sitio) / len(maximos_por_sitio), 2),
        "indice_peor": max(maximos_por_sitio),
    })

print(f"  boroughs con al menos una estación activa y con dato: {len(boroughs)} de 33")
if not boroughs:
    sys.exit("sin boroughs con dato: no se escribe el lago")

boroughs.sort(key=lambda b: -b["indice_medio"])
for i, b in enumerate(boroughs, 1):
    b["puesto"] = i

foco = next((b for b in boroughs if b["nombre"] == FOCO), None)
peor, mejor = boroughs[0], boroughs[-1]

fuentes = [{
    "id": "laqn_daily",
    "nombre": "London Air Quality Network · Daily Monitoring Index",
    "entidad": "Imperial College London",
    "url": "https://www.londonair.org.uk/",
    "resolucion": "estación, agregado por borough",
    "vigencia": FECHA,
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "sin-confirmar",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Ambiente · aire medido, no modelado",
    "nota": ("Red real de estaciones, financiada por los boroughs, no un modelo. Solo "
             "21-22 boroughs tienen estación activa en un día dado: es un límite real "
             "de la red, no un fallo de esta ingesta. Licencia no confirmada."),
}]

cifras = {
    "boroughs_con_estacion_n": C.cifra(len(boroughs), "boroughs", "laqn_daily", FECHA,
                                        "De 33; el resto no tiene estación LAQN activa hoy"),
    "borough_peor_aire": C.cifra(peor["nombre"], "borough", "laqn_daily", FECHA,
                                  f"índice DAQI medio {peor['indice_medio']} (1 bajo, 10 muy alto); {peor['lecturas_n']} estaciones con dato"),
    "borough_mejor_aire": C.cifra(mejor["nombre"], "borough", "laqn_daily", FECHA,
                                   f"índice medio {mejor['indice_medio']}"),
}
if foco:
    cifras["indice_aire_westminster"] = C.cifra(foco["indice_medio"], "índice DAQI (1 bajo · 10 muy alto)",
                                                  "laqn_daily", FECHA,
                                                  f"{foco['estaciones_n']} estaciones, {foco['lecturas_n']} con dato ese día (máximo por contaminante de cada una)")
    cifras["puesto_aire_westminster"] = C.cifra(foco["puesto"], f"puesto de {len(boroughs)}", "laqn_daily", FECHA,
                                                 "1 = el peor aire de los boroughs con estación")

listas = {"boroughs": boroughs}

pocas_lecturas = [b["nombre"] for b in boroughs if b["lecturas_n"] < 2]
ruta = C.escribir(
    "aire_laqn", fuentes, cifras, listas=listas,
    territorio="Greater London (boroughs con estación activa)",
    nota=(f"Índice por estación: el máximo entre sus contaminantes, no el promedio entre ellos "
          f"(así se define el DAQI). El índice de un borough es el promedio de esos máximos entre "
          f"sus estaciones. {len(pocas_lecturas)} boroughs tienen una sola estación con dato "
          f"({', '.join(pocas_lecturas) or 'ninguno'}), así que su índice depende de un único punto "
          "de la red. No se ocultan, pero se leen con cuidado."),
)
print(f"  peor aire: {peor['nombre']} ({peor['indice_medio']}) · mejor: {mejor['nombre']} ({mejor['indice_medio']})")
if foco:
    print(f"  Westminster: índice {foco['indice_medio']}, puesto {foco['puesto']} de {len(boroughs)}")
else:
    print("  Westminster: sin estación activa este día")
print(f"  → {ruta}")
