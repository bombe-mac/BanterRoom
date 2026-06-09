import {WebSocket} from "ws";

interface RoomState{
    sockets: Set<WebSocket>;
}
//roomId to socket(number of sockets per room) mapping
const rooms: Record<string, RoomState>={};

export const joinRoom=(roomId: string, ws: WebSocket)=>{
    if(!rooms[roomId]){
        rooms[roomId]={sockets: new Set()}
    }
    rooms[roomId].sockets.add(ws);
};

//used when leaving the chat window
export const leaveAllRooms=(ws: WebSocket)=>{
    for(const roomId in rooms){
        rooms[roomId]?.sockets.delete(ws);
    }
}

//used to leave a specific room, for example when user clicks "leave room" button
export const leaveRoom=(roomId: string, ws: WebSocket)=>{
    rooms[roomId]?.sockets.delete(ws);
}

//send message to all clients(user) in a room
export const broadcastToRoom = (roomId: string, data: string) => {
    rooms[roomId]?.sockets.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(data);
        }
    });
};