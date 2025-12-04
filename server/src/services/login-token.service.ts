import redisClient from '../clients/redis';
import { v4 as uuidv4 } from 'uuid';

const LOGIN_TOKEN_PREFIX = 'login_token:';
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

interface LoginTokenData {
  userId: string;
  userMongoId: string;
}

/**
 * Generate a temporary login token and store it in Redis
 * @param userId - User ID in format CROWN-XXXXXX
 * @param userMongoId - MongoDB ObjectId of the user
 * @returns Promise<string> - Temporary token
 */
export async function generateLoginToken(userId: string, userMongoId: string): Promise<string> {
  const token = uuidv4();
  const key = `${LOGIN_TOKEN_PREFIX}${token}`;
  
  const tokenData: LoginTokenData = {
    userId,
    userMongoId,
  };

  try {
    await redisClient.setEx(key, TOKEN_EXPIRY_SECONDS, JSON.stringify(tokenData));
    return token;
  } catch (error: any) {
    console.error('Failed to store login token in Redis:', error);
    throw new Error('Failed to generate login token');
  }
}

/**
 * Validate and retrieve login token data from Redis
 * @param token - Temporary token
 * @returns Promise<LoginTokenData | null> - Token data or null if invalid/expired
 */
export async function validateLoginToken(token: string): Promise<LoginTokenData | null> {
  const key = `${LOGIN_TOKEN_PREFIX}${token}`;
  
  try {
    const data = await redisClient.get(key);
    if (!data) {
      return null;
    }

    // Token is valid, delete it (single-use token)
    await redisClient.del(key);

    // Convert to string if it's a Buffer
    const dataString = typeof data === 'string' ? data : data.toString();
    const tokenData: LoginTokenData = JSON.parse(dataString);
    return tokenData;
  } catch (error: any) {
    console.error('Failed to validate login token from Redis:', error);
    return null;
  }
}

/**
 * Delete a login token from Redis (cleanup function)
 * @param token - Temporary token
 */
export async function deleteLoginToken(token: string): Promise<void> {
  const key = `${LOGIN_TOKEN_PREFIX}${token}`;
  try {
    await redisClient.del(key);
  } catch (error: any) {
    console.error('Failed to delete login token from Redis:', error);
  }
}

