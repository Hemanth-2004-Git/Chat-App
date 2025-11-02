import {v2 as cloudinary} from "cloudinary";

// Helper to clean env values (remove quotes if present)
const cleanEnv = (value) => {
    if (!value) return value;
    // Remove surrounding single or double quotes
    return value.replace(/^['"]|['"]$/g, '');
};

cloudinary.config({
    cloud_name: cleanEnv(process.env.CLOUDINARY_CLOUD_NAME || process.env.cloudinary_cloud_name),
    api_key: cleanEnv(process.env.CLOUDINARY_API_KEY || process.env.cloudinary_API_key),
    api_secret: cleanEnv(process.env.CLOUDINARY_API_SECRET || process.env.cloudinary_API_secret),
});

// Log configuration status (without exposing secrets)
if (!cloudinary.config().cloud_name || !cloudinary.config().api_key) {
    console.warn("⚠️ Cloudinary configuration missing. Image uploads will fail.");
    console.log("Cloudinary configured:", {
        has_cloud_name: !!cloudinary.config().cloud_name,
        has_api_key: !!cloudinary.config().api_key,
        has_api_secret: !!cloudinary.config().api_secret
    });
} else {
    console.log("✅ Cloudinary configured successfully");
}

export default cloudinary;
