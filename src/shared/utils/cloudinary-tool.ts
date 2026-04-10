import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export class CloudinaryTool {
    /**
     * Upload a file buffer to Cloudinary
     * @param fileBuffer - The file content as a Buffer
     * @param folder - Cloudinary folder name
     * @returns The secure URL and public ID
     */
    async uploadFile(fileBuffer: Buffer, folder: string = "cvs"): Promise<{ url: string; public_id: string }> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder, resource_type: "auto" },
                (error, result) => {
                    if (error) return reject(error);
                    if (!result) return reject(new Error("Cloudinary upload failed"));
                    resolve({
                        url: result.secure_url,
                        public_id: result.public_id,
                    });
                }
            );

            uploadStream.end(fileBuffer);
        });
    }

    /**
     * Delete a file from Cloudinary
     * @param public_id - The public ID of the file
     */
    async deleteFile(public_id: string): Promise<void> {
        await cloudinary.uploader.destroy(public_id);
    }
}
