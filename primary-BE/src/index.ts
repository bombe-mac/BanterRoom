import 'dotenv/config';
import express from 'express';
import * as z from 'zod';
import { Prisma, prisma } from '@chat/shared-types';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken"
import { authMiddleware, type AuthenticatedRequest } from "./middleware/authMiddleware";


const app = express();

const isPrismaKnownRequestError = (
    error: unknown
): error is Prisma.PrismaClientKnownRequestError => {
    return error instanceof Prisma.PrismaClientKnownRequestError;
};

app.use(express.json());

//Authentication endpoints
app.post("/api/v1/auth/register", async (req, res) => {
    console.log("Received signup request:", req.body);
    const schema = z.object({
        username: z.string().trim().min(3).max(30),

        email: z.email(),

        password: z
        .string()
        .min(6)
        .max(100)
        .refine((val) => /[A-Z]/.test(val), {
            message: "Password must contain at least one uppercase letter",
        })
        .refine((val) => /[0-9]/.test(val), {
            message: "Password must contain at least one number",
        })
        .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
            message: "Password must contain at least one special character",
        }),
    });

    const parsed = await schema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
        errors: parsed.error.flatten(),
        });
    }

    const { username, email, password } = parsed.data;

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
        data: {
            username,
            email,
            passwordHash,
        },
        select: {
            id: true,
            username: true,
            email: true,
            createdAt: true,
        },
        });

        return res.status(201).json({
        message: "User created successfully",
        user,
        });

    } catch (error) {
        // Prisma unique constraint error
        if (isPrismaKnownRequestError(error) && error.code === "P2002") {
        return res.status(409).json({
            error: "Email or username already exists",
        });
        }

        console.error(error);
        return res.status(500).json({
        error: "Internal server error",
        });
    }
});

    //get the jwt token from this endpoint and use it to access the chat dashboard
app.get("/api/v1/auth/login", async (req, res) => {
    // Implementation for getting JWT token
    try{
        const schema=  z.object({
            username: z.string().trim().min(3).max(30),
            password: z
        .string()
        .min(6)
        .max(100)
        .refine((val) => /[A-Z]/.test(val), {
            message: "Password must contain at least one uppercase letter",
        })
        .refine((val) => /[0-9]/.test(val), {
            message: "Password must contain at least one number",
        })
        .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
            message: "Password must contain at least one special character",
        }),
        });

        const parsed = schema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
            errors: parsed.error.flatten(),
            });
        }

        const { username, password } = parsed.data;

        // Find user by username
        const user = await prisma.user.findUnique({
            where: { username }
        });
        if (!user) {
            return res.status(401).json({
                error: "Invalid username or password",
            });
        }

        const isPasswordValid= await bcrypt.compare(password,user.passwordHash)

        if(isPasswordValid){
            const token=jwt.sign({username: username}, process.env.JWT_SECRET!);
            return res.status(200).json({ token, username });
        }
        else{
            return res.status(401).json({
                error: "Invalid username or password",
            });
        }
    }
    catch(error){
        console.error(error);
        return res.status(500).json({
            error: "Internal server error",
        });
    }
});

//Message endpoints
app.get("/api/v1/messages/:roomId", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
    const { roomId } = req.params as { roomId: string };
    const { cursor, limit = "50" } = req.query;

    // validate limit
    const take = Math.min(Math.max(Number(limit), 1), 100);

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required",
      });
    }

    if (isNaN(take)) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit",
      });
    }

    // Check user membership
    // assuming auth middleware sets req.user
    const membership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: req.user!.userId,
          roomId
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized room access",
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        roomId,
      },

      ...(cursor && {
        cursor: {
          id: cursor as string,
        },
        skip: 1,
      }),

      take,

      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }, // stable order
      ],

      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // DB gives newest -> oldest
    // UI wants oldest -> newest
    const orderedMessages = [...messages].reverse();

    const nextCursor =
      messages.length === take
        ? messages[messages.length - 1]?.id
        : null;

    return res.status(200).json({
      success: true,
      data: {
        roomId,
        messages: orderedMessages,
        pagination: {
          nextCursor,
          hasMore: messages.length === take,
          limit: take,
        },
      },
    });
  } catch (error) {
    console.error("Fetch messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
})

// Endpoint to send a message to a room


//Room endpoints
  //create room
app.post("/api/v1/room", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body;

    // owner should come from auth middleware, not frontend
    const ownerId = req.user?.userId;

    if (!name || !ownerId) {
      return res.status(400).json({
        success: false,
        message: "Room name and owner ID are required",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
//tx used to ensure that both room creation and membership addition happen atomically. If either operation fails, the entire transaction will be rolled back, maintaining data integrity.
      // create room
      const room = await tx.room.create({
        data: {
          name,
          ownerId,
        }
      });

      // add owner as member
      await tx.roomMember.create({
        data: {
          userId: ownerId,
          roomId: room.id,
        }
      });

      return room;
    });

    return res.status(201).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error("Create room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create room",
    });
  }
});

  //get rooms
app.get("/api/v1/rooms", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    if(!userId){
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const rooms = await prisma.roomMember.findMany({
      where: {
        userId,
      },
      include: {
        room: {
          select: {
            id: true,
            name: true
          },
        }
      }
    });
    return res.status(200).json({
      success: true,
      data: rooms.map((rm) => rm.room)
    });
  } catch (error) {
    console.error("Fetch rooms error:", error);
        }
      
    });

    //join room
app.post("/api/v1/room/:roomId/join", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const  roomId  = req.params.roomId as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required",
      });
    }

    const membership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId,
          roomId
        },
      },
    });

    if (membership) {
      return res.status(400).json({
        success: false,
        message: "Already a member of this room",
      });
    }

    await prisma.roomMember.create({
      data: {
        userId,
        roomId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Successfully joined the room",
    });
  } catch (error) {
    console.error("Join room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to join room",
    });
  }
});

  //leave room
app.post("/api/v1/room/:roomId/leave", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const  roomId  = req.params.roomId as string;
    const userId = req.user?.userId;
    await prisma.roomMember.delete({
      where: {
        userId_roomId: {
          userId: userId!,
          roomId
        },  
      },
    });
    return res.status(200).json({
      success: true,
      message: "Successfully left the room",
    });
  } catch (error) {
    console.error("Leave room error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to leave room",
    });
  }
});


app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});



