## Validador INE

**DEMO**: https://osm-es.github.io/validador-ine/

El siguiente script comprueba que las referencias existentes en el INE para identificar a las diferentes entidades de población, se corresponden con los nodos y relaciones que están presentes en OSM. 

Para ello necesitamos tener previamente dos archivos:

1. El fichero CSV que utiliza el INE se puede descargar del [Centro de Descargas del IGN](https://centrodedescargas.cnig.es/CentroDescargas/index.jsp), en el apartado _Información Geográfica de Referencia_, bajo el nombre de _Nomenclátor Geográfico de Municipios y Entidades de Población_. A día de esta publicación (2022), es un fichero comprimido el cual contiene una serie de archivos CSV, el que necesitamos se llama **ENTIDADES.csv**.

2. El CSV con los códigos que actualmente están introducidos en OSM lo podemos conseguir ejecutando la siguiente consulta overpass y guardando el resultado en un archivo.

```
[out:csv("ref:ine")][timeout:900];
area["ISO3166-1"="ES"]->.searchArea;
nwr
  ["ref:ine"]
  (area.searchArea);
out;
```

Ahora que disponemos de ambos archivos, ejecutamos el script:

```bash
node find_missing_ref_ine.js ENTIDADES.csv ES.csv
```

El resultado será un fichero GeoJSON con el que podemos visualizar qué elementos están ausentes en OSM.

**NOTA:** La información del fichero de ENTIDADES se actualiza anualmente, por tanto, es necesario reemplazar en este repositorio, dicho fichero con la nueva versión publicada por el IGN, para que la visualización muestre los datos más actuales.

#### Argumentos

- `filter`

  Para generar archivos más pequeños, se puede especificar un filtro en el que simplemente le pasamos los primeros caracteres del código por el que queremos filtrar. Ejemplos:

  ```bash
  node find_missing_ref_ine.js --filter=20 ENTIDADES.csv ES.csv
  ```
  Obtendríamos un GeoJSON para la provincia de Gipuzkoa

  ```bash
  node find_missing_ref_ine.js --filter=07005 ENTIDADES.csv ES.csv
  ```

  Obtendríamos un GeoJSON para el municipio de Andratx (Illes Balears)
