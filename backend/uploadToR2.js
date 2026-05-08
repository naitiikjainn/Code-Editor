import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(__dirname, "cses-tests");

// Verify required env variables
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_S3_BUCKET } = process.env;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_ENDPOINT_URL_S3 || !AWS_S3_BUCKET) {
    console.error("❌ ERROR: Missing Cloudflare R2 environment variables in .env file.");
    console.error("Please ensure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, and AWS_S3_BUCKET are set.");
    process.exit(1);
}

const s3 = new S3Client({
    region: "auto",
    endpoint: AWS_ENDPOINT_URL_S3,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
});

// Get all files recursively
function getAllFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    }
    return fileList;
}

async function uploadFiles() {
    console.log("🔍 Scanning cses-tests directory...");
    const files = getAllFiles(TESTS_DIR);
    console.log(`📁 Found ${files.length} files to upload.`);

    if (files.length === 0) {
        console.log("No files to upload. Exiting.");
        return;
    }

    let uploaded = 0;
    let failed = 0;
    
    // Upload in batches of 20 to prevent memory/network issues
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (filePath) => {
            // Convert local path (e.g., C:\...\cses-tests\1145\1.in) to S3 Key (tests/1145/1.in)
            const relativePath = path.relative(TESTS_DIR, filePath).replace(/\\/g, "/");
            const s3Key = `tests/${relativePath}`;
            
            try {
                const fileStream = fs.createReadStream(filePath);
                await s3.send(new PutObjectCommand({
                    Bucket: AWS_S3_BUCKET,
                    Key: s3Key,
                    Body: fileStream
                }));
                uploaded++;
                process.stdout.write(`\r✅ Uploaded: ${uploaded}/${files.length} files...`);
            } catch (err) {
                failed++;
                console.error(`\n❌ Failed to upload ${s3Key}: ${err.message}`);
            }
        });

        await Promise.all(promises);
    }

    console.log("\n\n🎉 Upload Complete!");
    console.log(`✅ Successfully uploaded: ${uploaded}`);
    if (failed > 0) console.log(`❌ Failed: ${failed}`);
}

uploadFiles().catch(console.error);
