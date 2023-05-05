#!/bin/bash

# Este script actualiza automáticamente los datos de este repositorio para mostrarlos en la página de DEMO
# Si el fichero del IGN tiene la forma ENTIDADES.<AÑO>.csv, se incluirá el campo "population:date"

query='[out:csv("ref:ine"; true)][timeout:900];area["ISO3166-1"="ES"]->.searchArea;nwr(area.searchArea)["ref:ine"];out;'
wget -O "ES.csv" --post-data="${query}" "https://overpass-api.de/api/interpreter"

DATE=$(ls -Art ENTIDADES*csv | tail -n 1 | cut -d'.' -f2) node find_missing_ref_ine.js ENTIDADES.csv ES.csv
