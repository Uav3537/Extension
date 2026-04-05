let sharedBridge = null;

const main = {
    dispatch: (worldToken, title) => {
        if (sharedBridge) return sharedBridge;
        const channel = new MessageChannel();
        const port = channel.port1;
        const pendingRequests = new Map();

        port.onmessage = (event) => {
            const { id, data, error, success } = event.data;
            if (pendingRequests.has(id)) {
                const { resolve, reject, timeoutId } = pendingRequests.get(id);
                clearTimeout(timeoutId);
                pendingRequests.delete(id);
                success ? resolve(data) : reject(new Error(error));
            }
        };

        window.postMessage({ token: worldToken }, "*", [channel.port2]);

        sharedBridge = new Proxy({}, {
            get(target, prop) {
                return (...content) => {
                    return new Promise((resolve, reject) => {
                        const requestId = Math.random().toString(36).substring(2);
                        const timeoutId = setTimeout(() => {
                            pendingRequests.delete(requestId);
                            reject(new Error(`Timeout: ${prop}`));
                        }, 60000);

                        pendingRequests.set(requestId, { resolve, reject, timeoutId });
                        port.postMessage({ action: prop, content, id: requestId, title });
                    });
                };
            }
        });

        return sharedBridge;
    }
}

export default main