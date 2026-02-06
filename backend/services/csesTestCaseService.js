import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(__dirname, "..", "cses-tests");

// Ensure base directory exists
if (!fs.existsSync(TESTS_DIR)) {
    fs.mkdirSync(TESTS_DIR, { recursive: true });
}

// Simple in-memory lock to prevent concurrent downloads of the same task
const downloadLocks = new Map();

/**
 * Get CSES test cases for a given task ID from local disk cache.
 *
 * Test cases must be pre-downloaded using:
 *   node backend/scripts/downloadCSESTests.js --user YOUR_USER --pass YOUR_PASS
 *
 * @param {string} taskId - CSES task ID (e.g. "1068")
 * @returns {Promise<{ input: string, expectedOutput: string, testNumber: number }[]>}
 */
export async function getTestCases(taskId) {
    const taskDir = path.join(TESTS_DIR, String(taskId));

    // Check disk cache
    if (fs.existsSync(taskDir) && hasTestFiles(taskDir)) {
        return readTestCases(taskDir);
    }

    // If a download with cookie is in progress, wait for it
    if (downloadLocks.has(taskId)) {
        await downloadLocks.get(taskId);
        if (fs.existsSync(taskDir) && hasTestFiles(taskDir)) {
            return readTestCases(taskDir);
        }
    }

    throw new Error(
        `Test cases for CSES task ${taskId} not found on disk. ` +
        `Run: node backend/scripts/downloadCSESTests.js --user YOUR_USER --pass YOUR_PASS --task ${taskId}`
    );
}

/**
 * Download test cases for a specific task using an authenticated session cookie.
 * Called by the download script or admin API.
 *
 * @param {string} taskId
 * @param {string} cookie - Authenticated CSES session cookie (e.g. "PHPSESSID=xxx")
 */
export async function downloadTestCasesWithAuth(taskId, cookie) {
    const taskDir = path.join(TESTS_DIR, String(taskId));

    if (downloadLocks.has(taskId)) {
        await downloadLocks.get(taskId);
        return;
    }

    const downloadPromise = downloadAndExtract(taskId, taskDir, cookie);
    downloadLocks.set(taskId, downloadPromise);

    try {
        await downloadPromise;
    } finally {
        downloadLocks.delete(taskId);
    }
}

/**
 * Get test case count without reading file contents.
 *
 * @param {string} taskId
 * @returns {Promise<number>}
 */
export async function getTestCount(taskId) {
    const taskDir = path.join(TESTS_DIR, String(taskId));

    if (!fs.existsSync(taskDir) || !hasTestFiles(taskDir)) {
        // Download first
        await getTestCases(taskId);
    }

    const files = fs.readdirSync(taskDir).filter(f => f.endsWith(".in"));
    return files.length;
}

/**
 * Clear cached test cases for a task.
 *
 * @param {string} taskId
 */
export function clearTestCases(taskId) {
    const taskDir = path.join(TESTS_DIR, String(taskId));
    if (fs.existsSync(taskDir)) {
        fs.rmSync(taskDir, { recursive: true, force: true });
        console.log(`[CSES Tests] Cleared cache for task ${taskId}`);
    }
}

/**
 * Check if a directory has test files (at least 1.in and 1.out).
 */
function hasTestFiles(dir) {
    try {
        return fs.existsSync(path.join(dir, "1.in")) && fs.existsSync(path.join(dir, "1.out"));
    } catch {
        return false;
    }
}

/**
 * Read all test cases from a directory.
 */
function readTestCases(dir) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".in"));
    const testNumbers = files
        .map(f => parseInt(f.replace(".in", ""), 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

    return testNumbers.map(n => ({
        testNumber: n,
        input: fs.readFileSync(path.join(dir, `${n}.in`), "utf-8"),
        expectedOutput: fs.readFileSync(path.join(dir, `${n}.out`), "utf-8"),
    }));
}

/**
 * Download ZIP from CSES and extract to target directory.
 * CSES requires a two-step process: GET page for csrf_token, then POST to download.
 */
async function downloadAndExtract(taskId, taskDir, cookie) {
    const url = `https://cses.fi/problemset/tests/${taskId}/`;
    console.log(`[CSES Tests] Downloading test cases for task ${taskId}...`);

    const baseHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (cookie) {
        baseHeaders["Cookie"] = cookie;
    }

    // Step 1: GET the tests page to extract csrf_token from the download form
    const pageRes = await fetch(url, {
        headers: { ...baseHeaders },
        redirect: "follow",
    });

    if (!pageRes.ok) {
        throw new Error(`Failed to load CSES tests page for task ${taskId}: HTTP ${pageRes.status}`);
    }

    const pageHtml = await pageRes.text();
    const csrfMatch = pageHtml.match(/name=["']csrf_token["']\s+value=["']([^"']+)["']/);
    if (!csrfMatch) {
        throw new Error(`No download form found on CSES tests page for task ${taskId}. Are you authenticated?`);
    }

    const csrfToken = csrfMatch[1];

    // Step 2: POST to download the actual ZIP file
    const formData = new URLSearchParams();
    formData.append("csrf_token", csrfToken);
    formData.append("download", "true");

    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...baseHeaders,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
        redirect: "follow",
    });

    if (!response.ok) {
        throw new Error(`Failed to download CSES tests for task ${taskId}: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Ensure we got a ZIP file
    if (buffer.length < 100) {
        throw new Error(`CSES returned an unexpectedly small response for task ${taskId} (${buffer.length} bytes). The task ID may be invalid.`);
    }

    // Extract ZIP
    try {
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        if (entries.length === 0) {
            throw new Error(`ZIP archive is empty for task ${taskId}`);
        }

        // Create task directory
        fs.mkdirSync(taskDir, { recursive: true });

        // Extract files
        let extracted = 0;
        for (const entry of entries) {
            if (entry.isDirectory) continue;

            // Get just the filename (ignore directory nesting in ZIP)
            const filename = path.basename(entry.entryName);

            // Only extract .in and .out files
            if (filename.endsWith(".in") || filename.endsWith(".out")) {
                const content = entry.getData().toString("utf-8");
                fs.writeFileSync(path.join(taskDir, filename), content);
                extracted++;
            }
        }

        if (extracted === 0) {
            // Clean up empty directory
            fs.rmSync(taskDir, { recursive: true, force: true });
            throw new Error(`No test files found in ZIP for task ${taskId}`);
        }

        const testCount = fs.readdirSync(taskDir).filter(f => f.endsWith(".in")).length;
        console.log(`[CSES Tests] Extracted ${testCount} test cases for task ${taskId}`);
    } catch (err) {
        // Clean up on failure
        if (fs.existsSync(taskDir)) {
            fs.rmSync(taskDir, { recursive: true, force: true });
        }
        if (err.message.includes("ZIP") || err.message.includes("test files")) {
            throw err;
        }
        throw new Error(`Failed to extract ZIP for task ${taskId}: ${err.message}`);
    }
}

export default { getTestCases, getTestCount, clearTestCases, downloadTestCasesWithAuth };
