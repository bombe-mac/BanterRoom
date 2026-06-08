import dotenv from "dotenv";
import { Redis } from "ioredis";
import pino from "pino";
import { prisma } from "@chat/shared-types";

// Load environment variables before any other initialization.
dotenv.config();
const logger = pino({
	level: process.env.LOG_LEVEL ?? "info",
});

const REDIS_URL = requireEnv("REDIS_URL");
const STREAM_NAME = requireEnv("STREAM_NAME");
const CONSUMER_GROUP = requireEnv("CONSUMER_GROUP");
const CONSUMER_NAME = requireEnv("CONSUMER_NAME");

const BLOCK_MS = 5000;
const COUNT = 20;

const redis = new Redis(REDIS_URL, {
	maxRetriesPerRequest: null,
	enableReadyCheck: true,
});

redis.on("error", (error) => {
	logger.error({ error }, "Redis error");
});

redis.on("ready", () => {
	logger.info("Redis connection ready");
});

type MessagePayload = {
	id: string;
	roomId: string;
	userId: string;
	content: string;
};

type RedisStreamEntry = [string, string[]];
type RedisStreamResponse = [string, RedisStreamEntry[]][];

async function ensureConsumerGroup(): Promise<void> {
	try {
		// Use $ so the group starts at the end of the stream (new messages only).
		await redis.xgroup("CREATE", STREAM_NAME, CONSUMER_GROUP, "$", "MKSTREAM");
		logger.info({ stream: STREAM_NAME, group: CONSUMER_GROUP }, "Consumer group created");
	} catch (error) {
		if (isBusyGroupError(error)) {
			logger.info({ stream: STREAM_NAME, group: CONSUMER_GROUP }, "Consumer group already exists");
			return;
		}
		throw error;
	}
}

async function consumeForever(): Promise<void> {
	// Continuous loop: never terminate on a single message failure.
	while (true) {
		try {
			const response = await redis.xreadgroup(
				"GROUP",
				CONSUMER_GROUP,
				CONSUMER_NAME,
				"COUNT",
				COUNT,
				"BLOCK",
				BLOCK_MS,
				"STREAMS",
				STREAM_NAME,
				">"
			);

			if (!response) {
				continue;
			}

			const streams = response as RedisStreamResponse;
			for (const [, entries] of streams) {
				for (const [streamId, fieldValues] of entries) {
					await handleStreamEntry(streamId, fieldValues);
				}
			}
		} catch (error) {
			logger.error({ error }, "Redis read failure");
			await sleep(1000);
		}
	}
}

async function handleStreamEntry(streamId: string, fieldValues: string[]): Promise<void> {
	try {
		const payload = parseFieldValues(fieldValues);
		const message = validatePayload(payload);
		if (!message) {
			logger.error({ streamId, payload }, "Invalid message payload");
			return;
		}

		await prisma.message.create({
			data: {
				id: message.id,
				roomId: message.roomId,
				userId: message.userId,
				content: message.content,
			},
		});

		await redis.xack(STREAM_NAME, CONSUMER_GROUP, streamId);
		logger.info({ streamId, messageId: message.id }, "Message persisted");
	} catch (error) {
		logger.error({ error, streamId }, "Message persistence failure");
	}
}

function parseFieldValues(fieldValues: string[]): Record<string, string> {
	const payload: Record<string, string> = {};

	// Field-value pairs come in a flat array: [field1, value1, field2, value2, ...]
	for (let index = 0; index < fieldValues.length; index += 2) {
		const field = fieldValues[index];
		const value = fieldValues[index + 1];
		if (typeof field === "string" && typeof value === "string") {
			payload[field] = value;
		}
	}

	return payload;
}

function validatePayload(payload: Record<string, string>): MessagePayload | null {
	const id = payload.id;
	const roomId = payload.roomId;
	const userId = payload.userId;
	const content = payload.content;

	if (!id || !roomId || !userId || !content) {
		return null;
	}

	return { id, roomId, userId, content };
}

function isBusyGroupError(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	const message = "message" in error ? String((error as { message?: unknown }).message) : "";
	return message.includes("BUSYGROUP");
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		logger.error({ name }, "Missing required environment variable");
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function start(): Promise<void> {
	logger.info(
		{
			stream: STREAM_NAME,
			group: CONSUMER_GROUP,
			consumer: CONSUMER_NAME,
		},
		"Message persistence worker starting"
	);

	try {
		await prisma.$connect();
	} catch (error) {
		logger.error({ error }, "Database connection failed");
		throw error;
	}

	await ensureConsumerGroup();
	await consumeForever();
}

start().catch((error) => {
	logger.error({ error }, "Worker startup failed");
	process.exit(1);
});
