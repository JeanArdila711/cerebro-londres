"""EXPLORAR · Streamlit sobre el MISMO archivo de datos que kepler.gl y MapLibre.

    python3 -m venv .venv && .venv/bin/pip install streamlit pydeck
    python3 explorar/datos_comunes.py
    .venv/bin/streamlit run explorar/streamlit_atlas.py
"""
import json
import pathlib

import pydeck as pdk
import streamlit as st

ARCHIVO = pathlib.Path(__file__).resolve().parent / "atlas_boroughs.geojson"
VARS = {"poblacion": "Población", "densidad_hab_km2": "Densidad (hab/km²)",
        "precio_medio_gbp": "Precio medio (£)", "tasa_delitos_x1000": "Delitos por 1.000 residentes (12 meses)"}

st.set_page_config(page_title="Atlas de boroughs · Streamlit", layout="wide")
st.title("Atlas de los 33 boroughs de Londres")
gj = json.loads(ARCHIVO.read_text(encoding="utf-8"))
var = st.selectbox("Variable", list(VARS), format_func=VARS.get)

vals = [f["properties"][var] for f in gj["features"] if f["properties"][var] is not None]
lo, hi = min(vals), max(vals)
for f in gj["features"]:
    v = f["properties"][var]
    t = 0 if v is None else (v - lo) / (hi - lo)
    f["properties"]["_color"] = [200, 200, 200, 140] if v is None else [int(255 - 200 * t), int(240 - 160 * t), int(200 - 60 * t), 200]
    f["properties"]["_valor"] = "sin dato" if v is None else f"{v:,.0f}"

capa = pdk.Layer("GeoJsonLayer", gj, get_fill_color="properties._color", get_line_color=[60, 60, 60], line_width_min_pixels=1, pickable=True)
st.pydeck_chart(pdk.Deck(layers=[capa], initial_view_state=pdk.ViewState(latitude=51.5, longitude=-0.12, zoom=8.6),
                         tooltip={"text": "{nombre}\n" + VARS[var] + ": {_valor}"}))
st.caption("Datos: ONS (OGL-3.0), HM Land Registry, Policía del Reino Unido; agregados por borough. Westminster = E09000033.")
