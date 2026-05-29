import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

import type { JwtPayload } from "@chat/shared-types";

export interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = req.headers.token as string | undefined;
    if (!token) {
        return res.status(401).json({ message: "Token missing" });
    }   
    
    try {        
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded as JwtPayload;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }   
};