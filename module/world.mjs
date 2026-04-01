const main = {
    dispatch: (worldToken, title) => {
        return new Proxy({}, {
            get(target, prop) {
                return async(...content) => {
                    const requestId = Math.random().toString(36).substring(2);

                    const res = new Promise((resolve, reject) => {
                        const timeoutId = setTimeout(() => {
                            window.removeEventListener("message", handler)
                            reject(new Error(`Request timeout: ${prop}`));
                        }, 60000);

                        const handler = (event) => {
                            const { token, id, data, isResponse } = event.data;

                            if (!isResponse) return;

                            if (token !== worldToken || id !== requestId) return;
                            window.removeEventListener("message", handler);
                            clearTimeout(timeoutId);
                            resolve(data);
                        };

                        window.addEventListener("message", handler);
                    });

                    window.postMessage({
                        action: prop,
                        content,
                        token: worldToken,
                        id: requestId,
                        title
                    }, "*");

                    return res
                }
            }
        })
    }
}

export default main