export const formatRequestHeaders = (obj) => {
    const newObj = {};
    for (const key in obj) {
        // happens with cookies in http module responses sometimes
        if (Array.isArray(obj[key]))
            obj[key] = obj[key].join(';');
        newObj[key.toLowerCase()] = obj[key];
    }
    return newObj;
};