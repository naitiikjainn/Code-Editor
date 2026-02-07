import { createWorker } from "../utils/jobQueue.js";
import { getTestCases } from "../services/csesTestCaseService.js";
import { execute, compareOutput } from "../services/dockerJudge.js";
import Submission from "../models/Submission.js";
import CSESProgress from "../models/CSESProgress.js";

let ioInstance = null;

/**
 * Set the Socket.IO instance for emitting real-time progress.
 */
export function setIO(io) {
    ioInstance = io;
}

/**
 * Emit event to a specific user via Socket.IO.
 */
function emitToUser(userId, event, data) {
    if (ioInstance && userId) {
        ioInstance.to(`user:${userId}`).emit(event, data);
    }
}

/**
 * Truncate a string to maxLen characters.
 */
function truncate(str, maxLen = 500) {
    if (!str) return "";
    return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
}

/**
 * CSES Judge Worker processor.
 * Processes a single submission: downloads test cases, runs code against each,
 * and updates submission + progress.
 */
async function processCSESJudge(job) {
    const { submissionId, taskId, code, language, timeLimit, memoryLimit, userId } = job.data;

    console.log(`[CSES Judge] Processing submission ${submissionId} for task ${taskId}`);

    try {
        // 1. Get test cases
        let testCases;
        try {
            testCases = await getTestCases(taskId);
        } catch (err) {
            console.error(`[CSES Judge] Failed to get test cases for task ${taskId}:`, err.message);
            const errorMsg = "Failed to load test cases: " + err.message;
            await Submission.findByIdAndUpdate(submissionId, {
                verdict: "Judge Error",
                judgeResult: {
                    totalTests: 0, passedTests: 0,
                    testResults: [],
                }
            });
            emitToUser(userId, "cses:judge:result", {
                submissionId, verdict: "Judge Error",
                judgeResult: { totalTests: 0, passedTests: 0, error: errorMsg }
            });
            return { success: false, error: err.message };
        }

        const totalTests = testCases.length;
        let passedTests = 0;
        let firstFailed = null;
        let maxTime = 0;
        const testResults = [];

        // Emit initial progress
        emitToUser(userId, "cses:judge:progress", {
            submissionId, testNumber: 0, totalTests, verdict: "Judging", passed: 0
        });

        // 2. Run each test case sequentially
        for (const tc of testCases) {
            const result = await execute({
                code,
                language,
                input: tc.input,
                timeLimit: timeLimit || 1,
                memoryLimit: memoryLimit || 256,
            });

            let testVerdict;
            if (result.verdict === "CE") {
                testVerdict = "CE";
                console.error(`[CSES Judge] Compilation Error for submission ${submissionId}:\n${result.stderr}`);
            } else if (result.verdict === "TLE") {
                testVerdict = "TLE";
            } else if (result.verdict === "MLE") {
                testVerdict = "MLE";
            } else if (result.verdict === "RE") {
                testVerdict = "RE";
            } else if (result.verdict === "OK") {
                // Compare output
                testVerdict = compareOutput(result.stdout, tc.expectedOutput) ? "AC" : "WA";
            } else {
                testVerdict = "RE";
            }

            const testResult = {
                testNumber: tc.testNumber,
                verdict: testVerdict,
                time: result.time,
                stderr: result.stderr || "",
            };
            testResults.push(testResult);
            maxTime = Math.max(maxTime, result.time);

            if (testVerdict === "AC") {
                passedTests++;
            } else if (!firstFailed) {
                firstFailed = {
                    testNumber: tc.testNumber,
                    input: truncate(tc.input),
                    expected: truncate(tc.expectedOutput),
                    actual: truncate(result.stdout),
                    stderr: truncate(result.stderr, 1000),
                    verdict: testVerdict,
                };
            }

            // Emit per-test progress
            emitToUser(userId, "cses:judge:progress", {
                submissionId,
                testNumber: tc.testNumber,
                totalTests,
                verdict: testVerdict,
                passed: passedTests,
                time: result.time,
            });

            // Stop on first failure (CE always stops)
            if (testVerdict === "CE") break;
            if (testVerdict !== "AC") break; // Stop on first non-AC
        }

        // 3. Determine final verdict
        let finalVerdict;
        if (testResults.length > 0 && testResults[0].verdict === "CE") {
            finalVerdict = "Compilation Error";
        } else if (passedTests === totalTests) {
            finalVerdict = "Accepted";
        } else if (firstFailed) {
            const verdictMap = { WA: "Wrong Answer", TLE: "Time Limit Exceeded", MLE: "Memory Limit Exceeded", RE: "Runtime Error" };
            finalVerdict = verdictMap[firstFailed.verdict] || "Wrong Answer";
        } else {
            finalVerdict = "Wrong Answer";
        }

        // 4. Update submission in DB
        const judgeResult = {
            totalTests,
            passedTests,
            firstFailedTest: firstFailed?.testNumber || null,
            firstFailedInput: firstFailed?.input || null,
            firstFailedExpected: firstFailed?.expected || null,
            firstFailedActual: firstFailed?.actual || null,
            firstFailedStderr: firstFailed?.stderr || null,
            executionTime: maxTime,
            testResults,
        };

        await Submission.findByIdAndUpdate(submissionId, {
            verdict: finalVerdict,
            judgeResult,
        });

        // 5. Update CSES progress
        try {
            const isSolved = finalVerdict === "Accepted";
            const existing = await CSESProgress.findOne({ userId, taskId });

            if (existing) {
                existing.attempts += 1;
                existing.lastAttempt = new Date();
                if (isSolved && existing.status !== "solved") {
                    existing.status = "solved";
                    existing.solvedAt = new Date();
                    existing.bestSubmission = submissionId;
                }
                await existing.save();
            } else {
                await CSESProgress.create({
                    userId,
                    taskId,
                    status: isSolved ? "solved" : "attempted",
                    attempts: 1,
                    solvedAt: isSolved ? new Date() : null,
                    bestSubmission: isSolved ? submissionId : null,
                    lastAttempt: new Date(),
                });
            }
        } catch (err) {
            console.error(`[CSES Judge] Failed to update progress for user ${userId}, task ${taskId}:`, err.message);
        }

        // 6. Emit final result
        emitToUser(userId, "cses:judge:result", {
            submissionId,
            verdict: finalVerdict,
            judgeResult,
        });

        console.log(`[CSES Judge] Submission ${submissionId}: ${finalVerdict} (${passedTests}/${totalTests})`);
        return { success: true, verdict: finalVerdict, passedTests, totalTests };

    } catch (err) {
        console.error(`[CSES Judge] Unexpected error for submission ${submissionId}:`, err);

        await Submission.findByIdAndUpdate(submissionId, {
            verdict: "Judge Error",
            judgeResult: { totalTests: 0, passedTests: 0, testResults: [] },
        });

        emitToUser(userId, "cses:judge:result", {
            submissionId,
            verdict: "Judge Error",
            judgeResult: { totalTests: 0, passedTests: 0, error: err.message },
        });

        throw err; // Let BullMQ handle retries
    }
}

/**
 * Initialize the CSES judge worker.
 */
export function initCSESJudgeWorker() {
    const worker = createWorker("cses-judge", processCSESJudge, {
        concurrency: 2,
        limiter: { max: 4, duration: 1000 },
    });

    console.log("[CSES Judge] Worker initialized");
    return worker;
}

export default { initCSESJudgeWorker, setIO };
