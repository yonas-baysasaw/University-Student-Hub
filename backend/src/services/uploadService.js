import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import { ENV } from '../config/env.js';
import { s3Client } from '../config/s3Client.js';

async function uploadFileToS3(file, directory = '') {
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  const key = `${directory}/${uuid()}-${file.originalname}`;

  const command = new PutObjectCommand({
    Bucket: ENV.AWS_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  return {
    key,
    location: `https://${ENV.AWS_BUCKET_NAME}.s3.${ENV.AWS_REGION}.amazonaws.com/${key}`,
  };
}

export { uploadFileToS3 };
