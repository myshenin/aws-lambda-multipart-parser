const merge = require('lodash.merge');

const prefixBoundary = '\r\n--';
const delimData = '\r\n\r\n';

const nameRegex = /name="([^"]+)"/;
const filenameRegex = /filename="([^"]+)"/;
const contentTypeRegex = /Content-Type: (.+)/;

const defaultResult = {files: {}, fields: {}};

/**
 * Split gently
 * @param {String} str
 * @param {String} delim
 * @return {Array<String>}
 */
const split = (str, delim) => [
  str.substring(0, str.indexOf(delim)),
  str.substring(str.indexOf(delim) + delim.length)];

/**
 * Get value of key, case insensitive
 * @param {Object} obj
 * @param {String} lookedKey
 * @return {String}
 */
const getValueIgnoringKeyCase = (obj, lookedKey) => Object.keys(obj)
.map(presentKey => presentKey.toLowerCase() === lookedKey.toLowerCase() ? obj[presentKey] : null)
.filter(item => item)[0];

/**
 * restorePath creates structure from path string
 * @param {*} value
 * @param {String} path - [][k1][k2]
 * @returns {*}
 */
const restorePath = (value, path) => {
  const regExp = /\[([^\]]*)\]/g;
  const matches = [];
  let match;
  while (match = regExp.exec(path)) {
    matches.push(match);
  }
  if (matches.length) {
    matches.reverse();
    return matches.reduce((acc, item) => {
      if (item[0] === '[]') { return [acc]; }
      if (isNaN(item[1])) {
        const tmp = {};
        tmp[item[1]] = acc;
        return tmp;
      }
      const tmp = [];
      tmp[item[1]] = acc;
      return tmp;
    }, value);
  }
  return value;
};

/**
 * Parser
 * @param {Object} event
 * @param {Object} options
 * @param {Boolean} [options.spotText]
 * @param {Boolean} [options.keepStruct] - to keep corrects structure of nested arrays,
 * expects array indices ex.: name[0], name[1][key]
 * @return {*}
 */
module.exports.parse = (event, options) => {
  options = options || {};
  const boundary = prefixBoundary + getValueIgnoringKeyCase(event.headers, 'Content-Type').split('=')[1];
  if (!boundary) { return defaultResult;}
  const body = (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('binary') : event.body)
  .split(boundary)
  .filter((item) => item.indexOf('Content-Disposition: form-data') !== -1)
  .map((item) => {
    const tmp = split(item, delimData);
    const header = tmp[0];
    let content = tmp[1];
    const name = header.match(nameRegex)[1];
    const result = {name: name, data: content};

    if (header.indexOf('filename') !== -1) {
      const filename = header.match(filenameRegex)[1];
      const contentType = header.match(contentTypeRegex)[1];

      if (!(options.spotText && contentType.indexOf('text') !== -1)) { // replace content with binary
        content = Buffer.from(content, 'binary');
      }
      result.data = {
        isFile: true,
        content: content,
        filename: filename,
        name: name,
        type: contentType,
        size: content.length
      };
    }
    return result;
  })
  .reduce((acc, item) => {
    if (item.data.isFile) {
      acc.files[item.name] = item.data;
    } else {
      acc.fields[item.name] = item.data;
    }
    if (options.keepStruct) {
      acc.structs.push(item);
    }
    return acc;
  }, {files: {}, fields: {}, structs: []});

  if (options.keepStruct) {
    body.struct = body.structs.reduce((acc, item) => {
      const i = item.name.indexOf('[');
      if (i === -1) {
        acc[item.name] = item.data;
        return acc;
      }
      const name = item.name.substring(0, i);
      const nameRest = item.name.substring(i);
      const t = restorePath(item.data, nameRest);
      if (!acc[name]) {
        acc[name] = t;
      } else {
        acc[name] = merge(acc[name], t);
      }
      return acc;
    }, {});
  }

  delete body.structs;

  return body;
};
