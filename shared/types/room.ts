export interface Room {
    id: string;
    name: string;
    ownerId: string;
    createdAt: Date;
}

export interface RoomMember {
    userId: string;
    roomId: string;
    joinedAt: Date;
}