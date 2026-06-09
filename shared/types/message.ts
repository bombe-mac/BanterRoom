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
//diff between user-left and leave-room is that user-left is sent to other clients in the room when someone leaves, while leave-room is sent by the client to ws-server to indicate they want to leave a room. user-left contains userId of the user who left, while leave-room does not contain userId as it is sent by the client itself
export type OutgoingMessageType = "chat" | "error" | "room-joined";

export interface OutgoingChatMessage {
    type: "chat";
    roomId: string;
    userId: string;
    content: string;
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
    | RoomJoinedMessage
    | ErrorMessage;


// ─── Redis Pub/Sub Payloads ───────────────────────────────────────────────────

export interface RoomBroadcastPayload {
    type: "chat";
    roomId: string;
    userId: string;
    content: string;
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