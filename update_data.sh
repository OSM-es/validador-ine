#!/bin/bash

# Este script actualiza automáticamente los datos de este repositorio para mostrarlos en la página de DEMO
# Si el fichero del IGN tiene la forma ENTIDADES.<AÑO>.csv, se incluirá el campo "population:date"

set -Eeuo pipefail

query='[out:csv("ref:ine","name",::type,::id,::lat,::lon; true; ";")][timeout:900];area["ISO3166-1"="ES"]->.searchArea;nwr(area.searchArea)["ref:ine"];out center;'

tmp="$(mktemp ./ES.csv.tmp.XXXXXX)"
trap 'rm -f "$tmp"' EXIT

wget \
  --tries=10 \
  --waitretry=15 \
  --retry-on-http-error=429,500,502,503,504 \
  -O "$tmp" \
  --post-data="$query" \
  "https://overpass-api.de/api/interpreter"

if [[ ! -s "$tmp" ]]; then
  echo "Error: la descarga de Overpass está vacía; se conserva ES.csv anterior." >&2
  exit 1
fi

mv "$tmp" ES.csv
trap - EXIT

DATE=$(ls -Art ENTIDADES.*.csv | tail -n 1 | cut -d'.' -f2) node find_missing_ref_ine.js ENTIDADES.csv ES.csv

exit 0