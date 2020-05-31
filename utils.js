const lowerCaseObjectKeys = (obj) => {
    newObj = {};
    for (const key of Object.keys(obj)) {
        newObj[key.toLowerCase()] = obj[key];
    }
    return newObj;
};

module.exports = {
    lowerCaseObjectKeys
};