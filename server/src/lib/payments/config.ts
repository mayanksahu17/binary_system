import { PorticoConfig, ServicesContainer } from "globalpayments-api";

// Configure Global Payments service
const config = new PorticoConfig();
config.secretApiKey = "skapi_cert_MXxrBgBMUHMAAORlzdNmdkSn13JskKAMnH-hAKihGw";
config.serviceUrl = "https://cert.api2.heartlandportico.com";
config.versionNumber = '6294';
config.developerId = '002914';
ServicesContainer.configureService(config);

export default config;
