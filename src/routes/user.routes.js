import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccessToken } from "../controllers/user.controller.js"
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

// secured routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)

export default router