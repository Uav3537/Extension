console.log("✅ background.js loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const {action, content} = message

    console.log(`message handling: ${action} `, content)
    
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
        insertScript: async({name, code, worldToken, modules}) => {
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
                                new Function(text)();
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

                    const scriptContent = 
                        'console.log("✅ " + ' + JSON.stringify(name) + ' + " loaded");\n' +
                        'const fileName = ' + JSON.stringify(name) + ';\n' +
                        'const worldToken = ' + JSON.stringify(worldToken) + ';\n' +
                        '(async() => {\n' +
                        '    try {\n' +
                            (modules.length > 0 ? 
                                'const mods = await Promise.all(' + JSON.stringify(modules) + '.map(m => import(m)));\n' +
                                'const p = Object.assign({}, ...mods.map(m => m.default || m));\n' : 
                                'const p = {};\n') +
                        '    ' + code + '\n' + 
                        '    } catch(e) { console.error("[" + fileName + " Error]", e); }\n' +
                        '})();';

                    for (const [methodName, execute] of Object.entries(inject)) {
                        console.log(`[Injection] ✏️  Trying <Type: ${methodName}>...`);
                        try {
                            await execute(scriptContent);
                            console.log(`[Injection] ✅ Success with <Type: ${methodName}>`);
                            break;
                        } catch (error) {
                            console.warn(`[Injection] 🚫 Failed with <Type: ${methodName}>, trying next...`);
                        }
                    }
                },
                args: [{name, code, worldToken, modules}],
                world: "MAIN"
            })
            return frame
        },
        insertStyle: async({name, code}) => {
            const frame = await chrome.scripting.executeScript({
                target: { tabId: sender.tab.id },
                func: async({name, code, }) => {
                    const target = document.head || document.documentElement;

                    const inject = {
                        adopted: (text) => {
                            try {
                                const sheet = new CSSStyleSheet();
                                sheet.replaceSync(text);
                                document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
                                return Promise.resolve();
                            } catch (e) {
                                return Promise.reject(new Error("Unsupported: AdoptedStyleSheets"));
                            }
                        },
                        blob: (text) => new Promise((resolve, reject) => {
                            const link = document.createElement('link');
                            link.rel = 'stylesheet';
                            link.dataset.injected = name;
                            const blob = new Blob([text], { type: 'text/css' });
                            const url = URL.createObjectURL(blob);
                            link.href = url;
                            
                            link.onload = () => {
                                URL.revokeObjectURL(url);
                                resolve();
                            };
                            link.onerror = () => reject(new Error("CSP Blocked: Blob"));
                            target.appendChild(link);
                        }),
                        inline: (text) => {
                            try {
                                const style = document.createElement('style');
                                style.dataset.injected = name;
                                style.textContent = text;
                                target.appendChild(style);
                                return Promise.resolve();
                            } catch (e) {
                                return Promise.reject(new Error("CSP Blocked: Inline"));
                            }
                        },
                        link: (text) => {
                            const style = document.createElement('style');
                            style.innerHTML = text;
                            target.appendChild(style);
                            return Promise.resolve();
                        },
                    };

                    for(const [methodName, execute] of Object.entries(inject)) {
                        console.log(`[Injection] ✏️  Trying <Type: ${methodName}>...`);
                        try {
                            await execute(code);
                            console.log(`[Injection] ✅  Success with <Type: ${methodName}>`);
                            break;
                        } catch(error) {
                            console.warn(`[Injection] 🚫  Failed with <Type: ${methodName}>, trying next...`);
                        }
                    }
                },
                args: [{name, code}],
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

chrome.declarativeNetRequest.getDynamicRules(console.log);

chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        "id": 1,
        "priority": 1,
        "action": {
          "type": "modifyHeaders",
          "responseHeaders": [
            { "header": "content-security-policy", "operation": "remove" },
            { "header": "x-webkit-csp", "operation": "remove" }
          ]
        },
        "condition": {
          "urlFilter": "*", 
          "resourceTypes": ["main_frame", "sub_frame", "xmlhttprequest", "script"]
        }
      }
    ],
    removeRuleIds: [100]
});