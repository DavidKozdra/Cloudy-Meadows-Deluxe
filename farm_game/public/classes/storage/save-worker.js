'use strict';
importScripts('./save-codec.js?v=2');
self.onmessage = async ({ data: { id, method, args } }) => {
    try {
        const result = await CloudySaveCodec[method](...args);
        self.postMessage({ id, result }, result?.data?.buffer ? [result.data.buffer] : []);
    } catch (error) {
        self.postMessage({ id, error: { name: error.name, message: error.message } });
    }
};
