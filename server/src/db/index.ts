
import mongoose from "mongoose";
import { DB_NAME } from "../constant";
import chalk from 'chalk';
const connectdb = async () => {
    try {
        const MONGODB_URL = (process.env.NODE_ENV == 'production') ? process.env.MONGODB_URL_PRODUCTION : process.env.MONGODB_URL_DEVELOPMENT;
        console.log(MONGODB_URL);
        const connectionInstance = await mongoose.connect(`${MONGODB_URL}`)
        console.log(chalk.blueBright(`====> MongoDB connected successfully to ${DB_NAME} database.`) ,
    );

    } catch (error: any) {

        console.log("Mongodb connection error:  " + error );
        throw error;
        process.exit(1);
    }
}

export default connectdb