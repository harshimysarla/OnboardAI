import { createHash } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { getEnvVars } from "@/lib/env";

export function computeFileHash(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  filename: string,
  resourceType: "auto" | "image" | "raw" = "raw"
): Promise<string> {
  const vars = getEnvVars();
  cloudinary.config({
    cloud_name: vars.cloudinaryCloudName,
    api_key: vars.cloudinaryApiKey,
    api_secret: vars.cloudinaryApiSecret,
  });

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, public_id: filename, resource_type: resourceType, use_filename: false },
      (error, result) => {
        if (error) reject(error);
        else resolve(result?.secure_url || "");
      }
    );
    uploadStream.end(buffer);
  });
}
