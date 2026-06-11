import { WebSocketServer, WebSocket } from "ws";
import { sub, CHANNEL } from "../redis/client.js";
import { broadcastToRoom, leaveAllRooms } from "./rooms.js";
import { handleMessage } from "./handler.js";
import type { JwtPayload } from "@chat/shared-types";
import jwt from "jsonwebtoken";
const { verify } = jwt;

export const startServer=(port: number)=>{
    const wss =new WebSocketServer({port});
    //subscribe to chat channel
    sub.subscribe(CHANNEL);

    sub.on('message', (channel, data)=>{
        if(channel!== CHANNEL) return;

        try {
            const parse=JSON.parse(data);
            broadcastToRoom(parse.roomId, data)
        } catch (error) {
            console.error('Invalid message from Redis');
        }
    })

    wss.on('connection', (ws: WebSocket, req)=>{
        // Expect token as query param: ws://host:port/?token=...
        const query = typeof req?.url === 'string' ? req.url.split('?')[1] ?? '' : '';
        const params = new URLSearchParams(query);
        const token = params.get('token');
        if (!token) {
            ws.close(1008, 'Unauthorized');
            return;
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('JWT_SECRET not set');
            ws.close(1011, 'Server misconfigured');
            return;
        }

        let payload: JwtPayload;
        try {
            payload = verify(token, secret) as JwtPayload;
        } catch (err) {
            ws.close(1008, 'Invalid token');
            return;
        }

        // attach authenticated payload to socket for handlers
        //Extend the TypeScript type of ws to include user property
        (ws as WebSocket & { user: JwtPayload }).user = payload as JwtPayload;

        
        ws.on('message', (data)=> {
            console.log("data recieved")
            handleMessage(ws, data.toString())
            console.log("message handelled")
        })

        ws.on('close', () => {
        leaveAllRooms(ws);
        });

        ws.on('error', console.error);
    })

    console.log(`WS Server running on port ${port}`);
}