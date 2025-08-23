let io;

export const initSocket = async(server) => {
  const { Server } = await import("socket.io");
  io = new Server(server, {
    ors: {
      origin: [
        "http://localhost:3000",
        "http://localhost:5173", 
        "https://your-frontend-domain.com", // Add your actual frontend domain
        "https://talabatak-backend2.vercel.app" // If frontend is also on Vercel
      ],
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"]
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
