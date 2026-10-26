#!/usr/bin/env python3
"""Ingesta · seguridad: delitos registrados en Westminster.

Fuente: data.police.uk (Home Office / police forces), sin llave.

DECISIÓN DE PRIVACIDAD, tomada en el tramo del permiso y ejecutada aquí:
la API devuelve UN REGISTRO POR DELITO con coordenadas. Aunque la propia
fuente los desplaza a puntos ancla («snap points») para que no señalen un
domicilio, al lago NO entra ningún registro individual: solo entran CONTEOS
agregados por categoría y por mes. El crudo tampoco se versiona (lago/raw
está en .gitignore).

Que un dato sea público no lo vuelve inocuo: un delito, una fecha y una calle
son tres columnas que, cruzadas, pueden señalar a una persona.
"""
import collections, datetime, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

API = "https://data.police.uk/api"
FOCO = "City of Westminster"
MESES = 12
# Polígono aproximado del borough, en el formato lat,lng:lat,lng… que pide la API.
# Se usa el poligono y no un punto+radio para no arrastrar delitos de boroughs vecinos.
POLIGONO = ("51.5340,-0.1900:51.5340,-0.1050:51.5150,-0.1050:"
            "51.4930,-0.1150:51.4880,-0.1450:51.5100,-0.1900")


def meses(n):
    hoy = datetime.date.today().replace(day=1)
    salida = []
    for i in range(1, n + 1):
        m, y = hoy.month - i, hoy.year
        while m <= 0:
            m += 12
            y -= 1
        salida.append(f"{y}-{m:02d}")
    return sorted(salida)


por_mes, por_categoria, resultados = {}, collections.Counter(), collections.Counter()
sin_dato = []

for m in meses(MESES):
    try:
        # POST: el polígono es largo y no cabe cómodo en una URL
        crimenes = C.get_json(f"{API}/crimes-street/all-crime",
                              datos=f"poly={POLIGONO}&date={m}", intentos=3)
    except RuntimeError as e:
        print(f"  ! {m}: {str(e)[:70]}", file=sys.stderr)
        sin_dato.append(m)
        continue
    if not isinstance(crimenes, list) or not crimenes:
        sin_dato.append(m)
        continue
    por_mes[m] = len(crimenes)
    for c in crimenes:
        por_categoria[c["category"]] += 1
        est = (c.get("outcome_status") or {}).get("category")
        resultados[est or "sin resultado registrado"] += 1
    print(f"  {m}  {len(crimenes):>6,} delitos")
    # `crimenes` sale de ámbito en la siguiente vuelta: los registros individuales
    # no se acumulan ni se escriben en ninguna parte.

if not por_mes:
    sys.exit("data.police.uk no devolvió ningún mes: no se escribe el lago")

puntos = sorted([m, n] for m, n in por_mes.items())
ultimo_mes, ultimo_n = puntos[-1]
total = sum(por_mes.values())

fuentes = [{
    "id": "police_uk",
    "nombre": "data.police.uk · Street-level crimes API",
    "entidad": "Home Office",
    "url": "https://data.police.uk/docs/method/crime-street/",
    "resolucion": "borough (polígono)",
    "vigencia": f"{puntos[0][0]}–{ultimo_mes}",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": ("la API devuelve registros por delito con ubicación aproximada; "
                 "al lago solo entran conteos agregados, nunca el registro individual"),
    "proteccion": "solo agregados",
    "uso": "sección Seguridad",
    "nota": ("Ubicaciones desplazadas a puntos ancla por la propia fuente. Cuenta delitos "
             "REGISTRADOS, no delitos ocurridos: los cambios pueden venir de la denuncia "
             "o del registro, no del hecho."),
}]

cifras = {
    "delitos_ultimo_mes": C.cifra(ultimo_n, "delitos registrados", "police_uk", ultimo_mes,
                                  "Delitos REGISTRADOS, no ocurridos: un cambio puede venir de la "
                                  "denuncia o del registro, no del hecho"),
    "delitos_12m": C.cifra(total, "delitos registrados", "police_uk",
                           f"{puntos[0][0]}–{ultimo_mes}", f"Suma de los {len(puntos)} meses descargados"),
    "categoria_mas_frecuente": C.cifra(
        por_categoria.most_common(1)[0][0], "categoría", "police_uk",
        f"{puntos[0][0]}–{ultimo_mes}", f"{por_categoria.most_common(1)[0][1]:,} casos"),
    "pct_sin_resultado": C.cifra(
        round(100 * resultados["sin resultado registrado"] / max(total, 1), 1), "%", "police_uk",
        f"{puntos[0][0]}–{ultimo_mes}",
        "Delitos sin resultado judicial registrado en el momento de la descarga"),
}

ruta = C.escribir(
    "seguridad", fuentes, cifras,
    series={"delitos_mensuales": C.serie(puntos, "delitos registrados", "police_uk")},
    listas={"por_categoria": por_categoria.most_common(),
            "por_resultado": resultados.most_common(12)},
    distrito_foco=FOCO,
    meses_sin_dato=sin_dato)

print(f"\n  {FOCO}: {total:,} delitos en {len(puntos)} meses · "
      f"top «{por_categoria.most_common(1)[0][0]}»")
print(f"  meses sin dato: {sin_dato or 'ninguno'} · → {ruta.relative_to(C.RAIZ)}")
