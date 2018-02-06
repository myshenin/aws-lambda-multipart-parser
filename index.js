const base64 = require("base-64");

module.exports.getValueIgnoringKeyCase = function(lookedObj, lookedKey) {
  return Object.keys(lookedObj)
    .map(
      presentKey =>
        presentKey.toLowerCase() === lookedKey.toLowerCase()
          ? lookedObj[presentKey]
          : null
    )
    .filter(item => item)[0];
};

module.exports.parse = (event, spotText) => {
  const boundary = getValueIgnoringKeyCase(event.headers, "content-type").split(
    "="
  )[1];
  const body = (event.isBase64Encoded ? base64.decode(event.body) : event.body)
    .split(new RegExp(boundary))
    .filter(item => item.match(/Content-Disposition/))
    .map(item => {
      if (item.match(/filename/)) {
        const result = {};
        result[
          item
            .match(/name="[a-zA-Z_]+([a-zA-Z0-9_]*)"/)[0]
            .split("=")[1]
            .match(/[a-zA-Z_]+([a-zA-Z0-9_]*)/)[0]
        ] = {
          type: "file",
          filename: item
            .match(/filename="[\w-\.]+"/)[0]
            .split("=")[1]
            .match(/[\w-\.]+/)[0],
          contentType: item
            .match(/Content-Type: .+\r\n\r\n/)[0]
            .replace(/Content-Type: /, "")
            .replace(/\r\n\r\n/, ""),
          content:
            spotText &&
            item
              .match(/Content-Type: .+\r\n\r\n/)[0]
              .replace(/Content-Type: /, "")
              .replace(/\r\n\r\n/, "")
              .match(/text/)
              ? item.split(/\r\n\r\n/)[1].replace(/\r\n\r\n\r\n--/, "")
              : new Buffer(
                  item.split(/\r\n\r\n/)[1].replace(/\r\n\r\n\r\n--/, "")
                )
        };
        return result;
      }
      const result = {};
      result[
        item
          .match(/name="[a-zA-Z_]+([a-zA-Z0-9_]*)"/)[0]
          .split("=")[1]
          .match(/[a-zA-Z_]+([a-zA-Z0-9_]*)/)[0]
      ] = item.split(/\r\n\r\n/)[1].split(/\r\n--/)[0];
      return result;
    })
    .reduce((accumulator, current) => Object.assign(accumulator, current), {});
  return body;
};
