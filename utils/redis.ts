console.log(
  process.env.REDIS_HOST,
  process.env.REDIS_PORT,
  process.env.REDIS_USERNAME,
  process.env.REDIS_PASSWORD
);
import { createClient } from "redis";
const redis = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

redis.on("error", (err) => console.log("Redis Client Error", err));

await redis.connect();
export { redis };
