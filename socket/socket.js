let io;

export const initSocket = async(server) => {
  const { Server } = await import("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 New socket connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);
    });

    // You can add more event listeners here
    // Ord    

  });
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
