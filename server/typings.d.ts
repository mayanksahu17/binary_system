// Global type declarations to fix globalpayments-api type issues
declare module 'globalpayments-api' {
  // Declare problematic types as any to avoid compilation errors
  export const ReportBuilder: any;
  export const Secure3dBuilder: any;
  export const ConnectionConfig: any;
  export const ApplicationCryptogramType: any;
  export const IRequestLogger: any;
}

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            ACCESS_TOKEN: string;
            ACCES_EXPIRY_TOKEN: string;
            REFRESH_TOKEN_SECRET: string;
            REFRESH_TOKEN_EXPIRY: string;
        }
    }
}

export {};