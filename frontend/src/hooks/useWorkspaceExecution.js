import { useState, useCallback, useRef } from "react";
import { API_URL } from "../config";
import { executeCode } from "../utils/execution";
import { generateCppRunner } from "../utils/cppRunner";
import { generateJavaRunner } from "../utils/javaRunner";
import { generatePythonRunner } from "../utils/pythonRunner";

export function useWorkspaceExecution({ user, activeFile, activeCodeRef, rightPanel, input, id, socket, setLogs, setAuthModalOpen, setConsoleOpen }) {
    const [isRunning, setIsRunning] = useState(false);
    const [isRunningTests, setIsRunningTests] = useState(false);

    const abortControllerRef = useRef(null);

    const handleCancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            if (setLogs) {
                setLogs(prev => [...prev, { type: "warning", message: "Execution cancelled by user." }]);
            }
        }
    }, [setLogs]);

    // Support Test Cases state
    const [testCases, setTestCases] = useState(() => {
        try {
            const saved = localStorage.getItem("testCases");
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.map((tc, i) => ({
                    ...tc,
                    id: tc.id || Date.now() + i
                }));
            }
            return [];
        } catch { return []; }
    });

    // Auto-Runner Injection
    const getCodeWithRunner = () => {
        let codeToRun = activeCodeRef.current;
        if (!activeFile) return codeToRun;

        if (activeFile.language === "cpp" && codeToRun.includes("class Solution") && !codeToRun.includes("int main")) {
            if (rightPanel?.data) codeToRun = generateCppRunner(codeToRun, rightPanel.data);
            else setLogs?.(prev => [...prev, { type: "warning", message: "Warning: Problem description (Right Panel) is closed. Auto-runner might fail." }]);
        }
        if (activeFile.language === "java" && codeToRun.includes("class Solution") && !codeToRun.includes("public static void main")) {
            if (rightPanel?.data) codeToRun = generateJavaRunner(codeToRun, rightPanel.data);
            else setLogs?.(prev => [...prev, { type: "warning", message: "Warning: Problem description (Right Panel) is closed. Auto-runner might fail." }]);
        }
        if (activeFile.language === "python" && codeToRun.includes("class Solution") && !codeToRun.includes("if __name__")) {
            if (rightPanel?.data) codeToRun = generatePythonRunner(codeToRun, rightPanel.data);
            else setLogs?.(prev => [...prev, { type: "warning", message: "Warning: Problem description (Right Panel) is closed. Auto-runner might fail." }]);
        }
        return codeToRun;
    };

    const handleRun = useCallback(async () => {
        if (!user) { setAuthModalOpen(true); return; }
        if (!activeFile) return;

        setConsoleOpen(true);
        setIsRunning(true);
        setLogs([{ type: "info", message: "Compiling..." }]);

        // Sync to room
        if (id && socket) {
            socket.emit("sync_run_trigger", { roomId: id, username: user.username });
        }

        const codeToRun = getCodeWithRunner();

        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        try {
            let data;
            // CLIENT-SIDE EXECUTION FOR JS
            if (activeFile.language === "javascript") {
                setLogs(prev => [...prev, { type: "info", message: "Running in browser (Web Worker)..." }]);
                data = await executeCode(codeToRun, input);
            } else {
                const token = localStorage.getItem("codeplay_token");
                const res = await fetch(`${API_URL}/api/code/execute`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        language: activeFile.language,
                        code: codeToRun,
                        stdin: input
                    }),
                    signal
                });

                if (!res.ok) {
                    const errBody = await res.json().catch(() => ({}));
                    throw new Error(errBody.error || `Server error (${res.status})`);
                }
                data = await res.json();
            }

            let newLogs;
            if (data.compile && data.compile.code !== 0) {
                newLogs = [{ type: "error", message: `Compilation Error:\n${data.compile.output || data.compile.stderr}` }];
            } else if (data.run && data.run.code !== 0) {
                newLogs = [{ type: "error", message: `Runtime Error:\n${data.run.output || data.run.stderr}` }];
            } else {
                const outStr = data.run?.stdout || data.run?.output || "Execution finished successfully.";
                newLogs = [{ type: "log", message: outStr }];
            }

            setLogs(prev => [...prev, ...newLogs]);

            if (id && socket) socket.emit("sync_run_result", { roomId: id, logs: newLogs });

        } catch (err) {
            if (err.name === 'AbortError') {
                setIsRunning(false);
                return; // Already logged in handleCancel
            }
            const errorLog = [{ type: "error", message: err.message || "Server Error." }];
            setLogs(prev => [...prev, ...errorLog]);
            if (id && socket) socket.emit("sync_run_result", { roomId: id, logs: errorLog });
        }
        finally {
            setIsRunning(false);
            abortControllerRef.current = null;
        }
    }, [user, activeFile, id, rightPanel, input, socket, setLogs, setConsoleOpen, setAuthModalOpen, activeCodeRef]);

    const runTests = useCallback(async () => {
        if (!activeFile) return;
        if (!user) { setAuthModalOpen(true); return; }

        setIsRunningTests(true);
        const codeToRun = getCodeWithRunner();

        const token = localStorage.getItem("codeplay_token");

        // Run all tests sequentially or in parallel?
        // Wait for them all to complete to update status
        const updatedTests = [...testCases];

        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        for (let i = 0; i < updatedTests.length; i++) {
            if (abortControllerRef.current?.signal.aborted) {
                updatedTests[i] = { ...updatedTests[i], status: 'error', error: 'Cancelled' };
                continue;
            }

            const test = updatedTests[i];
            try {
                let stdout = "";
                if (activeFile.language === "javascript") {
                    const runRes = await executeCode(codeToRun, test.input);
                    if (runRes.run && runRes.run.output) {
                        stdout = runRes.run.output;
                    }
                } else {
                    const res = await fetch(`${API_URL}/api/code/execute`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            language: activeFile.language,
                            code: codeToRun,
                            stdin: test.input
                        }),
                        signal
                    });

                    if (!res.ok) throw new Error("Execution failed");
                    const data = await res.json();

                    if (data.compile && data.compile.code !== 0) {
                        stdout = data.compile.output || data.compile.stderr || "Compilation Error";
                    } else if (data.run && data.run.code !== 0) {
                        stdout = data.run.output || data.run.stderr || "Runtime Error";
                    } else if (data.run) {
                        stdout = data.run.stdout || data.run.output || "";
                    }
                }

                const actual = stdout.trim();
                const expected = test.expectedOutput.trim();
                updatedTests[i] = {
                    ...test,
                    actualOutput: actual,
                    passed: actual === expected,
                    status: 'completed'
                };

            } catch (err) {
                if (err.name === 'AbortError') {
                    updatedTests[i] = { ...test, status: 'error', error: 'Cancelled' };
                    break;
                }
                updatedTests[i] = {
                    ...test,
                    status: 'error',
                    error: err.message
                };
            }
        }

        setTestCases([...updatedTests]);
        setIsRunningTests(false);
        abortControllerRef.current = null;

    }, [user, activeFile, testCases, setAuthModalOpen, activeCodeRef, rightPanel]);

    return {
        isRunning,
        isRunningTests,
        testCases, setTestCases,
        handleRun,
        runTests,
        handleCancel
    };
}
