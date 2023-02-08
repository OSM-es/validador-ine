/**
 * node find_missing_ref_ine.js [--filter=] [--type=m|e|ec|c|oe|d"] <csv from IGN> <csv from OSM>
 */

const fs = require('fs');
const csv = require('csv-parser')
const GeoJSON = require('geojson');
const path = require('path');

const [, , ...args] = process.argv

const argv = key => {
  // Return true if the key exists and a value is defined
  if (process.argv.includes(`--${key}`)) return true;

  const value = process.argv.find(element => element.startsWith(`--${key}=`));

  // Return null if the key does not exist and a value is not defined
  if (!value) return null;

  return value.replace(`--${key}=`, '');
}

const groupBy = (data, key) => {
  return data.reduce((acc, x) => {
    const cat = key instanceof Function ? key(x) : x[key];
    (acc[cat] = acc[cat] || []).push(x);
    return acc;
  }, {})
};

const types = {
  m: "Municipio",
  e: "Entidad singular",
  ec: "Entidad colectiva",
  c: "Capital de municipio",
  oe: "Otras entidades",
  d: "Diseminado",
}

const filterFn = argv("filter") || false;

// puesto que los argumentos son falsables, en función de cuántos NO sean nulos
// podemos determinar cuántos args necesitamos quitar
const files = args.slice([!!filterFn].filter(Boolean).length)

Promise.all(files.map(x => new Promise((resolve) => {
  const results = [];
  fs.createReadStream(x)
    .pipe(csv({
      separator: ";",
      skipLines: 1,
      headers: ["ref:ine", "name", , , "type", "population", , , "lon", "lat", , "ele", , "flag1", "flag2"],
      // parsear los tipos de datos del archivo
      mapValues: ({ header, value }) => ["ref:ine", "name", "type", "population", "lon", "lat", "ele", "flag1", "flag2"].includes(header)
        ? ["lon", "lat", "ele", "population"].includes(header)
          ? Number(value.replace(/,/, ".")) 
          : ["flag1", "flag2"].includes(header) 
            ? value === "VERDADERO"
              ? true
              : value === "FALSO"
                ? false
                : undefined
            : value
        : undefined
    }))
    // - eliminar previamente elementos que estén señalados con VERDADERO,
    //   (para más información leer el PDF adjunto al fichero de ENTIDADES)
    // - aplicar el argumento filter, si existe
    .on('data', (data) => (!data["flag1"] && !data["flag2"]) && (!!filterFn ? data["ref:ine"].startsWith(filterFn) && results.push(data) : results.push(data)))
    .on('end', () => resolve(results));
}))).then(([fromINE, fromOSM]) => {
  // lista de códigos que existen en OSM
  const refOSM = fromOSM.map(({ "ref:ine": ine }) => ine)
  // agrupación por entidad singular (las 9 primeras cifras del código)
  const entities = groupBy(fromINE, ({ "ref:ine": ine }) => ine.slice(0, 9))

  // comprueba que, aparte de "entidad singular", no exista más que un tipo en su grupo
  const isUniqueElement = entityGroup => entityGroup.length && entityGroup.filter(({ type }) => ![types.e].includes(type)).length === 1
  
  const isValidType = ({ type, population }, entityGroup) => [types.m, types.c, types.oe].includes(type) && (population !== 0 || isUniqueElement(entityGroup))
  const isValidSparse = ({ type }, entityGroup) => [types.d].includes(type) && isUniqueElement(entityGroup)
  
  // una entidad se considera faltante si su código INE no existe en OSM, y:
  // - O bien, su tipo es: "municipio", "capital" u "otra entidad", tiene población mayor que cero o es el único elemento de su grupo
  // - O bien es: "diseminados", y es el único elemento de su grupo
  const missingItems = Object.entries(entities).reduce((acc, [, group]) => {
    const missing = group.reduce((elements, item) => (!refOSM.includes(item["ref:ine"]) && (isValidType(item, group) || isValidSparse(item, group))) ? [...elements, item] : elements, [])
    return missing.length ? [...acc, ...missing] : acc
  }, [])

  // crea un GeoJson con los elementos faltantes
  return fs.writeFile(path.join(__dirname, `${filterFn || "ES"}.geojson`), JSON.stringify(GeoJSON.parse(missingItems, { Point: ["lat", "lon"], exclude: ["type", "flag1", "flag2"] }), null, 2), () => { })
})
