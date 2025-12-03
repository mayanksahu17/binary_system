import chalk from 'chalk'

function verifyEnvVariables(requiredVars: string[]): void {
    const missingVars: string[] = [];
    
    requiredVars.forEach((varName) => {
        if (process.env[varName]) {
            console.log(chalk.green(`====> Environment variable '${varName}' is set.`));
        } else {
            console.error(chalk.red(`❌ Environment variable '${varName}' is missing.`));
            missingVars.push(varName);
        }
    });
    
    if (missingVars.length > 0) {
        console.error("Missing required environment variables:", missingVars.join(", "));
        process.exit(1); // Exit with an error code if any variable is missing
    } else {
        console.log("✅ All required environment variables are set.");
    }
}

export default verifyEnvVariables


