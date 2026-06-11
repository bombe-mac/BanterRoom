import {Redis} from "ioredis";

export const pub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
export const sub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

//cmd is used for message persistence and other non-pub/sub commands, while pub and sub are used for pub/sub to avoid interference with other commands
export const cmd = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export const CHANNEL = 'chat';

export const STREAM_NAME = 'chat_stream';