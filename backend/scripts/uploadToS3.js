import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET = process.env.AWS_S3_BUCKET || 'codeplay-cses-tests';
const REGION = process.env.AWS_REGION || 'us-east-1';
const TESTS_DIR = path.join(__dirname, '..', 'cses-tests');
const CONCURRENCY = 10;

const client = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAWU3F3DNFYAFTAGNE',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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',
    }
});

async function uploadFile(taskId, filename) {
    const filePath = path.join(TESTS_DIR, String(taskId), filename);
    const key = `tests/${taskId}/${filename}`;
    const body = fs.readFileSync(filePath);

    await client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'text/plain',
    }));
}

async function uploadTask(taskId) {
    const taskDir = path.join(TESTS_DIR, String(taskId));
    if (!fs.existsSync(taskDir)) return { taskId, status: 'missing' };

    const files = fs.readdirSync(taskDir).filter(f => f.endsWith('.in') || f.endsWith('.out'));
    if (files.length === 0) return { taskId, status: 'empty' };

    for (const file of files) {
        await uploadFile(taskId, file);
    }

    return { taskId, status: 'ok', files: files.length };
}

async function runWithConcurrency(tasks, concurrency, fn) {
    const results = [];
    let idx = 0;

    async function worker() {
        while (idx < tasks.length) {
            const i = idx++;
            results[i] = await fn(tasks[i]);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

async function main() {
    if (!fs.existsSync(TESTS_DIR)) {
        console.error(`Test cases directory not found: ${TESTS_DIR}`);
        console.error('Run downloadCSESTests.js first to download test cases.');
        process.exit(1);
    }

    const taskIds = fs.readdirSync(TESTS_DIR)
        .filter(d => /^\d+$/.test(d) && fs.statSync(path.join(TESTS_DIR, d)).isDirectory())
        .sort((a, b) => Number(a) - Number(b));

    console.log(`[S3 Upload] Found ${taskIds.length} tasks to upload to s3://${BUCKET}/tests/`);
    console.log(`[S3 Upload] Region: ${REGION}, Concurrency: ${CONCURRENCY}\n`);

    let uploaded = 0, skipped = 0, errors = 0;
    const startTime = Date.now();

    const results = await runWithConcurrency(taskIds, CONCURRENCY, async (taskId) => {
        try {
            const result = await uploadTask(taskId);
            uploaded++;
            if (uploaded % 20 === 0 || uploaded === taskIds.length) {
                const pct = ((uploaded / taskIds.length) * 100).toFixed(0);
                process.stdout.write(`\r[S3 Upload] Progress: ${uploaded}/${taskIds.length} (${pct}%)`);
            }
            return result;
        } catch (err) {
            errors++;
            return { taskId, status: 'error', error: err.message };
        }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n========== UPLOAD COMPLETE ==========`);
    console.log(`  Uploaded:  ${uploaded}`);
    console.log(`  Errors:    ${errors}`);
    console.log(`  Time:      ${elapsed}s`);
    console.log(`  Bucket:    s3://${BUCKET}/tests/`);
    console.log(`=====================================`);

    if (errors > 0) {
        console.log('\nFailed tasks:');
        results.filter(r => r.status === 'error').forEach(r => {
            console.log(`  Task ${r.taskId}: ${r.error}`);
        });
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
