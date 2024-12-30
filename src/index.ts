import WebSocket, { WebSocketServer } from "ws";
import http from "http";

const server = http.createServer();
const wss = new WebSocketServer({ server: server });

type DB = {
  [key: string]: Room;
};
type Room = {
  name: string;
  admin: WebSocket;
  songs: Song[];
  users: WebSocket[];
};
type Song = {
  id: string;
  title: string;
  url: string;
  smallThumbnail: string;
  largeThumbnail: string;
  isActive: boolean;
  votes: string[];
};

let db: DB = {};

// Cleanup function to remove unused rooms
const cleanUpRooms = () => {
  for (const roomId in db) {
    const room = db[roomId];
    room.users = room.users.filter(
      (user) => user.readyState === WebSocket.OPEN
    );

    if (room.users.length === 0) {
      console.log(`Deleting unused room: ${roomId}`);
      delete db[roomId];
    }
  }
};

// Run cleanup every minute
setInterval(cleanUpRooms, 60000);

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("close", () => {
    for (const roomId in db) {
      const room = db[roomId];
      room.users = room.users.filter((user) => user !== ws);

      if (room.admin === ws) {
        // If the admin disconnects, transfer admin rights to another user or remove the room
        if (room.users.length > 0) {
          room.admin = room.users[0];
          console.log(
            `Admin disconnected. Transferring admin rights in room: ${roomId}`
          );
        } else {
          console.log(`No users left in room: ${roomId}. Deleting room.`);
          delete db[roomId];
        }
      }
    }
  });

  ws.on("message", function message(data) {
    const message = JSON.parse(data.toString());
    if (message.type === "create_room") {
      console.log("create room");
      const { id, name } = message.data;
      if (db[id]) {
        db[id].users.push(ws);
        const activeSong = db[id].songs.find((song) => song.isActive);
        if (activeSong) {
          ws.send(JSON.stringify({ type: "active_song", data: activeSong }));
        }
        return ws.send(
          JSON.stringify({ type: "song_updated", data: db[id].songs })
        );
      }
      db[id] = { name, admin: ws, songs: [], users: [ws] };
      ws.send(JSON.stringify({ type: "room_created", data: db[id] }));
    } else if (message.type === "join_room") {
      console.log("join room");
      const { roomId } = message.data;

      if (!db[roomId]) {
        return ws.send(
          JSON.stringify({ type: "error", data: "room does not exist" })
        );
      }

      db[roomId].users.push(ws);
      const activeSong = db[roomId].songs.find((song) => song.isActive);
      if (activeSong) {
        ws.send(JSON.stringify({ type: "active_song", data: activeSong }));
      }
      ws.send(JSON.stringify({ type: "song_updated", data: db[roomId].songs }));
    } else if (message.type === "add_song") {
      console.log("add song");
      const { roomId, song } = message.data;

      if (!db[roomId]) {
        return ws.send(
          JSON.stringify({ type: "error", data: "room does not exist" })
        );
      }

      const songExists = db[roomId].songs.some(
        (existingSong) => existingSong.id === song.id
      );

      if (songExists) {
        return ws.send(
          JSON.stringify({
            type: "song_already_exists",
            data: "This song is already in the queue.",
          })
        );
      }

      if (db[roomId].songs.length === 0) {
        db[roomId].songs.push({ ...song, votes: [], isActive: true });
        db[roomId].users.forEach((user) => {
          user.send(
            JSON.stringify({
              type: "active_song",
              data: { ...song, votes: [] },
            })
          );
        });
      } else {
        db[roomId].songs.push({ ...song, votes: [], isActive: false });
        db[roomId].users.forEach((user) => {
          user.send(
            JSON.stringify({ type: "song_added", data: { ...song, votes: [] } })
          );
        });
      }
    } else if (message.type === "up_vote") {
      console.log("up vote");
      const { roomId, songId, userId } = message.data;
      if (!db[roomId]) {
        return ws.send(
          JSON.stringify({ type: "error", data: "room does not exist" })
        );
      }
      const song = db[roomId].songs.find((song) => song.id === songId);
      if (!song) {
        return ws.send(
          JSON.stringify({ type: "error", data: "song does not exist" })
        );
      }
      if (song.votes.includes(userId)) {
        return ws.send(
          JSON.stringify({ type: "error", data: "already upvoted" })
        );
      }
      song.votes.push(userId);
      db[roomId].songs.sort((a, b) => b.votes.length - a.votes.length);
      db[roomId].users.forEach((user) => {
        user.send(
          JSON.stringify({ type: "song_updated", data: db[roomId].songs })
        );
      });
    }
  });

  console.log("connected");
  ws.send("Connected!");
});

server.listen(8080, () => {
  console.log("Server is listening on port 8080");
});
