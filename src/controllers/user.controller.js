import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js" // -> only user communicating with DB
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

// asyncHandler -> Higher Order function -> accepts a function therfore we write a method
const registerUser = asyncHandler( async (req , res) => {
    // get user details from frontend
    // validation -> check the user details it should not be empty
    // check if user already exists (via email or username)
    // check for images, and check for avatar
    // upload them to cloudinary
    // create user object -> create the entry in DB
    // remove password and refresh token field from response
    // check for user creation -> return res

    // data recieving from json or form : (we are currently taking data from postman)
    const { fullName , email , username , password } = req.body
    console.log("email : ", email)

    if(
        // if field exists and after trim (spaces wagera hata dega in case) it is === "" then return true
        [fullName,email,username,password].some( (field) => field?.trim === "" )
    ) {
        throw new ApiError(400,"All Fields are required")
    }

    const existedUser = User.findOne({
        $or : [{username} , {email}]
    })

    // console.log(existedUser)

    if (existedUser) {
        throw new ApiError(409 , "User with same Username or email Already exists")
    }

    // middleware gives more fields to request
    // .path -> multer server pe temporarily store kar de rha hai uska path mil jayega
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400 , "Avatar file is required")
    }

    // we already have created a method for uploading files on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new ApiError(400 , "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        // isme by default sab selected hota hai toh "-name" laga ke woh field hata skte ho
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went Wrong while registering the User")
    }

    // we already have a class to send the api response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )


} )

export {registerUser}

// hum sidha hi ek response send kar denge(json wala)
    // (200 => (2xx)) -> is for acceptance
    // res.status(200).json({
    //     message : "Jay Dayama"
    // })