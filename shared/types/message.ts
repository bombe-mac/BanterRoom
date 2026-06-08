// ─── Incoming (Client → ws-server) ───────────────────────────────────────────
//content is the text message sent by the user, it is only present in chat messages, not in join/leave room messages
export type IncomingMessageType = "join-room" | "leave-room" | "chat";

export interface BaseIncoming {
    type: IncomingMessageType;
    roomId: string;
}

export interface JoinRoomMessage extends BaseIncoming {
    type: "join-room";
}

export interface LeaveRoomMessage extends BaseIncoming {
    type: "leave-room";
}

export interface ChatMessage extends BaseIncoming {
    type: "chat";
    content: string;
}
//incoming chat message contains type, roomId and content, join/leave room messages only contain type and roomId
export type IncomingMessage = JoinRoomMessage | LeaveRoomMessage | ChatMessage;


// ─── Outgoing (ws-server → Client) ───────────────────────────────────────────
//diff between user
export type OutgoingMessageType = "chat" | "user-left" | "error" | "room-joined";

export interface OutgoingChatMessage {
    type: "chat";
    roomId: string;
    userId: string;
    content: string;
    timestamp: number;
}



export interface UserLeftMessage {
    type: "user-left";
    roomId: string;
    userId: string;
    timestamp: number;
}

export interface RoomJoinedMessage {
    type: "room-joined";
    roomId: string;
}

export interface ErrorMessage {
    type: "error";
    code: ErrorCode;
    message: string;
}

export type OutgoingMessage =
    | OutgoingChatMessage
    | UserLeftMessage
    | RoomJoinedMessage
    | ErrorMessage;


// ─── Redis Pub/Sub Payloads ───────────────────────────────────────────────────

export interface RoomBroadcastPayload {
    type: "chat" | "user-left";
    roomId: string;
    userId: string;
    content?: string;
    timestamp: number;
}

// ─── Redis Stream Payloads (for persistence) ─────────────────────────────────

export interface PersistMessagePayload {
    roomId: string;
    userId: string;
    content: string;
    timestamp: number;
}


// ─── Error Codes ──────────────────────────────────────────────────────────────

export type ErrorCode =
    | "ROOM_NOT_FOUND"
    | "ROOM_FULL"
    | "NOT_MEMBER"
    | "UNAUTHORIZED"
    | "INVALID_MESSAGE";