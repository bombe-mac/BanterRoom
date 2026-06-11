import { pub, cmd, CHANNEL, STREAM_NAME } from "../redis/client.js";
import { type IncomingMessage, type ChatMessage, type RoomBroadcastPayload } from "@chat/shared-types";
import { joinRoom, leaveRoom } from "./rooms.js";
import { WebSocket } from "ws";

export const handleMessage = async (ws: WebSocket, data: string) => {
    let parsed: IncomingMessage;

    try {
        parsed = JSON.parse(data);
    } catch {
        return;
    }

    const authed = (ws as any).user;
    if (!authed) return;
    if (!parsed.roomId || !parsed.type) return;

    if (parsed.type === "join-room") {
        joinRoom(parsed.roomId, ws);
        return;
    }

    if (parsed.type === "leave-room") {
        leaveRoom(parsed.roomId, ws);
        return;
    }

    if (parsed.type !== "chat") return;

    const msg = parsed as ChatMessage;
    const timestamp = Date.now();

    await cmd.xadd(
        STREAM_NAME,
        "*",
        "roomId", msg.roomId,
        "userId", authed.userId,
        "content", msg.content,
        "timestamp", String(timestamp)
    );

    const broadcast: RoomBroadcastPayload  = {
        type: "chat",
        roomId: msg.roomId,
        userId: authed.userId,
        content: msg.content,
        timestamp,
    };

    await pub.publish(CHANNEL, JSON.stringify(broadcast));
};