import { pub, CHANNEL } from "../redis/client.js";
import type { IncomingMessage, ChatMessage } from "@chat/shared-types";
import type { JwtPayload } from "@chat/shared-types";
import { joinRoom } from "./rooms.js";
import {WebSocket} from "ws";

export const handleMessage = async (ws: WebSocket, data: string) => {
    let parsed: IncomingMessage;

    try {
        parsed = JSON.parse(data);
    } catch {
        return; // invalid JSON
    }

    // ensure socket was authenticated on connect
    const authed = (ws as any).user as JwtPayload | undefined;
    if (!authed) return;

    if (!parsed.roomId || !parsed.type) return;

    if (parsed.type === "join-room") {
        console.log("joining room...")
        joinRoom(parsed.roomId, ws);
        return;
    }

    if (parsed.type === "chat") {
        console.log("publishing...")
        const msg = parsed as ChatMessage;
        const enriched = {
            ...msg,
            userId: authed.userId,
            timestamp: Date.now(),
        };
        await pub.publish(CHANNEL, JSON.stringify(enriched));
    }
};