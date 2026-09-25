#!/usr/bin/env python3
"""Rastreo: prueba cada fuente de rastreo.json y le pasa el semáforo del taller.

Solo toca las fichas que traen `prueba` (la URL que se abre). Por cada una:
  · la abre y anota `probado` (hoy) y `respuesta` (código y detalle)
  · busca `evidencia.patron` en `evidencia.url` (o en la propia respuesta) y anota
    `licencia_verificada`: la licencia de la ficha no se cree, se comprueba
  · aplica el semáforo de la lámina «¿Se puede usar?» a `semaforo` y escribe
    `veredicto`, `estado` y `proteccion`

Un veredicto «integrado» quiere decir «apto»: como la fuente todavía no tiene
script de ingesta, queda en el catálogo como `candidato` hasta que entre al lago.

Uso: python3 catalogo/probar.py [id ...]     (sin ids, prueba todas)
"""
import collections, concurrent.futures as cf, json, pathlib, re, sys, time
import urllib.error, urllib.parse, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "ingesta"))
import comun as C

RASTREO = C.RAIZ / "catalogo" / "rastreo.json"
MAX_BYTES = 1_500_000

# Qué tipo de licencia es cada código de la lista cerrada, para el semáforo
TIPO_LICENCIA = {"OGL-3.0": "abierta", "OGL-2.0": "abierta", "CC-BY-4.0": "abierta", "CC-BY": "abierta",
                 "CC-BY-SA": "abierta", "CC0-1.0": "abierta", "ODbL-1.0": "abierta", "ODC-BY": "abierta",
                 "uso-personal": "personal", "todos-los-derechos-reservados": "prohibe",
                 "sin-declarar": "nada", "sin-confirmar": "nada"}


def evalua(s):
    """El semáforo de la lámina 10, en el mismo orden de reglas. Devuelve (veredicto, protección)."""
    if s["vida"] == "caido":
        return "caido", "—"
    if s["origen"] == "nose" or s["licencia"] == "prohibe":
        return "excluido", "—"
    if s["personas"] == "identificable":
        return "excluido", "no se publica"
    if s["personas"] == "libre" or (s["licencia"] == "nada" and s["acceso"] not in ("bloquea", "pdf")):
        return "candidato", "por decidir"
    prot = ("detrás de una compuerta real" if s["licencia"] == "personal"
            else "abierto, solo agregados" if s["personas"] == "agregado" else "abierto")
    if s["acceso"] in ("bloquea", "pdf"):
        return "declarado", prot
    return "integrado", prot


def _comprobar_semaforo():
    """Los cinco casos de Lima de la lámina 10, con el resultado que da el taller."""
    casos = {
        "API del BCRP": (dict(origen="estado", licencia="cita", personas="no", acceso="api", vida="vivo"), "integrado"),
        "Google News RSS": (dict(origen="empresa", licencia="personal", personas="no", acceso="api", vida="vivo"), "integrado"),
        "Padrón RUC": (dict(origen="estado", licencia="abierta", personas="identificable", acceso="api", vida="vivo"), "excluido"),
        "Aire SENAMHI": (dict(origen="estado", licencia="nada", personas="no", acceso="pdf", vida="vivo"), "declarado"),
        "Consulta Amigable": (dict(origen="estado", licencia="abierta", personas="no", acceso="bloquea", vida="caido"), "caido"),
    }
    for nombre, (s, esperado) in casos.items():
        assert evalua(s)[0] == esperado, f"semáforo roto en el caso {nombre}: {evalua(s)} != {esperado}"
    assert evalua(casos["Google News RSS"][0])[1] == "detrás de una compuerta real"


def abrir(url, metodo="GET", intentos=3):
    """Un 429 o un 503 no es una fuente caída: es una fuente que pide esperar. Se reintenta."""
    for n in range(intentos):
        peticion = urllib.request.Request(url, headers=C.UA, method=metodo)
        try:
            with urllib.request.urlopen(peticion, timeout=60) as r:
                return r.status, (r.read(MAX_BYTES) if metodo == "GET" else b"").decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and n < intentos - 1:
                espera = e.headers.get("Retry-After") or ""
                time.sleep(float(espera) if espera.isdigit() else 15 * (n + 1))
                continue
            return e.code, e.read(4000).decode("utf-8", "replace")
        except Exception as e:                   # DNS, timeout, conexión: el error exacto va a la ficha
            return 0, f"{type(e).__name__}: {e}"


def probar_host(fichas, cache):
    """Las fichas de un mismo servidor se prueban en fila, con pausa: cortesía y menos 429."""
    for f in fichas:
        codigo, cuerpo = abrir(f["prueba"], f.get("metodo", "GET"))
        esperados = set(f.get("esperado", [])) | {200}
        vivo = codigo in esperados
        detalle = "" if codigo == 200 else re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cuerpo))[:160].strip()
        f["probado"] = C.hoy()
        f["respuesta"] = {"codigo": codigo, "detalle": detalle}

        ev = f.get("evidencia")
        if ev:
            if ev.get("url") and ev["url"] != f["prueba"]:
                if ev["url"] not in cache:
                    cache[ev["url"]] = abrir(ev["url"])[1]
                texto = cache[ev["url"]]
            else:
                texto = cuerpo
            limpio = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", texto))   # la frase suele venir partida por enlaces
            m = re.search(ev["patron"], texto, re.I | re.S) or re.search(ev["patron"], limpio, re.I | re.S)
            f["licencia_verificada"] = bool(m)
            f["licencia_evidencia"] = re.sub(r"\s+", " ", m.group(0))[:140] if m else ""
        else:
            f["licencia_verificada"] = False

        s = dict(f["semaforo"])
        s.setdefault("licencia", TIPO_LICENCIA.get(f["licencia"], "nada"))
        s["vida"] = "caido" if not vivo else s.get("vida", "vivo")
        veredicto, proteccion = evalua(s)
        f["veredicto"] = veredicto
        f["estado"] = "candidato" if veredicto == "integrado" else veredicto
        f["proteccion"] = proteccion
        time.sleep(0.6)
    return fichas


def main(ids):
    _comprobar_semaforo()
    fichas = json.loads(RASTREO.read_text(encoding="utf-8"))
    a_probar = [f for f in fichas if f.get("prueba") and (not ids or f["id"] in ids)]
    por_host = collections.defaultdict(list)
    for f in a_probar:
        por_host[urllib.parse.urlsplit(f["prueba"]).hostname].append(f)
    cache = {}
    with cf.ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda grupo: probar_host(grupo, cache), por_host.values()))

    RASTREO.write_text(json.dumps(fichas, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    cuenta = collections.Counter(f["estado"] for f in a_probar)
    sin_licencia = [f["id"] for f in a_probar if f.get("evidencia") and not f["licencia_verificada"]]
    print(f"  {len(a_probar)} fuentes probadas · " + " · ".join(f"{e} {n}" for e, n in sorted(cuenta.items())))
    for f in a_probar:
        if f["estado"] == "caido":
            print(f"  ✗ {f['id']}: {f['respuesta']['codigo']} {f['respuesta']['detalle'][:90]}")
    if sin_licencia:
        print(f"  ! evidencia de licencia no encontrada en: {', '.join(sin_licencia)}")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
