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

const types = {
  m: "Municipio",
  e: "Entidad singular",
  ec: "Entidad colectiva",
  c: "Capital de municipio",
  oe: "Otras entidades",
  d: "Diseminado",
}
const typeFn = types[argv("type")] || false;
const filterFn = argv("filter") || false;

// puesto que los argumentos son falsables, en función de cuántos NO sean nulos
// podemos determinar cuántos args necesitamos quitar
const files = args.slice([!!typeFn, !!filterFn].filter(Boolean).length)

Promise.all(files.map(x => new Promise((resolve) => {
  const results = [];
  fs.createReadStream(x)
    .pipe(csv({
      separator: ";",
      skipLines: 1,
      headers: ["ine", "name", , , "tipo", "population", , , "lon", "lat", , "ele"],
      mapValues: ({ header, value }) => ["ine", "name", "tipo", "population", "lon", "lat", "ele"].includes(header)
        ? ["lon", "lat", "ele", "population"].includes(header)
          ? Number(value.replace(/,/, ".")) 
          : value
        : undefined
    }))
    .on('data', (data) => !!filterFn ? data.ine.startsWith(filterFn) && results.push(data) : results.push(data))
    .on('end', () => resolve(results));
}))).then(([fromINE, fromOSM]) => {
  // lista de códigos que existen en OSM
  const refOSM = fromOSM.map(({ ine }) => ine)
  // códigos del INE no existen en OSM (el listado anterior)
  // a no ser que se le incluya un tipo, comprueba que existan 3: "municipio", "capital" y "otras entidades"
  const missingItems = fromINE.filter(({ ine, tipo }) => [typeFn || [types.m, types.c, types.oe]].flat().includes(tipo) && !refOSM.includes(ine))

  // crea un GeoJson con los elementos faltantes
  return fs.writeFile(path.join(__dirname, `${filterFn || "ES"}.geojson`), JSON.stringify(GeoJSON.parse(missingItems, { Point: ["lat", "lon"], exclude: ["tipo"] }), null, 2), () => { })
})
