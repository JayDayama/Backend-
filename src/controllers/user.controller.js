import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js" // -> only user communicating with DB
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"


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

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}

// hum sidha hi ek response send kar denge(json wala)
    // (200 => (2xx)) -> is for acceptance
    // res.status(200).json({
    //     message : "Jay Dayama"
    // })