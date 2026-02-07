import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(__dirname, "..", "cses-tests");

// S3 configuration
const S3_BUCKET = process.env.AWS_S3_BUCKET || "codeplay-cses-tests";
const S3_REGION = process.env.AWS_REGION || "us-east-1";
const S3_PREFIX = "tests/"; // keys are like tests/{taskId}/1.in

let s3 = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3 = new S3Client({
        region: S3_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
} else {
    console.warn("[CSES Tests] AWS credentials not set. S3 test case fetching will be unavailable. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars.");
}

// Ensure base directory exists
if (!fs.existsSync(TESTS_DIR)) {
    fs.mkdirSync(TESTS_DIR, { recursive: true });
}

// Simple in-memory lock to prevent concurrent downloads of the same task
const downloadLocks = new Map();

/**
 * Get CSES test cases for a given task ID.
 * Checks local disk cache first, then downloads from S3 if needed.
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

    // If a download is already in progress for this task, wait for it
    if (downloadLocks.has(taskId)) {
        await downloadLocks.get(taskId);
        if (fs.existsSync(taskDir) && hasTestFiles(taskDir)) {
            return readTestCases(taskDir);
        }
    }

    // Download from S3
    const downloadPromise = downloadFromS3(taskId, taskDir);
    downloadLocks.set(taskId, downloadPromise);

    try {
        await downloadPromise;
    } finally {
        downloadLocks.delete(taskId);
    }

    if (fs.existsSync(taskDir) && hasTestFiles(taskDir)) {
        return readTestCases(taskDir);
    }

    throw new Error(
        `Test cases for CSES task ${taskId} not found in S3 bucket (s3://${S3_BUCKET}/${S3_PREFIX}${taskId}/). ` +
        `Ensure the test cases have been uploaded.`
    );
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
 * Download test case files for a task from S3 and cache them locally.
 *
 * S3 structure: s3://{bucket}/tests/{taskId}/1.in, 1.out, 2.in, 2.out, ...
 */
async function downloadFromS3(taskId, taskDir) {
    if (!s3) {
        throw new Error(
            "AWS credentials not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables to your deployment."
        );
    }

    const prefix = `${S3_PREFIX}${taskId}/`;
    console.log(`[CSES Tests] Downloading task ${taskId} from S3 (s3://${S3_BUCKET}/${prefix})...`);

    // List all objects under the task prefix
    const listRes = await s3.send(new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
    }));

    const objects = (listRes.Contents || []).filter(obj => {
        const filename = obj.Key.split("/").pop();
        return filename.endsWith(".in") || filename.endsWith(".out");
    });

    if (objects.length === 0) {
        throw new Error(`No test files found in S3 for task ${taskId} at prefix ${prefix}`);
    }

    // Create task directory
    fs.mkdirSync(taskDir, { recursive: true });

    // Download all files
    let downloaded = 0;
    for (const obj of objects) {
        const filename = obj.Key.split("/").pop();
        const getRes = await s3.send(new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: obj.Key,
        }));

        // Stream body to string
        const chunks = [];
        for await (const chunk of getRes.Body) {
            chunks.push(chunk);
        }
        const content = Buffer.concat(chunks).toString("utf-8");

        fs.writeFileSync(path.join(taskDir, filename), content);
        downloaded++;
    }

    const testCount = fs.readdirSync(taskDir).filter(f => f.endsWith(".in")).length;
    console.log(`[CSES Tests] Cached ${testCount} test cases for task ${taskId} from S3 (${downloaded} files)`);
}

export default { getTestCases, getTestCount, clearTestCases };
