import { AwsClient } from 'aws4fetch';

const getR2Client = () => {
  return new AwsClient({
    service: 's3',
    region: process.env['R2_REGION'] || 'auto',
    accessKeyId: process.env['R2_ACCESS_KEY_ID']!,
    secretAccessKey: process.env['R2_SECRET_ACCESS_KEY']!,
  });
};

const getR2Url = () => {
  const R2_ACCOUNT_ID = process.env['R2_ACCOUNT_ID']!;
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
};

export const getDownloadSignedUrl = async (
  bucketName: string,
  fileKey: string,
  expiresIn: number,
) => {
  return (
    await getR2Client().sign(
      new Request(`${getR2Url()}/${bucketName}/${fileKey}?X-Amz-Expires=${expiresIn}`),
      {
        aws: { signQuery: true },
      },
    )
  ).url.toString();
};

export const getUploadSignedUrl = async (
  bucketName: string,
  fileKey: string,
  contentLength: number,
  expiresIn: number,
) => {
  return (
    await getR2Client().sign(
      new Request(
        `${getR2Url()}/${bucketName}/${fileKey}?X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=content-length`,
        {
          method: 'PUT',
          headers: {
            'Content-Length': contentLength.toString(),
          },
        },
      ),
      {
        aws: { signQuery: true },
      },
    )
  ).url.toString();
};

export const deleteObject = async (bucketName: string, fileKey: string) => {
  return await getR2Client().fetch(`${getR2Url()}/${bucketName}/${fileKey}`, {
    method: 'DELETE',
  });
};
