#!/usr/bin/env python3
"""Catálogo de fuentes: lo que entró, lo que no, y por qué.

Se arma con dos mitades:
  · las fuentes DECLARADAS EN EL LAGO, leídas de los propios temas, para que el
    catálogo no pueda contradecir a los datos (en Lima el catálogo y el lago se
    escriben aparte, y por eso el catálogo llegó a registrar «MEF» y «Ministerio
    de Economía y Finanzas» como dos entidades)
  · las fuentes RASTREADAS que no llegaron al lago, en rastreo.json, escritas a
    mano con el error exacto

Cada ficha lleva `probado` y `personas`, los dos campos que el catálogo del
Cerebro Lima no trae por fuente y que el taller pide añadir.
"""
import glob, json, pathlib, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

CAT = C.RAIZ / "catalogo"
ORDEN = ["integrado", "declarado", "candidato", "caido", "excluido"]

fichas, vistos = [], {}

# --- Mitad 1: lo que el lago declara ---------------------------------------
for ruta in sorted(glob.glob(str(C.LAGO / "*.json"))):
    tema = pathlib.Path(ruta).stem
    lago = json.loads(pathlib.Path(ruta).read_text(encoding="utf-8"))
    for f in lago.get("fuentes", []):
        clave = f["id"]
        if clave in vistos:                       # una fuente usada por dos temas
            vistos[clave]["tema"] = vistos[clave]["tema"] + f", {tema}"
            continue
        ficha = dict(f)
        ficha["tema"] = tema
        ficha.setdefault("estado", "integrado")
        # «vivo» describe la fuente; «integrado» describe su relación con el sistema
        if ficha["estado"] == "vivo":
            ficha["estado"] = "integrado"
        vistos[clave] = ficha
        fichas.append(ficha)

# --- Mitad 2: lo rastreado que no entró ------------------------------------
rastreo = CAT / "rastreo.json"
if rastreo.exists():
    for f in json.loads(rastreo.read_text(encoding="utf-8")):
        if f["id"] in vistos:
            continue
        fichas.append(f)
        vistos[f["id"]] = f
else:
    print(f"  ! falta {rastreo.relative_to(C.RAIZ)}: el catálogo solo tendrá lo que entró",
          file=sys.stderr)

# --- Comprobaciones del propio catálogo ------------------------------------
problemas = []
for f in fichas:
    for campo in ("id", "nombre", "entidad", "url", "estado", "licencia", "probado", "personas"):
        if not str(f.get(campo, "")).strip():
            problemas.append(f"{f.get('id')}: sin {campo}")
    if f.get("licencia") not in C.LICENCIAS:
        problemas.append(f"{f.get('id')}: licencia fuera de la lista cerrada ({f.get('licencia')!r})")
    if f.get("entidad") not in C.ENTIDADES:
        problemas.append(f"{f.get('id')}: entidad fuera de la lista cerrada ({f.get('entidad')!r})")
if problemas:
    for p in problemas:
        print(f"  ! {p}", file=sys.stderr)
    sys.exit(f"{len(problemas)} problemas en el catálogo: no se escribe")

por_estado = {}
for f in fichas:
    por_estado[f["estado"]] = por_estado.get(f["estado"], 0) + 1
fichas.sort(key=lambda f: (ORDEN.index(f["estado"]) if f["estado"] in ORDEN else 9, f["id"]))

doc = {
    "tema": "catalogo",
    "probado": C.hoy(),
    "n": len(fichas),
    "por_estado": {e: por_estado[e] for e in ORDEN if e in por_estado},
    "entidades": sorted({f["entidad"] for f in fichas}),
    "licencias": sorted({f["licencia"] for f in fichas}),
    "nota": ("Cada ficha lleva `probado` (el día en que el enlace respondió) y `personas` "
             "(si el conjunto trae datos de personas y cuáles). El catálogo del Cerebro Lima "
             "no trae ninguno de los dos por fuente. Entidad y licencia salen de una lista "
             "cerrada desde la primera ficha."),
    "datasets": fichas,
}

CAT.mkdir(exist_ok=True)
(CAT / "catalogo.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
# El lago sirve el catálogo por la misma compuerta que el resto
(C.LAGO / "catalogo.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")

print(f"  {len(fichas)} fichas · " + " · ".join(f"{e} {n}" for e, n in doc["por_estado"].items()))
print(f"  entidades: {len(doc['entidades'])} · licencias: {len(doc['licencias'])}")
print(f"  → catalogo/catalogo.json y lago/catalogo.json")
