#!/usr/bin/env python3
"""Ingesta · ambiente: clima y calidad del aire sobre Westminster.

Fuentes: Open-Meteo (clima y calidad del aire, sin llave) y TfL AirQuality
(el pronóstico cualitativo que publica la ciudad).

Un modelo no es un sensor: Open-Meteo interpola desde modelos globales. Donde
la cifra viene de un modelo, la nota lo dice, y la unidad no lo esconde.
"""
import sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

LAT, LON = 51.4975, -0.1357      # centroide aproximado de Westminster
FOCO = "City of Westminster"

clima = C.get_json(
    f"https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}"
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover"
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum"
    "&timezone=Europe/London&forecast_days=7", crudo="openmeteo_clima.json")

aire = C.get_json(
    f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={LAT}&longitude={LON}"
    "&current=pm2_5,pm10,nitrogen_dioxide,european_aqi"
    "&hourly=pm2_5&past_days=7&timezone=Europe/London", crudo="openmeteo_aire.json")

cur_c, cur_a = clima.get("current", {}), aire.get("current", {})
vig_c, vig_a = cur_c.get("time", C.hoy()), cur_a.get("time", C.hoy())

fuentes = [
    {"id": "open_meteo_clima", "nombre": "Open-Meteo · Weather Forecast API", "entidad": "Open-Meteo",
     "url": "https://open-meteo.com/en/docs", "resolucion": "punto (centroide del borough)",
     "vigencia": vig_c, "probado": C.hoy(), "estado": "vivo", "licencia": "CC-BY-4.0",
     "personas": "no", "proteccion": "abierto", "uso": "sección Ambiente",
     "nota": "Modelo meteorológico interpolado al punto, no una estación física."},
    {"id": "open_meteo_aire", "nombre": "Open-Meteo · Air Quality API (CAMS)", "entidad": "Open-Meteo",
     "url": "https://open-meteo.com/en/docs/air-quality-api", "resolucion": "punto (centroide del borough)",
     "vigencia": vig_a, "probado": C.hoy(), "estado": "vivo", "licencia": "CC-BY-4.0",
     "personas": "no", "proteccion": "abierto", "uso": "sección Ambiente",
     "nota": "Valores de modelo (CAMS), no lecturas de la red de monitoreo londinense."},
]

cifras = {}
for clave, campo, unidad, texto in (
        ("temperatura_actual", "temperature_2m", "°C", "Temperatura a 2 m"),
        ("humedad_actual", "relative_humidity_2m", "%", "Humedad relativa"),
        ("viento_actual", "wind_speed_10m", "km/h", "Viento a 10 m"),
        ("nubosidad_actual", "cloud_cover", "%", "Cobertura de nubes")):
    if cur_c.get(campo) is not None:
        cifras[clave] = C.cifra(cur_c[campo], unidad, "open_meteo_clima", vig_c, texto)

for clave, campo, unidad, texto in (
        ("pm25_actual", "pm2_5", "µg/m³", "PM2.5 (modelo CAMS)"),
        ("pm10_actual", "pm10", "µg/m³", "PM10 (modelo CAMS)"),
        ("no2_actual", "nitrogen_dioxide", "µg/m³", "Dióxido de nitrógeno (modelo CAMS)"),
        ("aqi_europeo", "european_aqi", "índice", "Índice europeo de calidad del aire")):
    if cur_a.get(campo) is not None:
        cifras[clave] = C.cifra(cur_a[campo], unidad, "open_meteo_aire", vig_a, texto)

series = {}
d = clima.get("daily", {})
if d.get("time"):
    series["pronostico_max"] = C.serie([[t, v] for t, v in zip(d["time"], d["temperature_2m_max"])],
                                       "°C", "open_meteo_clima")
    series["pronostico_min"] = C.serie([[t, v] for t, v in zip(d["time"], d["temperature_2m_min"])],
                                       "°C", "open_meteo_clima")
    series["pronostico_lluvia"] = C.serie([[t, v] for t, v in zip(d["time"], d["precipitation_sum"])],
                                          "mm", "open_meteo_clima")
h = aire.get("hourly", {})
if h.get("time"):
    # una media diaria: 168 puntos horarios no se leen en una gráfica
    por_dia = {}
    for t, v in zip(h["time"], h["pm2_5"]):
        if v is not None:
            por_dia.setdefault(t[:10], []).append(v)
    series["pm25_diario"] = C.serie(
        [[dia, round(sum(v) / len(v), 1)] for dia, v in sorted(por_dia.items())],
        "µg/m³", "open_meteo_aire")

# TfL: pronóstico cualitativo de la ciudad. Si no responde, se anota y se sigue.
salvedades = []
try:
    tfl = C.get_json("https://api.tfl.gov.uk/AirQuality", intentos=2, crudo="tfl_aire.json")
    fc = (tfl.get("currentForecast") or [{}])[0]
    if fc.get("forecastBand"):
        fuentes.append({
            "id": "tfl_airquality", "nombre": "TfL · AirQuality API", "entidad": "TfL",
            "url": "https://api-portal.tfl.gov.uk/api-details#api=AirQuality", "resolucion": "Greater London",
            "vigencia": (fc.get("fromDate") or C.hoy())[:10], "probado": C.hoy(),
            "estado": "vivo", "licencia": "terminos-del-servicio", "personas": "no",
            "proteccion": "abierto", "uso": "sección Ambiente",
            "nota": "Powered by TfL Open Data. Pronóstico cualitativo para toda la ciudad."})
        cifras["banda_aire_londres"] = C.cifra(
            fc["forecastBand"], "banda", "tfl_airquality", (fc.get("fromDate") or C.hoy())[:10],
            fc.get("forecastSummary", "Pronóstico de TfL para Greater London"))
except RuntimeError as e:
    salvedades.append(f"TfL AirQuality no respondió: {str(e)[:80]}")
    print(f"  ! TfL AirQuality no respondió", file=sys.stderr)

ruta = C.escribir("sensores", fuentes, cifras, series, territorio=FOCO, salvedades=salvedades)
print(f"  {FOCO}: {cifras.get('temperatura_actual',{}).get('valor','?')} °C · "
      f"PM2.5 {cifras.get('pm25_actual',{}).get('valor','?')} µg/m³ · "
      f"AQI {cifras.get('aqi_europeo',{}).get('valor','?')}")
print(f"  → {ruta.relative_to(C.RAIZ)} · {len(cifras)} cifras · {len(series)} series")
