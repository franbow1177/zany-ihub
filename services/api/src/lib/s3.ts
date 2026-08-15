import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

import { serverEnv } from "../env"

export const s3 = new S3Client({
  endpoint: serverEnv.S3_ENDPOINT,
  region: serverEnv.S3_REGION,
  credentials: {
    accessKeyId: serverEnv.S3_ACCESS_KEY_ID,
    secretAccessKey: serverEnv.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})

export function fileStorageKey(workspaceId: string, resourceId: string) {
  return `workspaces/${workspaceId}/resources/${resourceId}`
}

export function whiteboardAssetStorageKey(
  workspaceId: string,
  resourceId: string,
  assetId: string
) {
  return `workspaces/${workspaceId}/resources/${resourceId}/whiteboard-assets/${assetId}`
}

export async function putObject(input: {
  key: string
  body: Uint8Array | Buffer
  contentType: string
}) {
  await s3.send(
    new PutObjectCommand({
      Bucket: serverEnv.S3_BUCKET,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    })
  )
}

export async function getObject(key: string) {
  return s3.send(
    new GetObjectCommand({
      Bucket: serverEnv.S3_BUCKET,
      Key: key,
    })
  )
}

export async function deleteObject(key: string) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: serverEnv.S3_BUCKET,
      Key: key,
    })
  )
}
