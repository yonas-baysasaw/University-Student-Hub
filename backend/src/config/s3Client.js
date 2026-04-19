import { S3Client } from '@aws-sdk/client-s3';
import { ENV } from './env.js';

const credentials = {
  accessKeyId: ENV.AWS_ACCESS_KEY_ID,
  secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
};

if (typeof ENV.AWS_SESSION_TOKEN === 'string' && ENV.AWS_SESSION_TOKEN.trim()) {
  credentials.sessionToken = ENV.AWS_SESSION_TOKEN;
}

const s3Client = new S3Client({
  region: ENV.AWS_REGION,
  credentials,
});

export { s3Client };
