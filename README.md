# Distributed Scalable Chat Application Architecture

The application is a horizontally scalable realtime chat platform built using Next.js, Express.js, WebSockets (`ws`), Redis, and PostgreSQL. The architecture is designed to support multiple distributed WebSocket servers without relying on sticky sessions, enabling efficient autoscaling, fault tolerance, and low-latency realtime communication.

The frontend is developed using Next.js and handles authentication, room management, and the realtime chat interface. REST APIs are used for operations such as login, room creation, fetching metadata, and chat history, while WebSocket connections are used for realtime message exchange and presence updates.

The backend is divided into three major layers: the primary REST API layer, the WebSocket layer, and the asynchronous worker layer.

The REST API layer, built with Express.js, is responsible for authentication, authorization, room creation, validation, user management, and database interactions related to metadata and historical queries. This layer remains stateless to support independent scaling and deployment.

The realtime layer consists of multiple distributed WebSocket servers built using Express and the `ws` library. Since the architecture avoids sticky sessions, users connected to the same room may be distributed across different WebSocket servers. To synchronize realtime communication across all servers, Redis Pub/Sub is used as the inter-server event bus. When a client sends a message, the connected WebSocket server immediately publishes the event to Redis Pub/Sub channels. All subscribed WebSocket servers receive the event and broadcast it to their locally connected clients, enabling low-latency distributed realtime messaging.

Redis is also used for distributed state management, including room membership tracking, socket-to-user mappings, connection metadata, and presence management. Presence is maintained using heartbeat mechanisms and Redis TTL keys, allowing automatic offline detection when clients disconnect unexpectedly.

For durable message persistence, Redis Streams are used alongside Pub/Sub. Each incoming message is appended to a Redis Stream using `XADD` before being asynchronously processed by dedicated worker services. These worker services consume stream events using Redis consumer groups (`XREADGROUP`) and persist messages into PostgreSQL. By offloading database writes to separate workers, the WebSocket servers remain lightweight and optimized for realtime communication without being blocked by database latency or persistence overhead.

This asynchronous event-driven pipeline improves scalability, fault tolerance, and throughput under high concurrency. Since Redis Streams provide durable event storage and replay capabilities, unprocessed messages can still be recovered if a worker crashes or restarts. Multiple worker instances can also be scaled horizontally to handle increasing write throughput independently from the WebSocket layer.

The architecture enforces distributed constraints such as a maximum of 10 active rooms per user and 100 users per room using Redis atomic operations or Lua scripts to prevent race conditions across multiple distributed servers.

To ensure reliability, the system supports automatic reconnection, message replay using streams or database history, retry handling, and distributed fault tolerance. Additional concerns such as backpressure handling, message ordering, rate limiting, batching, idempotent processing, and slow consumer management are also considered to maintain stability and consistency under high load.

Overall, the system follows an event-driven, stateless, and horizontally scalable architecture optimized for realtime communication, distributed coordination, asynchronous persistence, and resilient high-concurrency operation.
