/**
 * Safely executes JavaScript code in a Web Worker to prevent freezing the main thread.
 * Supports infinite loop protection via timeout (TLE).
 * Simulates basic Node.js environment (readline, console).
 */
export const executeCode = (code, stdin = "", timeoutMs = 3000) => {
    return new Promise((resolve, reject) => {
        // Create the worker script as a Blob
        const workerScript = `
            self.onmessage = function(e) {
                const { code, stdin } = e.data;
                let output = "";
                
                // Mocks to capture output
                const console = {
                    log: (...args) => { 
                        output += args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ") + "\\n"; 
                    },
                    error: (...args) => { 
                        output += "Error: " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ") + "\\n"; 
                    },
                    warn: (...args) => { 
                        output += "Warning: " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ") + "\\n"; 
                    }
                };

                // Mock process.stdout/stdin
                const process = {
                    stdin: {},
                    stdout: {
                        write: (str) => { output += str; }
                    }
                };

                // Mock require('readline') for standard CP templates
                const require = (module) => {
                    if (module === 'readline') {
                        return {
                            createInterface: ({ input }) => {
                                return {
                                    on: (event, callback) => {
                                        if (event === 'line') {
                                            // Split stdin by lines and feed them synchronously
                                            const lines = stdin.split('\\n');
                                            lines.forEach(line => {
                                                if(line.trim() !== '') callback(line);
                                            });
                                        }
                                        if (event === 'close') {
                                            // Optional: callback();
                                        }
                                        return this;
                                    }
                                };
                            }
                        };
                    }
                    if (module === 'fs') return { readFileSync: () => stdin }; // Mock fs for completeness
                    return {};
                };

                try {
                    // Wrap in strict mode to prevent leaking globals
                    const func = new Function('require', 'process', 'console', '"use strict";' + code);
                    func(require, process, console);
                    
                    self.postMessage({ success: true, output });
                } catch (err) {
                    self.postMessage({ success: false, error: err.toString() });
                }
            };
        `;

        const blob = new Blob([workerScript], { type: "application/javascript" });
        const worker = new Worker(URL.createObjectURL(blob));

        let timer;

        // Success handler
        worker.onmessage = (e) => {
            clearTimeout(timer);
            worker.terminate();
            if (e.data.success) {
                resolve({ run: { output: e.data.output, code: 0 } });
            } else {
                resolve({ run: { output: e.data.error, code: 1 } });
            }
        };

        // Error handler (worker error)
        worker.onerror = (e) => {
            clearTimeout(timer);
            worker.terminate();
            resolve({ run: { output: "Runtime Error: " + e.message, code: 1 } });
        };

        // Start execution
        worker.postMessage({ code, stdin });

        // TLE Timer
        timer = setTimeout(() => {
            worker.terminate();
            resolve({ run: { output: "Time Limit Exceeded (3000ms)", code: 1 } });
        }, timeoutMs);
    });
};
