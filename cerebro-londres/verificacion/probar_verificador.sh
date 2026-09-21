#!/usr/bin/env bash
# Rompe el lago a propósito y comprueba que la verificación lo atrapa.
# Una verificación que nunca falla no está verificando.
set -u
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
cp lago/escucha.json "$TMP/escucha.json.bak"
trap 'cp "$TMP/escucha.json.bak" lago/escucha.json; rm -rf "$TMP"' EXIT

fallos=0
probar() {                       # nombre · parche python
  local nombre="$1" parche="$2"
  cp "$TMP/escucha.json.bak" lago/escucha.json
  python3 -c "
import json
d = json.load(open('lago/escucha.json'))
$parche
json.dump(d, open('lago/escucha.json','w'), ensure_ascii=False)
"
  if python3 verificacion/verificar.py > "$TMP/salida" 2>&1; then
    echo "  NO ATRAPADO  $nombre"
    fallos=$((fallos+1))
  else
    echo "  atrapado     $nombre"
  fi
}

echo "Rompiendo el lago a propósito:"
probar "cifra sin fuente"            "d['cifras']['inventada']={'valor':12,'unidad':'personas','vigencia':'2026'}"
probar "cifra con fuente fantasma"   "d['cifras']['vistas_ultimo_mes']['fuente']='no_existe'"
probar "cifra sin unidad"            "d['cifras']['vistas_ultimo_mes']['unidad']=''"
probar "fecha con hora en vez de día" "d['probado']='2026-09-21T10:30:00'"
probar "fuente sin licencia"         "d['fuentes'][0]['licencia']=''"
probar "licencia fuera de la lista"  "d['fuentes'][0]['licencia']='libre, supongo'"
probar "fuente sin fecha de prueba"  "d['fuentes'][0].pop('probado')"
probar "fuente sin declarar personas" "d['fuentes'][0]['personas']=''"
probar "correo en una nota"          "d['nota']='dudas: escribir a nombre@ejemplo.com'"
probar "móvil británico en una nota" "d['cifras']['vistas_ultimo_mes']['nota']='llamar al 07700 900123'"
probar "postcode en un valor"        "d['cifras']['vistas_ultimo_mes']['vigencia']='SW1A 1AA'"
probar "campo con nombre personal"   "d['listas']['telefono_contacto']=['x']"
probar "serie sin puntos"            "d['series']['wiki_westminster']['puntos']=[]"

cp "$TMP/escucha.json.bak" lago/escucha.json
echo
if python3 verificacion/verificar.py > "$TMP/salida" 2>&1; then
  echo "  lago restaurado · la verificación vuelve a pasar"
else
  echo "  ERROR: el lago no quedó como estaba"; fallos=$((fallos+1))
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "La verificación atrapó los 13 casos. Sabe fallar."
  exit 0
else
  echo "$fallos casos NO fueron atrapados: la verificación tiene huecos."
  exit 1
fi
