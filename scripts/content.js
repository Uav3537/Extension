/** @typedef {typeof import('../module/common.mjs').default} CommonType */
/** @typedef {typeof import('../module/extension.mjs').default} ExtensionType */
/** @typedef {CommonType & ExtensionType} PType */

;(async() => {
    console.log("✅ content.js loaded");
    window.package = {}
    window.package.directory = {
        base: chrome.runtime.getURL(""),
        module: {
            common: chrome.runtime.getURL("/module/common.mjs"),
            world: chrome.runtime.getURL("/module/world.mjs"),
            extension: chrome.runtime.getURL("/module/extension.mjs")
        }
    }
    const {directory} = window.package
    /** @type {[import('../module/common.mjs'), import('../module/extension.mjs')]} */
   /** @type {[import('../module/common.mjs'), import('../module/extension.mjs')]} */
    const rawModules = await Promise.all([
        import(directory.module.common),
        import(directory.module.extension)
    ]);
    /** @type {PType} */
    const p = Object.assign({}, ...rawModules.map(m => m.default || m));
    window.package.entry = p.developing
        ? `http://localhost:3000/api/v1/scripts/register.js`
        : await p.vigor.fetch(`https://gist.githubusercontent.com/Uav3537/64ff81255e0ab77205e393440d5cdb77/raw/bbe00e665d6ee4a8df787f3f43cc3941a6ef3671/gistfile1.txt`).request()
    p.serverUrl = new URL(window.package.entry).origin

    const worldToken = p.createToken(100)

    window.addEventListener("message", (event) => {
        if (event.data.token === worldToken && event.ports.length > 0) {
            port = event.ports[0];
            port.onmessage = async (event) => {
                const { action, content, id, title } = event.data;

                const main = {
                    chromeAPI: async (path, args = []) => {
                        const parts = path.split('.');
                        let parent = null;
                        let method = chrome;

                        for (const part of parts) {
                            parent = method;
                            method = method?.[part];
                        }

                        if (typeof method === 'function') {
                            return await method.apply(parent, Array.isArray(args) ? args : [args]);
                        }
                        throw new Error(`API Path "${path}" not found or not a function`);
                    },
                    extensionAPI: async(path, args = []) => {
                        const parts = path.split('.');
                        let parent = null;
                        let method = p;

                        for (const part of parts) {
                            parent = method;
                            method = method?.[part];
                        }

                        if (typeof method === 'function') {
                            return await method.apply(parent, Array.isArray(args) ? args : [args]);
                        }
                        throw new Error(`API Path "${path}" not found or not a function`);
                    },
                    dataAPI: async () => {
                        return {
                            serverUrl: p.serverUrl,
                            manifest: p.manifest,
                            directory
                        };
                    },
                    insertSrc: (target, url) => {
                        const el = document.getElementById(target)
                        if(!el) throw new Error("el Id not found")
                        const observer = new IntersectionObserver((entries, observer) => {
                            entries.forEach(entry => {
                                if (entry.isIntersecting) {
                                    el.src = url;
                                    observer.unobserve(el);
                                }
                            });
                        });

                        observer.observe(el);
                    }
                }

                console.log(`[${title}] -> ${action}`)

                try {
                    const result = await main[action]?.(...content);
                    port.postMessage({ id, data: result, success: true });
                } catch (error) {
                    port.postMessage({ id, error: error.message, success: false });
                }
            };
        }
    }, { once: true });

    const register = await p.vigor.fetch(window.package.entry).request()
    chrome.runtime.sendMessage({
        action: "insertScript",
        content: {
            name: "register.js",
            code: register,
            worldToken,
            modules: [directory.module.common, directory.module.world]
        }
    })
})()