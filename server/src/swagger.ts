// config/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import path from 'path';


const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hotel Management API',
      version: '1.0.0',
      description: 'API documentation for Hotel Booking System',
    },
    servers: [
      {
        url: 'http://13.61.174.1:8000',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },

  // ✅ This includes all .ts files inside /routes and its subfolders
  apis: [path.join(process.cwd(), 'src/routes/**/*.ts')],};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
console.log(swaggerSpec);
export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
