import { asyncHandler } from "../utils/asyncHandler.js";

// asyncHandler -> Higher Order function -> accepts a function therfore we write a method
const registerUser = asyncHandler( async (req , res) => {
    // hum sidha hi ek response send kar denge(json wala)
    // (200 => (2xx)) -> is for acceptance
    res.status(200).json({
        message : "Jay Dayama"
    })
} )

export {registerUser}