/**
 * node find_missing_ref_ine.js [--filter=] <csv from IGN> <csv from OSM>
 */

const fs = require('fs');
const csv = require('csv-parser')
const GeoJSON = require('geojson');

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

const filterFn = argv("filter") || false;

// puesto que los argumentos son falsables, en función de cuántos NO sean nulos
// podemos determinar cuántos args necesitamos quitar
const [INE, OSM] = args.slice([!!filterFn].filter(Boolean).length)

Promise.all([
  new Promise((resolve) => {
    const results = [];
    fs.createReadStream(INE)
      .pipe(csv({
        separator: ";",
        skipLines: 1,
        headers: ["ref:ine", "name", , , , "population", , , "lon", "lat", , "ele", , "flag1", "flag2"],
        // parsear los tipos de datos del archivo
        mapValues: ({ header, value }) => {
          // ignorar los headers (columnas) que no interesan
          if (!["ref:ine", "name", "population", "lon", "lat", "ele", "flag1", "flag2"].includes(header)) return undefined
          // aplicar parseo numérico para las columnas de tipo número
          if (["lon", "lat", "ele", "population"].includes(header)) return Number(value.replace(/,/, "."))
          // devolver el dato para cualquier columna que no sea un "flag"
          if (!["flag1", "flag2"].includes(header)) return value
          // aplicar parseo booleano para los "flags"
          if (value === "VERDADERO") return true
          if (value === "FALSO") return false
          // ignorar resto cosas
          return undefined
        }
      }))
      // - eliminar previamente elementos que estén señalados con VERDADERO,
      //   (para más información leer el PDF adjunto al fichero de ENTIDADES)
      // - aplicar el argumento filter, si existe
      .on('data', (data) => {
        if (!data["flag1"] && !data["flag2"]) {
          let row = data

          if (process.env.DATE) {
            row = { ...data, "population:date": process.env.DATE }
          }

          if (!Number.isInteger(data["ele"])) {
            // redondear elevaciones decimales
            row = { ...row, "ele": Math.round(data["ele"]) }
          } else if (data["ele"] === 0) {
            // quitar el dato de elevación cuando es 0, presumiblemente se trata de un error
            const { ele, ...rest } = row
            row = rest
          }

          if (!!filterFn) {
            data["ref:ine"].startsWith(filterFn) && results.push(row);
          } else {
            results.push(row);
          }
        }
      })
      .on('end', () => resolve(results));
  }),
  new Promise((resolve) => {
    const results = [];
    fs.createReadStream(OSM)
      .pipe(csv({
        separator: ";",
        skipLines: 1,
        headers: ["ref:ine", "name", "type", "id", "lat", "lon"]
      }))
      .on('data', (data) => {
        if (!!filterFn) {
          data["ref:ine"].startsWith(filterFn) && results.push(data);
        } else {
          results.push(data);
        }
      })
      .on('end', () => resolve(results));
  })
]).then(([fromINE, fromOSM]) => {
  // lista de códigos que existen en OSM
  const refOSM = fromOSM.map(({ "ref:ine": ine }) => ine)
  // agrupación por entidad singular (las 9 primeras cifras del código)
  const entities = groupBy(fromINE, ({ "ref:ine": ine }) => ine.slice(0, 9))

  // comprueba que, aparte de la entidad singular (acabada en 00), solo existe otro elemento en su grupo
  const isUniqueElement = entityGroup => entityGroup.length === 2

  // comprueba que el código acabe en 000000 (municipio), o bien, no acabe en 00 (entidad singular) ni en 99 (diseminado)
  const isValidType = ({ "ref:ine": ine, population }, entityGroup) => (ine.endsWith("000000") || (!ine.endsWith("00") && !ine.endsWith("99"))) && (population !== 0 || isUniqueElement(entityGroup))
  
  // comprueba que el diseminado sea el único elemento del grupo, y tiene algo de población
  const isValidSparse = ({ "ref:ine": ine, population }, entityGroup) => ine.endsWith("99") && isUniqueElement(entityGroup) && population !== 0

  // una entidad se considera faltante si su código INE no existe en OSM, y:
  // - O bien, su tipo es: "municipio", "capital" u "otra entidad", tiene población mayor que cero o es el único elemento de su grupo
  // - O bien es: "diseminados", y es el único elemento de su grupo
  const missingItems = Object.entries(entities)
    .flatMap(([, group]) => group.filter((item) => !refOSM.includes(item["ref:ine"]) && (isValidType(item, group) || isValidSparse(item, group))))
  
  // crea un GeoJson con los elementos faltantes
  fs.writeFile(`${filterFn || "ES"}.geojson`, JSON.stringify(GeoJSON.parse(missingItems, { Point: ["lat", "lon"], exclude: ["type", "flag1", "flag2"] }), null, 2), () => { })
  
  // una entidad se considera sobrante si:
  // - su código INE no existe en el fichero del IGN, bien por que haya sido asimilada por otra entidad, haya desaparecido, o simplemente esté mal
  // - su tipo es diseminado, y no es el único elemento de su grupo
  const refINE = fromINE.map(({ "ref:ine": ine }) => ine)
  const leftoverItems = fromOSM.filter(x => !refINE.includes(x["ref:ine"]) || (x["ref:ine"].endsWith("99") && !isUniqueElement(entities[x["ref:ine"].slice(0, 9)])))
  
  // crea un GeoJson con los elementos faltantes
  fs.writeFile(`${filterFn || "ES"}.leftover.geojson`, JSON.stringify(GeoJSON.parse(leftoverItems, { Point: ["lat", "lon"] }), null, 2), () => { })
})
