import { createClient } from 'redis';

const redisClient = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  } 
});

redisClient.on('error', err => console.error('Redis Client Error:', err));

// Connect automatically when imported
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Redis connection failed:', err);
  }
})();

export default redisClient;