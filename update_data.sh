#!/bin/bash

query='[out:csv("ref:ine"; true)][timeout:900];area["ISO3166-1"="ES"]->.searchArea;nwr(area.searchArea)["ref:ine"];out;'
wget -O "ES.csv" --post-data="${query}" "https://overpass-api.de/api/interpreter"

node find_missing_ref_ine.js ENTIDADES.csv ES.csv
