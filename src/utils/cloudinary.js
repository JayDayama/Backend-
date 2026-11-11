import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"

// this configuration is what allows us the permission to upload file and all
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});


// we will create a method to accept file link as parameter and then upload it if successfull upload then we unlink the file
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        // upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            // upload options
            resource_type: "auto"
        })
        // file has been uploaded successfully
        // console.log("File is Uploaded on Cloudinary ", response.url);
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        // if some bug or something has occured we know that we atleast have the file on the server than atleast remove it from there
        fs.unlinkSync(localFilePath)
        return null
    }
}

export {uploadOnCloudinary}