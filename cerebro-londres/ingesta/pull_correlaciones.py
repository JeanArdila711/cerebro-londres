#!/usr/bin/env python3
"""Derivado · correlaciones entre métricas de los 33 boroughs.

UNA CORRELACIÓN DESCRIBE UNA ASOCIACIÓN Y NUNCA SE PUBLICA COMO EFECTO.
Esta regla está escrita aquí, en el script que las calcula, y no solo en el
texto de la vista, porque es el script el que produce los números.

Y hay una trampa aritmética que el sistema declara en vez de esconder: con m
métricas salen m(m-1)/2 pares, y si cada uno se juzga con el umbral habitual
del 5 % cabe esperar un 5 % de «significativos» por puro azar. El número
esperado por azar se calcula y se publica al lado del número de hallazgos.
"""
import json, math, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

atlas = json.loads((C.LAGO / "atlas_boroughs.json").read_text(encoding="utf-8"))
filas = atlas["listas"]["boroughs"]

METRICAS = {
    "poblacion": "Población",
    "area_km2": "Área (km²)",
    "densidad_hab_km2": "Densidad (hab/km²)",
    "precio_medio_gbp": "Precio medio de vivienda (£)",
}


def pearson(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx == 0 or sy == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)


def t_de_r(r, n):
    """Estadístico t de la correlación. Con n-2 grados de libertad."""
    if r is None or abs(r) >= 1:
        return None
    return r * math.sqrt((n - 2) / (1 - r * r))


claves = list(METRICAS)
pares = []
for i, a in enumerate(claves):
    for b in claves[i + 1:]:
        comunes = [(f[a], f[b]) for f in filas
                   if isinstance(f.get(a), (int, float)) and isinstance(f.get(b), (int, float))]
        if len(comunes) < 10:
            continue
        xs, ys = [c[0] for c in comunes], [c[1] for c in comunes]
        r = pearson(xs, ys)
        if r is None:
            continue
        t = t_de_r(r, len(comunes))
        pares.append({
            "a": a, "b": b, "etiqueta_a": METRICAS[a], "etiqueta_b": METRICAS[b],
            "r": round(r, 3), "n": len(comunes),
            "t": round(t, 2) if t is not None else None,
            # |t| > ~2.04 ≈ p < 0.05 con 31 grados de libertad
            "fuerte": abs(r) >= 0.5,
        })

pares.sort(key=lambda p: -abs(p["r"]))
m = len(claves)
n_pares = len(pares)
esperados_por_azar = round(n_pares * 0.05, 2)
fuertes = [p for p in pares if p["fuerte"]]

for p in pares:
    print(f"  r={p['r']:>6}  {p['etiqueta_a']} ↔ {p['etiqueta_b']}  (n={p['n']})")

fuentes = [{
    "id": "correlaciones_derivado",
    "nombre": "Correlaciones entre métricas de boroughs (derivado del lago)",
    "entidad": "Cerebro Londres",
    "url": "https://github.com/",
    "resolucion": "borough",
    "vigencia": atlas["probado"],
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "derivado",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Correlaciones",
    "nota": ("Pearson sobre los 33 boroughs. Describe asociación, no causa. El sistema publica "
             "cuántos pares compara y cuántos cabría esperar «significativos» por azar."),
}]

cifras = {
    "metricas_n": C.cifra(m, "métricas", "correlaciones_derivado", atlas["probado"],
                          "Columnas numéricas comparadas"),
    "pares_n": C.cifra(n_pares, "pares", "correlaciones_derivado", atlas["probado"],
                       f"Todas las combinaciones de {m} métricas tomadas de a dos"),
    "esperados_por_azar": C.cifra(
        esperados_por_azar, "pares", "correlaciones_derivado", atlas["probado"],
        "Cuántos pares cabría esperar «significativos» al 5 % aunque nada tuviera que ver "
        "con nada. Se publica al lado de los hallazgos, no en una nota al pie."),
    "asociaciones_fuertes": C.cifra(
        len(fuertes), "pares", "correlaciones_derivado", atlas["probado"],
        "Pares con |r| ≥ 0,5"),
}
if pares:
    p0 = pares[0]
    cifras["asociacion_mas_fuerte"] = C.cifra(
        p0["r"], "coeficiente r", "correlaciones_derivado", atlas["probado"],
        f"{p0['etiqueta_a']} ↔ {p0['etiqueta_b']} · asociación, no efecto")

ruta = C.escribir(
    "correlaciones", fuentes, cifras, listas={"pares": pares},
    ambito=f"{len(filas)} boroughs de Greater London",
    metodo=("Coeficiente de Pearson sobre los boroughs con dato en ambas métricas. "
            "Una correlación describe una asociación y nunca se publica como efecto causal."),
    ancla="City of Westminster")
print(f"\n  {n_pares} pares · {len(fuertes)} fuertes · ~{esperados_por_azar} esperados por azar")
print(f"  → {ruta.relative_to(C.RAIZ)}")
