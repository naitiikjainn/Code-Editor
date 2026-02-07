import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

// Language configuration
const LANG_CONFIG = {
    cpp: { ext: "cpp", image: "cses-judge-cpp" },
    "c++": { ext: "cpp", image: "cses-judge-cpp" },
    python: { ext: "py", image: "cses-judge-python" },
    python3: { ext: "py", image: "cses-judge-python" },
    java: { ext: "java", image: "cses-judge-java" },
    javascript: { ext: "js", image: "cses-judge-cpp" }, // Uses Node in cpp image (Alpine)
};

// Normalize language to internal key
function normalizeLang(lang) {
    const lower = (lang || "").toLowerCase().trim();
    if (lower === "c++" || lower === "cpp" || lower === "c++17" || lower === "c++14") return "cpp";
    if (lower.startsWith("python")) return "python";
    if (lower === "java") return "java";
    if (lower === "javascript" || lower === "js" || lower === "node") return "javascript";
    return lower;
}

/**
 * Check if Docker is available
 */
export async function isDockerAvailable() {
    return new Promise((resolve) => {
        execFile("docker", ["info"], { timeout: 5000 }, (err) => {
            resolve(!err);
        });
    });
}

/**
 * Check if a Docker image exists locally (cached per image name)
 */
const imageCache = new Map();
async function imageExists(imageName) {
    if (imageCache.has(imageName)) return imageCache.get(imageName);
    const result = await new Promise((resolve) => {
        execFile("docker", ["image", "inspect", imageName], { timeout: 3000 }, (err) => {
            resolve(!err);
        });
    });
    imageCache.set(imageName, result);
    // Re-check after 60s in case images were added/removed
    setTimeout(() => imageCache.delete(imageName), 60000);
    return result;
}

/**
 * Execute user code against a single test case in a Docker sandbox.
 *
 * @param {Object} options
 * @param {string} options.code - User source code
 * @param {string} options.language - Programming language
 * @param {string} options.input - Test case input
 * @param {number} options.timeLimit - Time limit in seconds (e.g. 1.0)
 * @param {number} options.memoryLimit - Memory limit in MB (e.g. 256)
 * @returns {Promise<{ verdict: string, stdout: string, stderr: string, time: number, exitCode: string }>}
 */
export async function execute({ code, language, input, timeLimit = 2, memoryLimit = 256 }) {
    const lang = normalizeLang(language);
    const config = LANG_CONFIG[lang];

    if (!config) {
        return { verdict: "CE", stdout: "", stderr: `Unsupported language: ${language}`, time: 0, exitCode: "CE" };
    }

    // Create isolated temp directory
    const tmpId = crypto.randomBytes(8).toString("hex");
    const tmpDir = path.join(os.tmpdir(), `cses-judge-${tmpId}`);
    const outputDir = path.join(tmpDir, "output");

    try {
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.mkdirSync(outputDir, { recursive: true });

        // Write source code
        const sourceFile = `solution.${config.ext}`;
        fs.writeFileSync(path.join(tmpDir, sourceFile), code);

        // Write input
        fs.writeFileSync(path.join(tmpDir, "input.txt"), input);

        // Check if Docker image exists
        const hasImage = await imageExists(config.image);
        if (!hasImage) {
            // Fall back to direct execution without Docker
            return await executeWithoutDocker({ code, lang, config, input, timeLimit, tmpDir, outputDir });
        }

        // Build docker run command
        // Add extra time buffer for compilation (especially Java)
        const dockerTimeout = Math.ceil(timeLimit * 2 + 10);
        const args = [
            "run", "--rm",
            "--network=none",                          // No internet
            `--memory=${memoryLimit}m`,                 // Memory limit
            "--memory-swap=" + memoryLimit + "m",       // No swap
            "--cpus=1",                                 // 1 CPU
            "--pids-limit=64",                          // Prevent fork bombs
            "--read-only",                              // Read-only root filesystem
            "--tmpfs", "/tmp:rw,size=64m,exec",         // Writable /tmp with exec
            "-v", `${tmpDir}:/workspace:ro`,            // Mount source code (read-only)
            "-v", `${outputDir}:/output:rw`,            // Mount output directory
            config.image,                               // Image name
            lang,                                       // Language arg
            String(Math.ceil(timeLimit))                 // Time limit arg
        ];

        const startTime = Date.now();

        const result = await new Promise((resolve) => {
            const proc = execFile("docker", args, {
                timeout: dockerTimeout * 1000,
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            }, (err, stdout, stderr) => {
                const elapsed = Date.now() - startTime;

                if (err && err.killed) {
                    // Process was killed (timeout at docker level)
                    resolve({ verdict: "TLE", stdout: "", stderr: "Docker execution timed out", time: elapsed, exitCode: "TLE" });
                    return;
                }

                // Read output files
                let userStdout = "", userStderr = "", exitCode = "OK";
                try {
                    userStdout = fs.readFileSync(path.join(outputDir, "stdout.txt"), "utf-8");
                } catch { }
                try {
                    userStderr = fs.readFileSync(path.join(outputDir, "stderr.txt"), "utf-8");
                } catch { }
                try {
                    exitCode = fs.readFileSync(path.join(outputDir, "exitcode.txt"), "utf-8").trim();
                } catch { }

                // Map exit code to verdict
                let verdict;
                switch (exitCode) {
                    case "OK": verdict = "OK"; break;
                    case "TLE": verdict = "TLE"; break;
                    case "MLE": verdict = "MLE"; break;
                    case "CE": verdict = "CE"; break;
                    case "RE": verdict = "RE"; break;
                    default: verdict = err ? "RE" : "OK";
                }

                resolve({ verdict, stdout: userStdout, stderr: userStderr, time: elapsed, exitCode });
            });
        });

        return result;
    } finally {
        // Cleanup temp directory
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Fallback execution without Docker (for development or when Docker isn't available).
 * Uses child_process with basic timeout. Less secure but functional.
 */
async function executeWithoutDocker({ code, lang, config, input, timeLimit, tmpDir, outputDir }) {
    console.warn("[Judge] Docker image not found, falling back to direct execution");

    const sourceFile = path.join(tmpDir, `solution.${config.ext}`);
    const startTime = Date.now();

    try {
        if (lang === "cpp") {
            // Compile
            // Use c++14 by default (MinGW 8.x has broken <filesystem> in c++17 mode with bits/stdc++.h)
            const exeName = process.platform === "win32" ? "sol.exe" : "sol";
            const compileResult = await runProcess("g++", ["-O2", "-std=c++14", "-o", path.join(tmpDir, exeName), sourceFile], { timeout: 15000 });
            if (compileResult.exitCode !== 0) {
                console.error(`[Judge] C++ compilation failed (exit ${compileResult.exitCode}):\n  cmd: g++ -O2 -std=c++14 -o ${path.join(tmpDir, exeName)} ${sourceFile}\n  stderr: ${compileResult.stderr}`);
                return { verdict: "CE", stdout: "", stderr: compileResult.stderr, time: Date.now() - startTime, exitCode: "CE" };
            }
            // Run
            const runResult = await runProcess(path.join(tmpDir, exeName), [], { timeout: timeLimit * 1000 + 1000, input });
            return formatResult(runResult, startTime);
        }

        if (lang === "python") {
            const runResult = await runProcess("python3", [sourceFile], { timeout: timeLimit * 1000 + 1000, input });
            // Try python if python3 not found
            if (runResult.exitCode === 127) {
                const runResult2 = await runProcess("python", [sourceFile], { timeout: timeLimit * 1000 + 1000, input });
                return formatResult(runResult2, startTime);
            }
            return formatResult(runResult, startTime);
        }

        if (lang === "java") {
            fs.copyFileSync(sourceFile, path.join(tmpDir, "Main.java"));
            const compileResult = await runProcess("javac", [path.join(tmpDir, "Main.java")], { timeout: 15000 });
            if (compileResult.exitCode !== 0) {
                return { verdict: "CE", stdout: "", stderr: compileResult.stderr, time: Date.now() - startTime, exitCode: "CE" };
            }
            const runResult = await runProcess("java", ["-cp", tmpDir, "Main"], { timeout: timeLimit * 1000 + 2000, input });
            return formatResult(runResult, startTime);
        }

        if (lang === "javascript") {
            const runResult = await runProcess("node", [sourceFile], { timeout: timeLimit * 1000 + 1000, input });
            return formatResult(runResult, startTime);
        }

        return { verdict: "CE", stdout: "", stderr: `Unsupported language: ${lang}`, time: 0, exitCode: "CE" };
    } catch (err) {
        return { verdict: "RE", stdout: "", stderr: err.message, time: Date.now() - startTime, exitCode: "RE" };
    }
}

function formatResult(runResult, startTime) {
    const elapsed = Date.now() - startTime;
    if (runResult.killed) {
        return { verdict: "TLE", stdout: runResult.stdout || "", stderr: "Time limit exceeded", time: elapsed, exitCode: "TLE" };
    }
    if (runResult.exitCode !== 0) {
        return { verdict: "RE", stdout: runResult.stdout || "", stderr: runResult.stderr || "", time: elapsed, exitCode: "RE" };
    }
    return { verdict: "OK", stdout: runResult.stdout || "", stderr: runResult.stderr || "", time: elapsed, exitCode: "OK" };
}

function runProcess(cmd, args, options = {}) {
    return new Promise((resolve) => {
        try {
            const proc = execFile(cmd, args, {
                timeout: options.timeout || 10000,
                maxBuffer: 10 * 1024 * 1024,
                env: { ...process.env, PATH: process.env.PATH },
            }, (err, stdout, stderr) => {
                if (err && err.code === "ENOENT") {
                    resolve({
                        stdout: "",
                        stderr: `Command not found: ${cmd}. Make sure it is installed and in PATH.`,
                        exitCode: "ENOENT",
                        killed: false,
                    });
                    return;
                }
                resolve({
                    stdout: stdout || "",
                    stderr: stderr || (err ? err.message : ""),
                    exitCode: err ? (typeof err.code === "number" ? err.code : 1) : 0,
                    killed: err?.killed || false,
                });
            });

            if (options.input && proc.stdin) {
                proc.stdin.write(options.input);
                proc.stdin.end();
            }
        } catch (spawnErr) {
            resolve({
                stdout: "",
                stderr: spawnErr.code === "ENOENT"
                    ? `Command not found: ${cmd}. Make sure it is installed and in PATH.`
                    : spawnErr.message,
                exitCode: spawnErr.code || 1,
                killed: false,
            });
        }
    });
}

/**
 * Execute user code against multiple test cases with a single compilation step.
 * Compiles once, runs for each input. Much faster than calling execute() in a loop.
 *
 * @param {Object} options
 * @param {string} options.code - User source code
 * @param {string} options.language - Programming language
 * @param {Array<{testNumber: number, input: string}>} options.inputs - Test case inputs
 * @param {number} options.timeLimit - Time limit in seconds per test
 * @param {number} options.memoryLimit - Memory limit in MB
 * @param {Function} [options.onTestComplete] - Callback(testNumber, result) called after each test
 * @param {Function} [options.shouldStop] - Callback() returning true to stop after current test
 * @returns {Promise<Array<{ verdict: string, stdout: string, stderr: string, time: number, exitCode: string, testNumber: number }>>}
 */
export async function executeBatch({ code, language, inputs, timeLimit = 2, memoryLimit = 256, onTestComplete, shouldStop }) {
    const lang = normalizeLang(language);
    const config = LANG_CONFIG[lang];

    if (!config) {
        return inputs.map(inp => {
            const r = { verdict: "CE", stdout: "", stderr: `Unsupported language: ${language}`, time: 0, exitCode: "CE", testNumber: inp.testNumber };
            onTestComplete?.(inp.testNumber, r);
            return r;
        });
    }

    const tmpId = crypto.randomBytes(8).toString("hex");
    const tmpDir = path.join(os.tmpdir(), `cses-batch-${tmpId}`);

    try {
        fs.mkdirSync(tmpDir, { recursive: true });
        const sourceFile = path.join(tmpDir, `solution.${config.ext}`);
        fs.writeFileSync(sourceFile, code);

        const hasImage = await imageExists(config.image);
        if (!hasImage) {
            return await executeBatchWithoutDocker({ lang, config, sourceFile, inputs, timeLimit, tmpDir, onTestComplete, shouldStop });
        }

        // Docker path: write source once, run docker per test (avoids re-writing files)
        return await executeBatchWithDocker({ lang, config, tmpDir, inputs, timeLimit, memoryLimit, onTestComplete, shouldStop });
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Batch execution without Docker — compile once, run many.
 */
async function executeBatchWithoutDocker({ lang, config, sourceFile, inputs, timeLimit, tmpDir, onTestComplete, shouldStop }) {
    console.warn("[Judge] Docker image not found, using batch direct execution (compile once)");
    const results = [];
    let runCmd, runArgs;

    // === COMPILE ONCE ===
    if (lang === "cpp") {
        const exeName = process.platform === "win32" ? "sol.exe" : "sol";
        const exePath = path.join(tmpDir, exeName);
        const compileResult = await runProcess("g++", ["-O2", "-std=c++14", "-o", exePath, sourceFile], { timeout: 15000 });
        if (compileResult.exitCode !== 0) {
            console.error(`[Judge] C++ compilation failed:\n  stderr: ${compileResult.stderr}`);
            return inputs.map(inp => {
                const r = { verdict: "CE", stdout: "", stderr: compileResult.stderr, time: 0, exitCode: "CE", testNumber: inp.testNumber };
                onTestComplete?.(inp.testNumber, r);
                return r;
            });
        }
        console.log("[Judge] C++ compiled successfully, running tests...");
        runCmd = exePath;
        runArgs = [];
    } else if (lang === "java") {
        fs.copyFileSync(sourceFile, path.join(tmpDir, "Main.java"));
        const compileResult = await runProcess("javac", [path.join(tmpDir, "Main.java")], { timeout: 15000 });
        if (compileResult.exitCode !== 0) {
            console.error(`[Judge] Java compilation failed:\n  stderr: ${compileResult.stderr}`);
            return inputs.map(inp => {
                const r = { verdict: "CE", stdout: "", stderr: compileResult.stderr, time: 0, exitCode: "CE", testNumber: inp.testNumber };
                onTestComplete?.(inp.testNumber, r);
                return r;
            });
        }
        console.log("[Judge] Java compiled successfully, running tests...");
        runCmd = "java";
        runArgs = ["-cp", tmpDir, "Main"];
    } else if (lang === "python") {
        // Check if python3 is available first
        const checkResult = await runProcess("python3", ["--version"], { timeout: 3000 });
        if (checkResult.exitCode === "ENOENT") {
            runCmd = "python";
        } else {
            runCmd = "python3";
        }
        runArgs = [sourceFile];
    } else if (lang === "javascript") {
        runCmd = "node";
        runArgs = [sourceFile];
    } else {
        return inputs.map(inp => {
            const r = { verdict: "CE", stdout: "", stderr: `Unsupported language: ${lang}`, time: 0, exitCode: "CE", testNumber: inp.testNumber };
            onTestComplete?.(inp.testNumber, r);
            return r;
        });
    }

    // === RUN EACH TEST ===
    for (const inp of inputs) {
        if (shouldStop?.()) break; // Early termination on failure
        const startTime = Date.now();
        const runResult = await runProcess(runCmd, runArgs, {
            timeout: timeLimit * 1000 + 1000,
            input: inp.input,
        });
        const result = { ...formatResult(runResult, startTime), testNumber: inp.testNumber };
        results.push(result);
        onTestComplete?.(inp.testNumber, result);
    }

    return results;
}

/**
 * Batch execution with Docker — write source once, run docker per test.
 * (Each docker run is isolated, so we can't easily share a compiled binary across containers,
 * but we at least avoid re-creating temp dirs and re-writing source code.)
 */
async function executeBatchWithDocker({ lang, config, tmpDir, inputs, timeLimit, memoryLimit, onTestComplete, shouldStop }) {
    const results = [];

    for (const inp of inputs) {
        if (shouldStop?.()) break; // Early termination on failure

        // Write this test's input
        fs.writeFileSync(path.join(tmpDir, "input.txt"), inp.input);

        // Ensure clean output directory for each test
        const outputDir = path.join(tmpDir, "output");
        try { fs.rmSync(outputDir, { recursive: true, force: true }); } catch {}
        fs.mkdirSync(outputDir, { recursive: true });

        const dockerTimeout = Math.ceil(timeLimit * 2 + 10);
        const args = [
            "run", "--rm",
            "--network=none",
            `--memory=${memoryLimit}m`,
            "--memory-swap=" + memoryLimit + "m",
            "--cpus=1",
            "--pids-limit=64",
            "--read-only",
            "--tmpfs", "/tmp:rw,size=64m,exec",
            "-v", `${tmpDir}:/workspace:ro`,
            "-v", `${outputDir}:/output:rw`,
            config.image,
            lang,
            String(Math.ceil(timeLimit))
        ];

        const startTime = Date.now();

        const result = await new Promise((resolve) => {
            execFile("docker", args, {
                timeout: dockerTimeout * 1000,
                maxBuffer: 10 * 1024 * 1024,
            }, (err) => {
                const elapsed = Date.now() - startTime;

                if (err && err.killed) {
                    resolve({ verdict: "TLE", stdout: "", stderr: "Docker execution timed out", time: elapsed, exitCode: "TLE", testNumber: inp.testNumber });
                    return;
                }

                let userStdout = "", userStderr = "", exitCode = "OK";
                try { userStdout = fs.readFileSync(path.join(outputDir, "stdout.txt"), "utf-8"); } catch {}
                try { userStderr = fs.readFileSync(path.join(outputDir, "stderr.txt"), "utf-8"); } catch {}
                try { exitCode = fs.readFileSync(path.join(outputDir, "exitcode.txt"), "utf-8").trim(); } catch {}

                let verdict;
                switch (exitCode) {
                    case "OK": verdict = "OK"; break;
                    case "TLE": verdict = "TLE"; break;
                    case "MLE": verdict = "MLE"; break;
                    case "CE": verdict = "CE"; break;
                    case "RE": verdict = "RE"; break;
                    default: verdict = err ? "RE" : "OK";
                }

                resolve({ verdict, stdout: userStdout, stderr: userStderr, time: elapsed, exitCode, testNumber: inp.testNumber });
            });
        });

        results.push(result);
        onTestComplete?.(inp.testNumber, result);
    }

    return results;
}

/**
 * Compare user output with expected output.
 * Trims trailing whitespace/newlines from each line and end.
 *
 * @param {string} userOutput
 * @param {string} expectedOutput
 * @returns {boolean}
 */
export function compareOutput(userOutput, expectedOutput) {
    const normalize = (s) =>
        s.split("\n")
            .map(line => line.trimEnd())
            .join("\n")
            .trimEnd();

    return normalize(userOutput) === normalize(expectedOutput);
}

export default { execute, executeBatch, compareOutput, isDockerAvailable };
