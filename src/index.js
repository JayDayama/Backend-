// require('dotenv').config({path: './env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";


dotenv.config({
    path: 'dotenv'
})

connectDB()
.then(() => {
    app.on("error" , (error) => {
        console.log("Error !! ", error)
        throw error
    })
    app.listen(process.env.PORT || 8000, () => {
        console.log(`App is running at Port : ${process.env.PORT}`)
    })
})
.catch((err) => {
    console.log("MongoDB connection Failed !!! ",err)
})






/*

import mongoose from "mongoose";
import {DB_NAME} from './constants.js'
import express from 'express';

const app = express()

;( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error" , (error) => {
            console.log("error : ",error)
            throw error
        })
        app.listen(process.env.PORT, () => {
            console.log(`App is Listening on port : ${process.env.PORT}`)
        })
    } catch (error) {
        console.log("ERROR : ", error)
        throw error
    }
} )()

*/