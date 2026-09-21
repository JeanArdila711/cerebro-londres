#!/usr/bin/env python3
"""Verificación antes de publicar: con un solo FAIL no se despliega.

Replica el verificador del Cerebro Lima y lo adapta a Londres:
  · las expresiones de dato personal son británicas (móvil 07…/+44, postcode)
  · las comprobaciones de dominio son de Westminster y de Greater London
  · se exige lo que el catálogo de Lima NO exigía: `probado` y `personas`
    en cada fuente

Una verificación que nunca falla no está verificando: hay una prueba que la
rompe a propósito en verificacion/probar_verificador.sh
"""
import glob, json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fallos = 0

# Correo, móvil británico (07… o +44 7…) y postcode del Reino Unido.
# El postcode va aquí porque es un CUASI-IDENTIFICADOR: un postcode británico
# cubre unas 15 direcciones, así que cruzado con una edad y un sexo puede
# señalar a una persona. No basta con que no haya nombres.
# Correo y móvil británico (07… o +44 7…). Se buscan SIEMPRE, en todos los
# campos: no hay ningún campo donde un correo o un teléfono sean aceptables.
CONTACTO = re.compile(
    r"[\w.+-]+@[\w-]+\.[a-z]{2,}"
    r"|(?<!\d)(?:\+?44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}(?!\d)")

# El postcode va aparte porque es un CUASI-IDENTIFICADOR: uno británico cubre
# unas 15 direcciones, así que cruzado con una edad y un sexo puede señalar a
# una persona. Se busca en los campos de datos, pero no en la prosa descriptiva
# (`nota`, `nombre`, `uso`, `url`), donde citar «SW1A 1AA» como ejemplo no
# expone a nadie y solo produciría falsos positivos.
POSTCODE = re.compile(r"(?<![A-Z0-9])[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}(?![A-Z0-9])")
CAMPOS_PERSONALES = re.compile(
    r"nombre_completo|apellido|dni|nino|passport|national_insurance|telefono|"
    r"celular|mobile|phone|correo|email|postcode|direccion|address", re.I)

# Campos de prosa descriptiva, exentos SOLO de la regla de postcode.
EXENTOS_POSTCODE = {"url", "nota", "nombre", "uso"}


def check(nombre, ok, detalle=""):
    global fallos
    print(("PASS " if ok else "FAIL ") + nombre + ("" if ok else f"  <- {detalle}"))
    fallos += 0 if ok else 1


def recorre(x, clave=""):
    if isinstance(x, dict):
        for k, v in x.items():
            yield from recorre(v, k)
    elif isinstance(x, list):
        for v in x:
            yield from recorre(v, clave)
    else:
        yield clave, x


LICENCIAS = {"OGL-3.0", "ODbL-1.0", "CC0-1.0", "CC-BY-4.0", "derivado", "terminos-del-servicio"}

lagos = {}
for ruta in sorted(glob.glob(os.path.join(RAIZ, "lago", "*.json"))):
    rel = os.path.relpath(ruta, RAIZ)
    lago = json.load(open(ruta, encoding="utf-8"))
    tema = os.path.basename(ruta)[:-5]
    lagos[tema] = lago
    # El catálogo vive en el lago para salir por la misma compuerta, pero su
    # forma es otra (`datasets`, no `fuentes`): tiene sus propias comprobaciones
    # más abajo.
    if tema == "catalogo":
        continue
    fuentes = lago.get("fuentes", [])
    ids = {f.get("id") for f in fuentes}

    check(f"{rel}: probado es un día",
          bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(lago.get("probado")))), lago.get("probado"))
    check(f"{rel}: hay al menos una fuente", bool(fuentes))
    check(f"{rel}: toda fuente con url y licencia",
          all(f.get("url") and f.get("licencia") for f in fuentes),
          [f.get("id") for f in fuentes if not (f.get("url") and f.get("licencia"))])
    # Los dos campos que el catálogo de Lima no lleva y el taller pide añadir
    check(f"{rel}: toda fuente con fecha de prueba",
          all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(f.get("probado", ""))) for f in fuentes),
          [f.get("id") for f in fuentes if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(f.get("probado", "")))])
    check(f"{rel}: toda fuente declara si trae datos de personas",
          all(str(f.get("personas", "")).strip() for f in fuentes),
          [f.get("id") for f in fuentes if not str(f.get("personas", "")).strip()])
    # Lista cerrada: el enunciado avisa que Lima escribió la licencia de 34 maneras
    fuera = sorted({f.get("licencia") for f in fuentes} - LICENCIAS)
    check(f"{rel}: licencias dentro de la lista cerrada", not fuera, fuera)

    for clave, c in lago.get("cifras", {}).items():
        completa = (c.get("valor") is not None and c.get("unidad")
                    and c.get("vigencia") and c.get("fuente") in ids)
        check(f"{rel}: {clave} con valor, unidad, vigencia y fuente conocida", completa, c)

    for clave, s in lago.get("series", {}).items():
        ok = (s.get("fuente") in ids and s.get("unidad")
              and isinstance(s.get("puntos"), list) and len(s["puntos"]) > 0
              and all(isinstance(p, list) and len(p) == 2 for p in s["puntos"]))
        check(f"{rel}: serie {clave} con fuente, unidad y puntos [etiqueta, valor]", ok,
              str(s)[:120])

    pares = list(recorre(lago))
    sospechosos = sorted({k for k, _ in pares if CAMPOS_PERSONALES.search(k or "")})
    check(f"{rel}: ningún campo con nombre de dato personal", not sospechosos, sospechosos)

    contacto = next((f"{k}={v}" for k, v in pares
                     if isinstance(v, str) and CONTACTO.search(v)), None)
    check(f"{rel}: ningún texto con correo o móvil", contacto is None, contacto)

    postcode = next((f"{k}={v}" for k, v in pares
                     if isinstance(v, str) and k not in EXENTOS_POSTCODE and POSTCODE.search(v)), None)
    check(f"{rel}: ningún postcode fuera de la prosa descriptiva", postcode is None, postcode)

# --- Comprobaciones de dominio: escritas para Westminster y Greater London ---
if "demografia" in lagos:
    d = lagos["demografia"]
    pob = d["cifras"]["poblacion_westminster"]["valor"]
    check("población de Westminster en un rango sensato", 150_000 < pob < 350_000, pob)
    boroughs = d["listas"]["boroughs"]
    check("los 33 boroughs de Greater London están completos", len(boroughs) == 33, len(boroughs))
    check("todo borough tiene código GSS E09", all(b["codigo"].startswith("E09") for b in boroughs))
    suma = sum(b["poblacion"] for b in boroughs)
    total = d["cifras"]["poblacion_greater_london"]["valor"]
    check("los boroughs suman la población de Greater London", suma == total, (suma, total))
    check("Westminster está entre los boroughs",
          any(b["codigo"] == "E09000033" for b in boroughs))

if "geo" in lagos:
    g = lagos["geo"]
    check("hay wards de Westminster", g["cifras"]["wards_westminster_n"]["valor"] >= 15,
          g["cifras"]["wards_westminster_n"]["valor"])
    for nombre, capa in g.get("capas", {}).items():
        ruta = os.path.join(RAIZ, capa["archivo"])
        check(f"la capa {nombre} existe en disco", os.path.exists(ruta), capa["archivo"])
        # Una capa que no cabe en un teléfono no es una vista, es una descarga
        check(f"la capa {nombre} pesa menos de 2 MB", capa["bytes"] < 2_000_000,
              f"{capa['bytes']/1024:.0f} kB")

if "economia" in lagos:
    e = lagos["economia"]["cifras"]
    precio = e["precio_medio_westminster"]["valor"]
    check("precio medio de vivienda en un rango sensato", 300_000 < precio < 3_000_000, precio)
    if "veces_la_media_de_londres" in e:
        check("Westminster cuesta más que la media de Londres",
              e["veces_la_media_de_londres"]["valor"] > 1, e["veces_la_media_de_londres"]["valor"])

if "seguridad" in lagos:
    s = lagos["seguridad"]
    pts = s["series"]["delitos_mensuales"]["puntos"]
    check("hay al menos 6 meses de delitos", len(pts) >= 6, len(pts))
    check("ningún mes con cero delitos registrados", all(p[1] > 0 for p in pts),
          [p for p in pts if p[1] <= 0])
    suma = sum(n for _, n in s["listas"]["por_categoria"])
    check("las categorías suman el total de 12 meses", suma == s["cifras"]["delitos_12m"]["valor"],
          (suma, s["cifras"]["delitos_12m"]["valor"]))

# El catálogo es parte del lago y se verifica igual
cat = os.path.join(RAIZ, "catalogo", "catalogo.json")
if os.path.exists(cat):
    c = json.load(open(cat, encoding="utf-8"))
    ds = c.get("datasets", [])
    check("el catálogo tiene fichas", bool(ds), len(ds))
    check("toda ficha del catálogo tiene estado",
          all(f.get("estado") for f in ds))
    check("toda ficha del catálogo tiene fecha de prueba",
          all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(f.get("probado", ""))) for f in ds),
          [f.get("id") for f in ds if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(f.get("probado", "")))])
    check("toda ficha declara si trae datos de personas",
          all(str(f.get("personas", "")).strip() for f in ds),
          [f.get("id") for f in ds if not str(f.get("personas", "")).strip()])
    check("el catálogo cuenta también lo que no sirvió",
          any(f.get("estado") in ("caido", "excluido", "candidato") for f in ds),
          "un catálogo donde todo funcionó es un catálogo incompleto")

print(f"\n{fallos} fallos")
sys.exit(1 if fallos else 0)
