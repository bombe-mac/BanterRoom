export type MessageType = "join-room" | "chat";

export interface BaseMessage {
    type: MessageType;
    roomId: string;
}

export interface ChatMessage extends BaseMessage {
    type: "chat";
    content: string;
}

export interface JoinRoomMessage extends BaseMessage {
    type: "join-room";
}

export type IncomingMessage = ChatMessage | JoinRoomMessage;