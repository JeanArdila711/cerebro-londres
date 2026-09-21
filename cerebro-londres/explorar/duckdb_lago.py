#!/usr/bin/env python3
"""EXPLORAR · tramo del lago: la MISMA pregunta con DuckDB en vez de JSON puro.

La réplica base guarda el lago en JSON y lo recorre con la biblioteca estándar.
Aquí se consulta exactamente el mismo archivo con SQL, para comparar sobre los
mismos datos, que es la única comparación que compara herramientas.

    .venv/bin/pip install duckdb      # 1 paquete
    .venv/bin/python explorar/duckdb_lago.py
"""
import pathlib, sys

try:
    import duckdb
except ImportError:
    sys.exit("falta duckdb · .venv/bin/pip install duckdb")

LAGO = pathlib.Path(__file__).resolve().parent.parent / "lago"
atlas = LAGO / "atlas_boroughs.json"

con = duckdb.connect()

print("1 · Los cinco boroughs más caros (SQL sobre el JSON del lago, sin cargarlo antes)")
print(con.sql(f"""
    SELECT b.nombre, b.poblacion, b.area_km2, b.densidad_hab_km2, b.precio_medio_gbp
    FROM (SELECT unnest(listas.boroughs) AS b FROM read_json_auto('{atlas}'))
    ORDER BY b.precio_medio_gbp DESC
    LIMIT 5
"""))

print("\n2 · Lo que en el script base son veinte líneas de Python: media y mediana")
print(con.sql(f"""
    SELECT round(avg(b.precio_medio_gbp)) AS media,
           round(median(b.precio_medio_gbp)) AS mediana,
           round(stddev(b.precio_medio_gbp)) AS desviacion,
           count(*) AS boroughs
    FROM (SELECT unnest(listas.boroughs) AS b FROM read_json_auto('{atlas}'))
"""))

print("\n3 · Westminster contra la mediana, en una sola consulta")
print(con.sql(f"""
    WITH t AS (SELECT unnest(listas.boroughs) AS b FROM read_json_auto('{atlas}'))
    SELECT b.nombre,
           b.precio_medio_gbp,
           (SELECT round(median(b.precio_medio_gbp)) FROM t) AS mediana_londres,
           round(b.precio_medio_gbp / (SELECT median(b.precio_medio_gbp) FROM t), 2) AS veces
    FROM t WHERE b.codigo = 'E09000033'
"""))

print("""
Para la bitácora
  · DuckDB leyó el JSON del lago SIN cambiarlo ni convertirlo: el lago sigue
    siendo el mismo archivo que sirve la compuerta.
  · Instalar duckdb trajo 1 paquete. great_expectations, en la medición del
    cuaderno, trae 117. La cadena de suministro también es un criterio.
  · Lo que no resolvió: no sustituye a la ingesta (no baja nada) ni a la
    verificación (no sabe qué debe cumplir el contrato). Es una herramienta de
    consulta, y por eso NO reemplaza al script base: lo acompaña.
""")
