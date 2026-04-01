const main = {
    developing: false,
    createToken: (length) => {
        const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const uintArray = new Uint8Array(length);
        window.crypto.getRandomValues(uintArray);

        let token = "";
        for (let i = 0; i < length; i++) {
            token += charset[uintArray[i] % charset.length];
        }
        return token;
    },
    parseUrl: (href) => {
        const url = new URL(href)
        return {
            origin: url.origin,
            hostname: url.hostname,
            path: url.pathname.split("/").filter(Boolean)
        }
    },
    parseDate: function(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const h = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");

        return {y, m, day, h, min}
    },
    waitForElm: function(selector, timeout = 10000) {
        return new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);

            const observer = new MutationObserver((mutations) => {
                const el = document.querySelector(selector);
                if (el) {
                    clearTimeout(timeoutId);
                    observer.disconnect();
                    resolve(el);
                }
            });

            const timeoutId = setTimeout(() => {
                observer.disconnect();
            }, timeout);

            observer.observe(document.body, { childList: true, subtree: true });
        });
    },
}

export default main