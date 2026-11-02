#!/usr/bin/env python3
"""EXPLORAR · los MISMOS datos para todas las herramientas de visualización.

Une, por borough, la tabla del atlas (F05/F02/F07) con la tasa de delitos de F17 sobre el
polígono oficial de ONS (F07). Escribe un solo archivo, `explorar/atlas_boroughs.geojson`, que
leen kepler.gl, Streamlit y se compara con lo que dibuja MapLibre en la web.
Solo conteos y tasas agregadas por borough: ningún dato personal.

    python3 explorar/datos_comunes.py
"""
import json
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
atlas = {b["codigo"]: b for b in json.load((RAIZ / "lago/atlas_boroughs.json").open())["listas"]["boroughs"]}
seg = {b["nombre"]: b for b in json.load((RAIZ / "lago/seguridad_boroughs.json").open())["listas"]["boroughs"]}
geo = json.load((RAIZ / "territorio/boroughs.geojson").open())

feats = []
for f in geo["features"]:
    cod = f["properties"]["codigo"]
    a = atlas[cod]  # KeyError si falta un borough: mejor romper que publicar a medias
    s = seg.get(a["nombre"], {})  # City of London no tiene tasa en F17
    feats.append({"type": "Feature", "geometry": f["geometry"], "properties": {
        "codigo": cod, "nombre": a["nombre"], "poblacion": a["poblacion"],
        "densidad_hab_km2": a["densidad_hab_km2"], "precio_medio_gbp": a["precio_medio_gbp"],
        "tasa_delitos_x1000": s.get("tasa_x1000"), "foco": f["properties"]["foco"]}})

assert len(feats) == 33
salida = RAIZ / "explorar" / "atlas_boroughs.geojson"
salida.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False), encoding="utf-8")
print(f"{len(feats)} boroughs · {sum(f['properties']['tasa_delitos_x1000'] is not None for f in feats)} con tasa · {salida.stat().st_size // 1024} KB")
