#!/usr/bin/env python3
"""Ingesta · finanzas: Council Tax (Band D) de los 33 boroughs (MHCLG).

Fuente: «Council Tax levels set by local authorities in England 2026 to
2027», colección de gov.uk. Es el equivalente al predial y los arbitrios que
usa Cerebro Lima: cuánto cobra cada autoridad local por una vivienda tipo.

El archivo viene en .ods, no en CSV ni XLSX. Dentro trae DOS archivos
distintos: «Table_10», que resultó ser un FORMULARIO EN BLANCO para que cada
autoridad reporte su cifra (no el dato ya publicado), y «Tables_1-9», que sí
es la tabla de resultados. Dentro de ese segundo archivo, la hoja correcta es
«Table_8a»: las demás 16 hojas son series nacionales, por tipo de autoridad
o por región, no por los boroughs de Londres uno por uno.

Se lee con comun.leer_ods (zipfile + xml.etree, sin librerías externas: un
.ods es un zip con content.xml adentro).
"""
import sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import comun as C

ODS_URL = "https://assets.publishing.service.gov.uk/media/69de1fa63e81003ae0422508/Tables_1-9_2026-27.ods"
HOJA = "Table_8a"
FOCO_COD, FOCO = "E09000033", "City of Westminster"

print("  bajando Table 8a (council tax por borough)…")
crudo = C.get_bin(ODS_URL, crudo="council_tax_table8a.ods")
filas = C.leer_ods(crudo, HOJA)

# La cabecera real está en la fila 2 (0-index), con «E-code» en la primera columna.
encabezado = next(i for i, f in enumerate(filas) if f and f[0] == "E-code")
datos = filas[encabezado + 1:]

boroughs = []
for f in datos:
    if len(f) < 9 or not f[1].startswith("E09"):
        continue
    nombre, precepto = f[2], f[8].replace(",", "")
    if not precepto or precepto == "[z]":
        continue
    try:
        valor = float(precepto)
    except ValueError:
        continue
    boroughs.append({
        "codigo": f[1], "nombre": nombre,
        "council_tax_banda_d": valor,
        "cambio_interanual_pct": float(f[9]) if f[9] else None,
    })

print(f"  boroughs con dato: {len(boroughs)}")
if len(boroughs) != 33:
    sys.exit(f"se esperaban 33 boroughs de Greater London y llegaron {len(boroughs)}")

boroughs.sort(key=lambda b: -b["council_tax_banda_d"])
for i, b in enumerate(boroughs, 1):
    b["puesto"] = i

foco = next(b for b in boroughs if b["codigo"] == FOCO_COD)
mas_cara, mas_barata = boroughs[0], boroughs[-1]

fuentes = [{
    "id": "mhclg_council_tax",
    "nombre": "Council Tax levels set by local authorities in England 2026 to 2027 · Table 8a",
    "entidad": "MHCLG",
    "url": "https://www.gov.uk/government/statistics/council-tax-levels-set-by-local-authorities-in-england-2026-to-2027",
    "resolucion": "borough (Banda D, incluye social care y parish precepts)",
    "vigencia": "2026-2027",
    "probado": C.hoy(),
    "estado": "vivo",
    "licencia": "OGL-3.0",
    "personas": "no",
    "proteccion": "abierto",
    "uso": "sección Municipio · financiación local",
    "nota": ("Archivo .ods, no CSV. Dentro hay dos conjuntos con el mismo nombre de tabla: "
             "«Table_10» es un formulario en blanco de recolección, no un resultado; «Table_8a» "
             "dentro de Tables_1-9 es la tabla publicada de verdad."),
}]

cifras = {
    "council_tax_westminster": C.cifra(foco["council_tax_banda_d"], "£ por vivienda Banda D", "mhclg_council_tax",
                                        "2026-2027", "Incluye precepto de cuidado social y parroquial"),
    "cambio_interanual_westminster": C.cifra(foco["cambio_interanual_pct"], "% frente a 2025-26", "mhclg_council_tax",
                                              "2026-2027", ""),
    "puesto_council_tax_westminster": C.cifra(foco["puesto"], "puesto de 33", "mhclg_council_tax", "2026-2027",
                                               "1 = el Council Tax más alto de los 33 boroughs"),
    "borough_mas_caro": C.cifra(mas_cara["nombre"], "borough", "mhclg_council_tax", "2026-2027",
                                 f"£{mas_cara['council_tax_banda_d']:,.2f}"),
    "borough_mas_barato": C.cifra(mas_barata["nombre"], "borough", "mhclg_council_tax", "2026-2027",
                                   f"£{mas_barata['council_tax_banda_d']:,.2f}"),
}

listas = {"boroughs": boroughs}

ruta = C.escribir(
    "finanzas", fuentes, cifras, listas=listas,
    territorio=FOCO,
    nota=(f"Westminster cobra £{foco['council_tax_banda_d']:,.2f}, puesto {foco['puesto']} de 33 "
          f"(la más baja es {mas_barata['nombre']}, con £{mas_barata['council_tax_banda_d']:,.2f}). "
          "Westminster y Wandsworth, las dos tarifas más bajas de Londres, también tuvieron el menor "
          "incremento interanual (1,97 % y 2,04 %) frente al 4,99 % de la mayoría de boroughs: la "
          "política fiscal baja de ambos viene de antes, no es un efecto de este año."),
)
print(f"  Westminster: £{foco['council_tax_banda_d']:,.2f}, puesto {foco['puesto']} de 33 (más alto = más caro)")
print(f"  más cara: {mas_cara['nombre']} (£{mas_cara['council_tax_banda_d']:,.2f}) · más barata: {mas_barata['nombre']} (£{mas_barata['council_tax_banda_d']:,.2f})")
print(f"  → {ruta}")
