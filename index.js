const base64 = require('base-64');

const getCaseInsensitiveVal = (headerObj, key) => {
    for (keyName in headerObj){
        if (keyName.toLocaleLowerCase() === key.toLocaleLowerCase()) {
            return headerObj[keyName];
        }
    }
    return null;
};
/*
* Throws error: 
*    * when the event does not have content-type and boundry.
*    * when filenameRegex does not match with the file name in the event.    
*/
module.exports.parse = (event, filenameRegex) => {
    var filenameRegex = filenameRegex != null? filenameRegex: "[\\w]+\\.[A-Za-z]{2,4}";
    const fileRegex = new RegExp("filename=\""+ filenameRegex +"\"");
    filenameRegex = new RegExp(filenameRegex);
    const contentType = getCaseInsensitiveVal(event.headers,'content-type');
    if (!contentType){
        throw new Error("no content type provided");
    }
    if(contentType.indexOf("boundary") === -1){
        throw new Error("Content type does not contain boundary");
    }
    const boundary = contentType.split('=')[1];
    const response = (event.isBase64Encoded ? base64.decode(event.body) : event.body)
        .split(new RegExp(boundary))
        .filter(item => item.match(/Content-Disposition/))
        .map((item) => {
            if (item.match(/filename/)) {
                const result = {};
                result[
                    item
                        .match(/name="[a-zA-Z_]+([a-zA-Z0-9_]*)"/)[0]
                        .split('=')[1]
                        .match(/[a-zA-Z_]+([a-zA-Z0-9_]*)/)[0]
                    ] = {
                    type: 'file',
                    filename: item
                        .match(fileRegex)[0]
                        .split('=')[1]
                        .match(filenameRegex)[0],
                    contentType: item
                        .match(/Content-Type: .+\r\n\r\n/)[0]
                        .replace(/Content-Type: /, '')
                        .replace(/\r\n\r\n/, ''),
                    content: new Buffer(item
                        .split(/\r\n\r\n/)[1]
                        .replace(/\r\n\r\n\r\n--/, '')),
                };
                return result;
            }
            const result = {};
            result[
                item
                    .match(/name="[a-zA-Z_]+([a-zA-Z0-9_]*)"/)[0]
                    .split('=')[1]
                    .match(/[a-zA-Z_]+([a-zA-Z0-9_]*)/)[0]
                ] = item
                .split(/\r\n\r\n/)[1]
                .split(/\r\n--/)[0];
            return result;
        })
        .reduce((accumulator, current) => Object.assign(accumulator, current), {});
    return response;
};
