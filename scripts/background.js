chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const {action, content} = message
    
    const method = {
        cookies: async() => {
            const cookiesRaw = await new Promise(resolve => chrome.cookies.getAll({domain: undefined}, resolve))
            const cookies = cookiesRaw.reduce((acc, cookie) => {
                const domain = cookie.domain.replace(".", "")
                const name = cookie.name;
                const value = cookie.value;

                if (!acc[domain]) acc[domain] = {};

                acc[domain][name] = value;
                return acc;
            }, {});
            return cookies
        },
        runScript: async({name, code, worldToken, modules}) => {
            const frame = await chrome.scripting.executeScript({
                target: { tabId: sender.tab.id },
                func: async({name, code, worldToken, modules}) => {
                    const inject = {
                        eval: (text) => {
                            try {
                                eval(text);
                                return Promise.resolve();
                            } catch (e) {
                                return Promise.reject(e);
                            }
                        },
                        function: (text) => {
                            try {
                                new Function(text);
                                return Promise.resolve();
                            } catch (e) {
                                return Promise.reject(e);
                            }
                        },
                        blob: (text) => new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.type = 'module';
                            const blob = new Blob([text], { type: 'text/javascript' });
                            const url = URL.createObjectURL(blob);
                            script.src = url;
                            
                            script.onload = () => {
                                URL.revokeObjectURL(url);
                                script.remove();
                                resolve();
                            };
                            script.onerror = () => {
                                URL.revokeObjectURL(url);
                                script.remove();
                                reject(new Error("CSP Blocked"));
                            };
                            (document.head || document.documentElement).appendChild(script);
                        }),
                        script: (text) => {
                            const script = document.createElement('script');
                            script.type = 'module';
                            script.textContent = text;
                            (document.head || document.documentElement).appendChild(script);
                            script.remove();
                            return Promise.resolve();
                        },
                    };

                    const scriptContent = `
                        console.log("✅ ${name} loaded");
                        const fileName = "${name}";
                        const worldToken = "${worldToken}"
                        ;(async() => {
                            
                            ${modules.length > 0 ? `const modules = await Promise.all([
                                ${modules.map(m => `import("${m}")`).join(', ')}
                            ]).then(res => res.map(m => m.default || m));
                            const p = Object.assign({}, ...modules)` : ""}
                            ${code}
                        })()
                    `
                    for(const [methodName, execute] of Object.entries(inject)) {
                        console.log(`[Injection] ✏️  Trying <Type: ${methodName}>...`);
                        try {
                            await execute(scriptContent);
                            console.log(`[Injection] ✅  Success with <Type: ${methodName}>`);
                            break;
                        } catch(error) {
                            console.warn(`[Injection] 🚫  Failed with <Type: ${methodName}>, trying next...`);
                        }
                    }
                },
                args: [{name, code, worldToken, modules}],
                world: "MAIN"
            })
            return frame
            
        }
    }

    const toDo = method[action]
    ;(async() => {
        try {
            const res = await toDo(content)
            sendResponse(res)
        }
        catch(error) {
            console.log("ERROR", error)
            sendResponse("ERROR")
        }
    })()
    return true
})