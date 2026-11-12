import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js" // -> only user communicating with DB
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessTokens()
        const refreshToken = user.generateRefreshTokens()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave : false })
        // hum password and all thodi le rhe hai harr jagah

        return {accessToken , refreshToken}

    } catch (error) {
        // console.log("TOKEN GENERATION ERROR: ", error);
        throw new ApiError(500 , "Something went wrong while generating access and referesh Token")
    }
}


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
    // console.log("REQUEST dot Body : ",req.body)
    // console.log("email : ", email)

    if(
        // if field exists and after trim (spaces wagera hata dega in case) it is === "" then return true
        [fullName,email,username,password].some( (field) => field?.trim === "" )
    ) {
        throw new ApiError(400,"All Fields are required")
    }

    const existedUser = await User.findOne({
        $or : [{username} , {email}]
    })

    // console.log(existedUser)

    if (existedUser) {
        throw new ApiError(409 , "User with same Username or email Already exists")
    }

    // middleware gives more fields to request
    // .path -> multer server pe temporarily store kar de rha hai uska path mil jayega
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    // console.log("Request dot files : ",req.files)

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

const loginUser = asyncHandler( async (req , res) => {
    // req body se data le aao
    // check for validation (that email field or some other field is not empty)
    // check for user in database
    // password check
    // access and refresh token
    // send them in cookies


    const {email , username, password} = req.body

    if(!email && !username) {
        throw new ApiError(400 , "username or the email is atleast required")
    }

    const user = await User.findOne({
        $or : [{username} , {email}]
    })

    if(!user) {
        throw new ApiError(404 , "User does not exist")
    }

    // we know that the recieved password is encrypted so we already created a method to compare the password we got to orignal password
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) {
        throw new ApiError(401 , "Invalid user credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefereshTokens(user._id)

    // now we have out tokens but the user was defined before so either we need to update that or do one more db call taki hum user ko cookies mei data send kar paye(only the one required like we need the user to have our tokens)

    const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken")

    const options = {
        // makes sure that cokies can only be modified by server not thru the frontend
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken" , accessToken , options)
    .cookie("refreshToken" , refreshToken , options)
    .json(
        new ApiResponse(
            200,
            {
                user : loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

} )

const logoutUser = asyncHandler( async (req , res) => {
    // designing our own middleware because at logout time we will not give user a form for details else he can logout anyone
    // we have already added a route for logout and there we have also added out middleware in which we added a user object (req.user) -> we have the access hence
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken : undefined
            }
        },
        {
            new : true
        }
    )
    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken" , options)
    .clearCookie("refreshToken" , options)
    .json(new ApiResponse(200 , {} , "User logged Out"))

} )

const refreshAccessToken = asyncHandler(async (req , res) => {
    // hum ise to cookie se access kar lenge aaram se
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) {
        throw new ApiError(401 , "Unauthorized request")
    }

    // we know that the token we recieved was actually wrapped using jwt so we cannot just compare it directly therfore we use the .verify

    try {
        const decodedToken = jwt.verify(
            // basically out decoded token is just to access the id so that we can access the refresh token saved in db by using a user and then we can check
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user) {
            throw new ApiError(401 , "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401 , "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly : true,
            secure : true
        }
    
        const {accessToken , newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken , refreshToken : newRefreshToken},
                "Access Token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401 , error?.message || "Invalid Refresh Token")
    }

} )

const changeCurrentPassword = asyncHandler(async (req , res) => {
    const {oldPassword , newPassword} = req.body
    // if user is able to change password then he is definitely logged in and we have a middleware for req.user
    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) {
        throw new ApiError(400 , "Invalid Old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res
    .status(200)
    .json(new ApiResponse(200 , {} , "Password changed successfully"))

} )

const getCurrentUser = asyncHandler(async (req , res) => {
    return res
    .status(200)
    .json(new ApiResponse(200 , req.user , "Current User fetched successfully"))
} )

const updateAccountDetails = asyncHandler(async (req , res) => {
    const {fullName , email} = req.body

    if(!fullName || !email) {
        throw new ApiError(400 , "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullName : fullName,
                email
            }
        },
        {next : true} // -> update hone ke baad wali value hume milti hai

    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "Account details updated successfully"));

} )

const updateUserAvatar = asyncHandler (async (req , res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath) {
        throw new ApiError(400 , "Avatar is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) {
        throw new ApiError(400 , "Error while uploading avatar")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                avatar : avatar.url
            }
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse((200 , user , "Avatar updated successfully"))
    )

} )

const updateUserCoverImage = asyncHandler (async (req , res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) {
        throw new ApiError(400 , "Cover Image missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url) {
        throw new ApiError(400 , "Error while uploading Cover-Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            coverImage : coverImage.url
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200 , user , "Cover Image updated successfully")
    )

} )

const getUserChannelProfile = asyncHandler(async (req , res) => {
    const {username} = req.params

    if(!username?.trim()) {
        throw new ApiError(400 , "username is missing")
    }

    // we are joining user to channel
    const channel = await User.aggregate([
        {
            $match : {
                username : username?.toLowerCase()
            }
        },
        {
            // we are joining user to channel user_id to channel further we will just need to count (all this is for subcribers)
            $lookup : {
                from : "subscriptions",
                localField : "_id",
                foreignField : "channel",
                as : "subscribers"
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "_id",
                foreignField : "subscriber",
                // we check for our user subcriber channels after wards
                as : "subscribedTo"
            }
        },
        {
            $addFields : {
                subscribersCount : {
                    $size : "$subscribers"
                },
                channelsSubscribedToCount : {
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    $cond : {
                        if: {$in : [req.user?._id , "$subscribers.subscriber"]},
                        then : true,
                        else : false
                    }
                }
            }
        },
        {
            $project : {
                fullName : 1,
                username : 1,
                subscribersCount : 1,
                channelsSubscribedToCount : 1,
                isSubscribed : 1,
                avatar : 1,
                coverImage : 1,
                email : 1
            }
        }
    ])

    if(!channel?.length) {
        throw new ApiError(404 , "Channel does not exists")
    }

    // as we used $match we know we will find a unique channel for sure
    // hence it will only contain one object over here and we return the 1st one

    return res
    .status(200)
    .json(
        new ApiResponse(200 , channel[0] , "User channel fetched successfully")
    )

} )

const getWatchHistory = asyncHandler(async (req , res) => {
    // mai video wale schema mei hoon lookup hum user mei kar rhe hai
    const user = await User.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(req.user._id)
                // we got our user
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "watchHistory",
                foreignField : "_id",
                as: "watchHistory",
                pipeline : [
                    // mai video wale schema mei hoon lookup hum user mei kar rhe hai
                    {
                        $lookup : {
                            from : "users",
                            localField : "owner",
                            foreignField : "_id",
                            as : "owner", 
                            // I do not need every field inside owner just the required one's
                            pipeline : [
                                {
                                    $project : {
                                        fullName : 1,
                                        username : 1,
                                        avatar : 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // taki frontend ko .owner ka access mil jaye na ki array se nikalna pade
                        $addFields : {
                            owner : {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )

} )

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}

// hum sidha hi ek response send kar denge(json wala)
    // (200 => (2xx)) -> is for acceptance
    // res.status(200).json({
    //     message : "Jay Dayama"
    // })