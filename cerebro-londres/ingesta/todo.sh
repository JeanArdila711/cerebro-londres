#!/usr/bin/env bash
# Reconstruye el lago entero desde cero: un comando, sin llaves, solo biblioteca estándar de Python.
# El orden importa: territorio y demografía alimentan al atlas, a las correlaciones y a otros temas,
# y el catálogo se arma al final porque lee lo que declaró cada tema.
set -euo pipefail
cd "$(dirname "$0")/.."

primero="pull_territorio pull_demografia"
ultimo="pull_atlas pull_correlaciones pull_catalogo"

for s in $primero; do python3 "ingesta/$s.py"; done
for f in ingesta/pull_*.py; do
  s=$(basename "$f" .py)
  case " $primero $ultimo " in *" $s "*) continue ;; esac
  python3 "$f"
done
for s in $ultimo; do python3 "ingesta/$s.py"; done
