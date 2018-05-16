const prefixBoundary = '\r\n--';
const delimData = '\r\n\r\n';

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
const getValueIgnoringKeyCase = (obj, lookedKey) => {
  return obj[lookedKey.toLowerCase()] || obj[lookedKey.toLowerCase()] || '';
};

/**
 * Parser
 * @param {Object} event
 * @param {String} spotText
 * @return {*}
 */
module.exports.parse = (event, spotText) => {
  const boundary = prefixBoundary + getValueIgnoringKeyCase(event.headers, 'Content-Type').split('=')[1];
  return (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('binary') : event.body)
  .split(boundary)
  .filter((item) => item.indexOf('Content-Disposition: form-data') !== -1)
  .map((item) => {
    const tmp = split(item, delimData);
    const header = tmp[0];
    let content = tmp[1];
    const name = header.match(/name="([^"]+)"/)[1];
    const result = {};
    result[name] = content;

    if (header.indexOf('filename') !== -1) {
      const filename = header.match(/filename="([^"]+)"/)[1];
      const contentType = header.match(/Content-Type: (.+)/)[1];

      if (!(spotText && contentType.indexOf('text') !== -1)) { // replace content with binary
        content = Buffer.from(content, 'binary');
      }
      result[name] = {
        type: 'file',
        filename: filename,
        contentType: contentType,
        content: content,
        size: content.length
      };
    }
    return result;
  })
  .reduce((accumulator, current) => Object.assign(accumulator, current), {});
};
