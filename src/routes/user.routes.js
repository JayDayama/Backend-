import { Router } from "express";
import { 
    loginUser,
    logoutUser,
    registerUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
} from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.middleware.js"
import { ApiError } from "../utils/ApiError.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

// middleware -> jaate hue mujhse mil ke jana
router.route("/register").post(
    // we cant just use .array because there may be case where we are expecting files of different format/type
    upload.fields([
        // we accept avatar and cover image
        {
            name : "avatar",
            maxCount : 1
        },
        {
            name : "coverImage",
            maxCount : 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)

// verifyJWT -> to verify if user is logged in or not

// secured routes
// hum logout ko bol rhe hai method run karne se pehele middleware se milte hue jana
// i.e : we will have access to out req.user
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT , changeCurrentPassword)
router.route("/current-user").get(verifyJWT , getCurrentUser)
router.route("/update-account").patch(verifyJWT , updateAccountDetails)
router.route("/avatar").patch(verifyJWT , upload.single("avatar") , updateUserAvatar)
router.route("/cover-image").patch(verifyJWT , upload.single("coverImage") , updateUserCoverImage)

//In user channel profile we use params therfore in route after ':' what we use matters "username" to the method is important the username in route is one for the method

router.route("/c/:username").get(verifyJWT , getUserChannelProfile)
router.route("/history").get(verifyJWT , getWatchHistory)

export default router