#!/usr/bin/env python3
"""Cruza el Excel del diccionario con el lago: que digan lo mismo.

El enunciado de la entrega 2 pide un Excel con «solo lo que de verdad está en el lago,
con la fecha real de prueba y la licencia copiada tal como aparece en la fuente».
Este script lo comprueba en vez de confiar en que alguien lo revisó a ojo:

  1. las fuentes del Excel son exactamente las integradas del lago (ni una más, ni una menos)
  2. la fecha de prueba de cada fila es la `probado` de su ficha en el lago
  3. la licencia de cada fila es una frase (no un código) y es coherente con el código del lago
  4. «¿Trae datos de personas?» coincide con lo que declara el lago
  5. cada campo del diccionario existe en el archivo del lago que dice, y cada campo del lago
     (cifras, series y listas) tiene su fila en el diccionario
  6. el Excel no conserva filas de ejemplo (Medellín) ni IDs repetidos en «1. Fuentes»
  7. cada ID Fxx que cita la Bitácora IA existe (en el lago o, si no entró, en el catálogo)
  8. el diccionario no repite campos y cada cifra dice lo mismo que el lago (ficha, tipo, unidad, ejemplo)
  9. ninguna celda con fórmula espuria fuera del Resumen; las listas desplegables cubren todas las filas
  10. el semáforo del lago (origen, personas y acceso) coincide con el Excel

Es lo único del repositorio que necesita una dependencia (openpyxl, para leer el .xlsx).
Uso: python3 verificacion/cruzar_excel.py [ruta/al/Diccionario.xlsx]
"""
import fnmatch
import glob
import json
import os
import re
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("falta openpyxl: pip install openpyxl")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# El Excel que se entrega vive en la raíz del repositorio, un nivel arriba del código
X = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(RAIZ), "Diccionario_de_datos_TallerDatos.xlsx")
if not os.path.exists(X):
    sys.exit(f"no existe {X}")

fallos = 0


def check(nombre, ok, detalle=""):
    global fallos
    print(("PASS " if ok else "FAIL ") + nombre + ("" if ok else f"  → {detalle}"))
    fallos += 0 if ok else 1


# --- el lago: las fuentes integradas con ID del taller (las derivadas no están en el Excel)
lago, fuentes = {}, {}
for ruta in sorted(glob.glob(os.path.join(RAIZ, "lago", "*.json"))):
    d = json.load(open(ruta, encoding="utf-8"))
    nombre = os.path.basename(ruta)
    lago[nombre] = d
    for f in d.get("fuentes", []):
        if re.fullmatch(r"F\d{2}", str(f.get("ficha", ""))) and f.get("estado") != "caido":
            fuentes[f["ficha"]] = f

wb = openpyxl.load_workbook(X, data_only=False)
ws = wb["1. Fuentes"]
filas = {}
ids_vistos = []
for r in range(4, ws.max_row + 1):
    i = ws.cell(r, 1).value
    if i and re.fullmatch(r"F\d{2}", str(i)):
        filas[i] = [ws.cell(r, c).value for c in range(1, 17)]
        ids_vistos.append(i)

check("1. las fuentes del Excel son exactamente las integradas del lago", set(filas) == set(fuentes),
      {"solo en el Excel": sorted(set(filas) - set(fuentes)), "solo en el lago": sorted(set(fuentes) - set(filas))})
check("1. todas las filas del Excel dicen «Integrada al lago»",
      all(f[13] == "Integrada al lago" for f in filas.values()), [i for i, f in filas.items() if f[13] != "Integrada al lago"])

check("2. la fecha de prueba de cada fila es la `probado` del lago",
      all(str(filas[i][12]) == fuentes[i]["probado"] for i in filas if i in fuentes),
      {i: (filas[i][12], fuentes[i]["probado"]) for i in filas if i in fuentes and str(filas[i][12]) != fuentes[i]["probado"]})

# Código del lago -> lo que debe aparecer en la frase copiada de la fuente
ESPERA = {
    # la ficha del conjunto puede no traer la versión (F28: «Open Government Licence (OGL)»); lo que no vale es otra versión
    "OGL-3.0": r"^(?!.*(v|version)\s*[12]\b).*open government licen[cs]e",
    "OGL-2.0": r"open government licen[cs]e.*(v|version)\s*2|ogl.*2",
    "ODbL-1.0": r"odbl|open database",
    "CC0-1.0": r"cc0|public domain|creative commons.*(zero|0)",
    "CC-BY-4.0": r"cc.?by|attribution",
}
incoherentes, vacias = [], []
for i, f in filas.items():
    lit = str(f[7] or "")
    if not lit.strip():
        vacias.append(i)
        continue
    code = fuentes[i]["licencia"] if i in fuentes else None
    if code in ESPERA and not re.search(ESPERA[code], lit, re.I | re.S):
        incoherentes.append((i, code, lit[:70]))
    if code == "sin-confirmar" and "no declara" not in lit.lower():
        incoherentes.append((i, code, lit[:70]))
check("3. ninguna fila sin licencia", not vacias, vacias)
check("3. la licencia del Excel es coherente con el código del lago", not incoherentes, incoherentes)
check("3. ninguna fuente integrada quedó «sin confirmar» sin decirlo",
      all(f["licencia"] != "sin-confirmar" or "no declara" in str(filas[i][7]).lower() for i, f in fuentes.items() if i in filas),
      [i for i, f in fuentes.items() if f["licencia"] == "sin-confirmar"])

# Personas: el lago lo declara en texto libre; el Excel usa una lista cerrada
def categoria(t):
    t = str(t).lower()
    if t.startswith("no") and "conteo" not in t and "agregad" not in t and "cifras" not in t and "estimac" not in t and "votos" not in t:
        return "No"
    return "agregado"

dif = []
for i, f in filas.items():
    if i not in fuentes:
        continue
    xl, lg = str(f[8]), str(fuentes[i]["personas"])
    if xl == "Personas identificables":
        ok = "registro" in lg.lower() or "sí" in lg.lower()  # F04: la API trae un registro por delito
    elif xl == "Solo conteos por zona":
        ok = categoria(lg) == "agregado" or "agregad" in lg.lower() or "conteos" in lg.lower()
    else:
        ok = lg.strip().lower() in ("no",) or lg.lower().startswith("no")
    if not ok:
        dif.append((i, xl, lg[:60]))
check("4. «¿Trae datos de personas?» del Excel coincide con el lago", not dif, dif)

# Lo aproximado (PROXY) se dice también en el Excel, no solo en la pantalla
sin_proxy = [i for i, f in fuentes.items() if f.get("aproximado") and i in filas and "(PROXY)" not in str(filas[i][15])]
check("6. toda fuente aproximada del lago dice «(PROXY)» en las observaciones del Excel", not sin_proxy, sin_proxy)

# El diccionario: cada campo existe en su archivo del lago, y cada campo del lago tiene su fila
wd = wb["2. Diccionario"]
huecos, documentados, ids_dic = [], set(), set()
for r in range(4, wd.max_row + 1):
    i, arch, campo = (wd.cell(r, c).value for c in (1, 2, 3))
    if not i:
        continue
    ids_dic.add(i)
    nombre = os.path.basename(str(arch))
    d = lago.get(nombre)
    if d is None:
        huecos.append((i, arch, campo, "no existe ese archivo en lago/"))
        continue
    existentes = set(d.get("cifras", {})) | set(d.get("series", {})) | set(d.get("listas", {}))
    for c in str(campo).split(" / "):   # una fila puede describir dos campos hermanos: «a / b»
        coincide = [e for e in existentes if e == c or fnmatch.fnmatch(e, c)]   # «wiki_*» = una familia de series
        if not coincide:
            huecos.append((i, nombre, c, "no está en cifras, series ni listas"))
        documentados.update((nombre, e) for e in coincide)
check("5. cada campo del diccionario existe en su archivo del lago", not huecos, huecos)
sin_fila = sorted((n, k) for n, d in lago.items() if d.get("tema") != "catalogo"
                  for k in set(d.get("cifras", {})) | set(d.get("series", {})) | set(d.get("listas", {}))
                  if (n, k) not in documentados)
check("5. cada cifra, serie y lista del lago tiene su fila en el diccionario", not sin_fila, sin_fila[:8])
check("5. toda fuente del Excel tiene al menos un campo en el diccionario", set(filas) <= ids_dic, sorted(set(filas) - ids_dic))

# Filas de ejemplo de la plantilla (Medellín) o IDs repetidos: el Excel debe tener solo lo que está en el lago
ejemplos = [(ws_.title, c.coordinate) for ws_ in wb.worksheets if ws_.title != "Instrucciones"
            for row in ws_.iter_rows() for c in row if isinstance(c.value, str) and "medell" in c.value.lower()
            and not (ws_.title == "1. Fuentes" and c.column_letter == "O")]   # «Cómo la encontraron» sí puede citar el ejemplo
check("6. ninguna fila de ejemplo de la plantilla (Medellín)", not ejemplos, ejemplos[:5])
check("6. «1. Fuentes» no repite ningún ID", len(ids_vistos) == len(set(ids_vistos)),
      sorted({i for i in ids_vistos if ids_vistos.count(i) > 1}))

# Cada fila del diccionario dice lo mismo que la cifra del lago: ficha, tipo, unidad y ejemplo
def tipo_lago(v):
    return "Entero" if isinstance(v, int) and not isinstance(v, bool) else "Decimal" if isinstance(v, float) else "Texto"


vistos, repetidos, difieren, sin_sensible = set(), [], [], []
for r in range(4, wd.max_row + 1):
    i, arch, campo = (wd.cell(r, c).value for c in (1, 2, 3))
    if not i:
        continue
    if (arch, campo) in vistos:
        repetidos.append((arch, campo))
    vistos.add((arch, campo))
    d = lago.get(os.path.basename(str(arch)), {})
    if str(campo).startswith("lsoa") and not str(campo).endswith("_n") and wd.cell(r, 11).value != "Sensible":   # el conteo no identifica nada
        sin_sensible.append((arch, campo))
    c = d.get("cifras", {}).get(campo)
    if not c:
        continue
    ficha = next((f["ficha"] for f in d["fuentes"] if f["id"] == c["fuente"]), None)
    esperado = (ficha, tipo_lago(c["valor"]), c["unidad"], str(c["valor"]))
    real = (i, wd.cell(r, 6).value, wd.cell(r, 7).value, str(wd.cell(r, 8).value))
    if real[1] == "Código" and esperado[1] == "Texto":
        real = (real[0], "Texto", real[2], real[3])
    if real != esperado:
        difieren.append((campo, real, esperado))
check("8. ningún campo repetido en el diccionario", not repetidos, repetidos)
check("8. las cifras del diccionario dicen lo mismo que el lago (ficha, tipo, unidad y ejemplo)", not difieren, difieren[:3])
check("8. los campos lsoa_* están clasificados «Sensible»", not sin_sensible, sin_sensible)

# Una celda de texto que empieza por «=» se guarda como fórmula y Excel la rompe (#NAME?)
formulas = [(h.title, c.coordinate) for h in wb.worksheets if h.title != "Resumen"
            for row in h.iter_rows() for c in row if c.data_type == "f"]
check("9. ninguna celda con fórmula fuera del Resumen", not formulas, formulas)

# Las listas desplegables y las fórmulas del Resumen llegan hasta el final de los datos
cortas = [(h.title, str(dv.sqref)) for h in wb.worksheets if h.title in ("1. Fuentes", "2. Diccionario", "3. Bitácora IA")
          for dv in h.data_validations.dataValidation
          if max(rg.max_row for rg in dv.sqref.ranges) < max(r for r in range(4, h.max_row + 1) if h.cell(r, 1).value)]
check("9. las listas desplegables cubren todas las filas con datos", not cortas, cortas)

# El semáforo del lago dice lo mismo que el Excel (quién publica y si trae personas)
ORIGEN = {"Entidad pública": "estado", "Academia u ONG": "academia", "Plataforma colaborativa": "colab", "No se sabe": "sin-confirmar"}
ACCESO = {"API sin llave": "api", "Descarga directa": "api", "API con llave gratuita": "llave", "Solo PDF o página": "pdf", "Bloquea scripts o pide sesión": "bloquea"}
PERSONAS = {"No": "no", "Solo conteos por zona": "agregado", "Personas identificables": "identificable", "Texto libre sin revisar": "libre"}
dif_sem = [(i, filas[i][3], filas[i][6], filas[i][8], fuentes[i].get("semaforo")) for i in filas if i in fuentes
           and ((fuentes[i].get("semaforo") or {}).get("origen") != ORIGEN.get(filas[i][3])
                or (fuentes[i].get("semaforo") or {}).get("personas") != PERSONAS.get(filas[i][8])
                or (fuentes[i].get("semaforo") or {}).get("acceso") != ACCESO.get(filas[i][6]))]
check("10. el semáforo del lago (origen, personas y acceso) coincide con el Excel", not dif_sem, dif_sem)

# Los IDs de la Bitácora IA existen: en el lago, o en el catálogo si la fuente se rastreó y no entró
cat = json.load(open(os.path.join(RAIZ, "catalogo", "catalogo.json"), encoding="utf-8"))
conocidos = set(filas) | {d["ficha"] for d in cat["datasets"] if d.get("ficha")} | {f["ficha"] for f in fuentes.values()}
wbit = wb["3. Bitácora IA"]
huerfanos = sorted({i for r in range(4, wbit.max_row + 1) for i in re.findall(r"\bF\d{2}\b", str(wbit.cell(r, 7).value or "")) if i not in conocidos})
check("7. cada ID Fxx de la Bitácora IA existe en el lago o en el catálogo", not huerfanos, huerfanos)

print(f"\n{fallos} fallos")
sys.exit(1 if fallos else 0)
