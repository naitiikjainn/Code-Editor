#!/usr/bin/env node
/**
 * CSES Test Case Bulk Downloader
 *
 * Downloads all test case ZIPs from CSES using your credentials.
 * Run this once to populate the backend/cses-tests/ directory.
 *
 * Usage:
 *   node backend/scripts/downloadCSESTests.js --user YOUR_USERNAME --pass YOUR_PASSWORD
 *
 *   Or set environment variables:
 *   CSES_USERNAME=your_username CSES_PASSWORD=your_password node backend/scripts/downloadCSESTests.js
 *
 * Options:
 *   --user, -u     CSES username
 *   --pass, -p     CSES password
 *   --task, -t     Download only a specific task ID (e.g. 1068)
 *   --force, -f    Re-download even if already cached
 *   --concurrency  Number of parallel downloads (default: 3)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(__dirname, "..", "cses-tests");
const CSES_BASE = "https://cses.fi";

// Parse CLI arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        user: process.env.CSES_USERNAME || "",
        pass: process.env.CSES_PASSWORD || "",
        task: null,
        force: false,
        concurrency: 3,
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case "--user": case "-u": opts.user = args[++i]; break;
            case "--pass": case "-p": opts.pass = args[++i]; break;
            case "--task": case "-t": opts.task = args[++i]; break;
            case "--force": case "-f": opts.force = true; break;
            case "--concurrency": opts.concurrency = parseInt(args[++i]) || 3; break;
        }
    }
    return opts;
}

/**
 * Login to CSES and return session cookie.
 */
async function login(username, password) {
    console.log(`[Login] Logging in as "${username}"...`);

    // Step 1: GET /login to get PHPSESSID + csrf_token
    const loginPage = await fetch(`${CSES_BASE}/login`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "manual",
    });

    const setCookieHeader = loginPage.headers.getSetCookie?.() || [loginPage.headers.get("set-cookie")].filter(Boolean);
    const sessionMatch = setCookieHeader.join(";").match(/PHPSESSID=([^;]+)/);
    if (!sessionMatch) throw new Error("Failed to get PHPSESSID from login page");

    const sessionId = sessionMatch[1];
    const loginHtml = await loginPage.text();

    const csrfMatch = loginHtml.match(/name=["']csrf_token["']\s+value=["']([^"']+)["']/);
    if (!csrfMatch) throw new Error("Failed to find csrf_token on login page");
    const csrfToken = csrfMatch[1];

    // Step 2: POST /login with credentials
    const formData = new URLSearchParams();
    formData.append("csrf_token", csrfToken);
    formData.append("nick", username);
    formData.append("pass", password);

    const loginRes = await fetch(`${CSES_BASE}/login`, {
        method: "POST",
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": `PHPSESSID=${sessionId}`,
        },
        body: formData.toString(),
        redirect: "manual",
    });

    // CSES redirects to / on success (302), stays on /login on failure
    const status = loginRes.status;
    const location = loginRes.headers.get("location") || "";

    // Check for updated session cookie
    const newCookies = loginRes.headers.getSetCookie?.() || [loginRes.headers.get("set-cookie")].filter(Boolean);
    const newSessionMatch = newCookies.join(";").match(/PHPSESSID=([^;]+)/);
    const finalSessionId = newSessionMatch ? newSessionMatch[1] : sessionId;

    if (status === 302 && (location === "/" || location.startsWith("/") && !location.includes("login"))) {
        console.log(`[Login] Success! Session: ${finalSessionId.substring(0, 8)}...`);
        return `PHPSESSID=${finalSessionId}`;
    }

    // If not redirect, check if we got HTML with error
    const responseText = await loginRes.text().catch(() => "");
    if (responseText.includes("Invalid")) {
        throw new Error("Login failed: Invalid username or password");
    }

    // Some servers return 200 and redirect via JS/meta
    // Try verifying session by fetching a protected page
    const verifyRes = await fetch(`${CSES_BASE}/problemset/`, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Cookie": `PHPSESSID=${finalSessionId}`,
        },
    });
    const verifyHtml = await verifyRes.text();
    if (verifyHtml.includes("Log out") || verifyHtml.includes("logout")) {
        console.log(`[Login] Success (verified via page)! Session: ${finalSessionId.substring(0, 8)}...`);
        return `PHPSESSID=${finalSessionId}`;
    }

    throw new Error("Login failed: Could not verify session. Check credentials.");
}

/**
 * Fetch all CSES task IDs from the problem list page.
 */
async function fetchAllTaskIds(cookie) {
    console.log("[Fetch] Getting all CSES task IDs...");

    const res = await fetch(`${CSES_BASE}/problemset/`, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Cookie": cookie,
        },
    });

    const html = await res.text();
    const taskIds = [];
    const regex = /href=["']\/problemset\/task\/(\d+)["']/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        if (!taskIds.includes(match[1])) {
            taskIds.push(match[1]);
        }
    }

    console.log(`[Fetch] Found ${taskIds.length} tasks`);
    return taskIds;
}

/**
 * Download and extract test cases for a single task.
 */
async function downloadTask(taskId, cookie, force = false) {
    const taskDir = path.join(TESTS_DIR, String(taskId));

    // Skip if already cached (unless force)
    if (!force && fs.existsSync(taskDir) && hasTestFiles(taskDir)) {
        return { taskId, status: "cached", tests: countTests(taskDir) };
    }

    const url = `${CSES_BASE}/problemset/tests/${taskId}/`;

    try {
        // Step 1: GET the tests page to extract csrf_token from the download form
        const pageRes = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Cookie": cookie,
            },
            redirect: "follow",
        });

        if (!pageRes.ok) {
            return { taskId, status: "error", error: `HTTP ${pageRes.status} on tests page` };
        }

        const pageHtml = await pageRes.text();

        // Check for 404 or "not found" page
        if (pageHtml.includes("Page not found") || pageHtml.includes("404")) {
            return { taskId, status: "not_found", error: "404 - test cases not available" };
        }

        // Extract csrf_token from the download form
        const csrfMatch = pageHtml.match(/name=["']csrf_token["']\s+value=["']([^"']+)["']/);
        if (!csrfMatch) {
            // Maybe the page doesn't have a download form (not logged in or task doesn't have tests)
            if (pageHtml.includes("login")) {
                return { taskId, status: "error", error: "Not authenticated - session expired?" };
            }
            return { taskId, status: "error", error: "No download form found on tests page" };
        }

        const csrfToken = csrfMatch[1];

        // Step 2: POST to download the actual ZIP file
        const formData = new URLSearchParams();
        formData.append("csrf_token", csrfToken);
        formData.append("download", "true");

        const downloadRes = await fetch(url, {
            method: "POST",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookie,
            },
            body: formData.toString(),
            redirect: "follow",
        });

        if (!downloadRes.ok) {
            return { taskId, status: "error", error: `HTTP ${downloadRes.status} on ZIP download` };
        }

        const buffer = Buffer.from(await downloadRes.arrayBuffer());

        // Verify it's a ZIP file (starts with PK)
        if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
            const text = buffer.toString("utf-8").substring(0, 200);
            return { taskId, status: "error", error: `Not a ZIP file (${buffer.length} bytes): ${text.substring(0, 100)}` };
        }

        // Extract ZIP
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        if (entries.length === 0) {
            return { taskId, status: "error", error: "Empty ZIP" };
        }

        // Create directory
        fs.mkdirSync(taskDir, { recursive: true });

        let extracted = 0;
        for (const entry of entries) {
            if (entry.isDirectory) continue;
            const filename = path.basename(entry.entryName);
            if (filename.endsWith(".in") || filename.endsWith(".out")) {
                const content = entry.getData().toString("utf-8");
                fs.writeFileSync(path.join(taskDir, filename), content);
                extracted++;
            }
        }

        if (extracted === 0) {
            fs.rmSync(taskDir, { recursive: true, force: true });
            return { taskId, status: "error", error: "No .in/.out files in ZIP" };
        }

        const testCount = countTests(taskDir);
        return { taskId, status: "ok", tests: testCount };

    } catch (err) {
        // Cleanup on failure
        if (fs.existsSync(taskDir)) {
            fs.rmSync(taskDir, { recursive: true, force: true });
        }
        return { taskId, status: "error", error: err.message };
    }
}

function hasTestFiles(dir) {
    try {
        return fs.existsSync(path.join(dir, "1.in")) && fs.existsSync(path.join(dir, "1.out"));
    } catch { return false; }
}

function countTests(dir) {
    try {
        return fs.readdirSync(dir).filter(f => f.endsWith(".in")).length;
    } catch { return 0; }
}

/**
 * Process tasks with concurrency control.
 */
async function downloadWithConcurrency(taskIds, cookie, force, concurrency) {
    const results = { ok: 0, cached: 0, error: 0, notFound: 0, errors: [] };
    let completed = 0;
    const total = taskIds.length;

    // Process in batches
    for (let i = 0; i < taskIds.length; i += concurrency) {
        const batch = taskIds.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(taskId => downloadTask(taskId, cookie, force))
        );

        for (const result of batchResults) {
            completed++;
            switch (result.status) {
                case "ok":
                    results.ok++;
                    process.stdout.write(`\r[${completed}/${total}] Downloaded task ${result.taskId} (${result.tests} tests)`);
                    break;
                case "cached":
                    results.cached++;
                    break;
                case "not_found":
                    results.notFound++;
                    break;
                case "error":
                    results.error++;
                    results.errors.push(`Task ${result.taskId}: ${result.error}`);
                    break;
            }
        }

        // Small delay between batches to be nice to CSES servers
        if (i + concurrency < taskIds.length) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    process.stdout.write("\n");
    return results;
}

// --- MAIN ---
async function main() {
    const opts = parseArgs();

    if (!opts.user || !opts.pass) {
        console.error("Error: CSES credentials required.");
        console.error("Usage: node downloadCSESTests.js --user YOUR_USERNAME --pass YOUR_PASSWORD");
        console.error("  Or:  CSES_USERNAME=xxx CSES_PASSWORD=yyy node downloadCSESTests.js");
        process.exit(1);
    }

    // Ensure output directory
    fs.mkdirSync(TESTS_DIR, { recursive: true });

    // Login
    let cookie;
    try {
        cookie = await login(opts.user, opts.pass);
    } catch (err) {
        console.error(`[Login] Failed: ${err.message}`);
        process.exit(1);
    }

    // Get task IDs
    let taskIds;
    if (opts.task) {
        taskIds = [opts.task];
        console.log(`[Mode] Single task: ${opts.task}`);
    } else {
        taskIds = await fetchAllTaskIds(cookie);
    }

    if (taskIds.length === 0) {
        console.error("No tasks found!");
        process.exit(1);
    }

    console.log(`\n[Download] Starting download of ${taskIds.length} tasks (concurrency: ${opts.concurrency}, force: ${opts.force})...\n`);

    const startTime = Date.now();
    const results = await downloadWithConcurrency(taskIds, cookie, opts.force, opts.concurrency);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Summary
    console.log("\n========== DOWNLOAD COMPLETE ==========");
    console.log(`  Downloaded:  ${results.ok}`);
    console.log(`  Cached:      ${results.cached}`);
    console.log(`  Not Found:   ${results.notFound}`);
    console.log(`  Errors:      ${results.error}`);
    console.log(`  Time:        ${elapsed}s`);
    console.log(`  Location:    ${TESTS_DIR}`);
    console.log("=======================================\n");

    if (results.errors.length > 0) {
        console.log("Errors:");
        results.errors.forEach(e => console.log(`  - ${e}`));
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
