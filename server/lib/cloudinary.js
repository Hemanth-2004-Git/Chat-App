import {v2 as cloudinary} from "cloudinary";

cloudinary.config({
    cloud_name: process.env.cloudinary_cloud_name,
    api_key : process.env.cloudinary_API_key,
    api_secret: process.env.cloudinary_API_secret,
});

export default cloudinary;
