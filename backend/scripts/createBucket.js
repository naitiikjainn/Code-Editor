import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
    region: 'us-east-1',
    credentials: {
        accessKeyId: 'AKIAWU3F3DNFYAFTAGNE',
        secretAccessKey: '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'
    }
});

(async () => {
    const bucket = 'codeplay-cses-tests';
    try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        console.log('Bucket already exists:', bucket);
    } catch (e) {
        if (e.name === 'NotFound' || e.name === 'NoSuchBucket' || (e.$metadata && e.$metadata.httpStatusCode === 404) || (e.$metadata && e.$metadata.httpStatusCode === 403)) {
            try {
                await client.send(new CreateBucketCommand({ Bucket: bucket }));
                console.log('Created bucket:', bucket);
            } catch (err) {
                console.log('Create error:', err.name, err.message);
            }
        } else {
            console.log('Error:', e.name, e.message);
        }
    }
})();
