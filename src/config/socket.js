let io = null;

const initSocket = (server) => {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // USER JOIN
    socket.on("join-user", (userId) => {
      console.log("User joined:", userId);
      socket.join(`user:${userId}`);
    });

    //  ADMIN AUTO JOIN (CORRECT PLACE)
    socket.join("admin");
    console.log("✅ ADMIN AUTO-JOIN:", socket.id);

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};

module.exports = { initSocket, getIO };
