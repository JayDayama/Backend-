import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.middleware.js"
import { ApiError } from "../utils/ApiError.js"

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

export default router