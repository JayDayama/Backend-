import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

// importing routes

import userRouter from './routes/user.routes.js'


// routes declaration
// app.get() -> this would work when we had routes and all in this same file
// as they are not we use middleware
// app.use("/users" , userRouter)


app.use("/api/v1/users" , userRouter)

// https://localhost:8000/api/v1/users/register

// user ke baad kisi bhi chiz ka access chahiye hoga woh user.routes mei milega aur whi se handle ho jayega
// route , router -> userRouter gets the control as soon as /users is hit and decides what to do next

export {app}