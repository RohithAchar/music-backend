import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080, host: "0.0.0.0" });

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

const generateId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message", function message(data) {
    const message = JSON.parse(data.toString());
    if (message.type === "create_room") {
      console.log("create room");
      const { id, name } = message.data;
      if (db[id]) {
        db[id].users[0] = ws;
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
      //   If room has no songs then add the song and set it as active
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
    } else if (message.type === "down_vote") {
      console.log("down vote");
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
      if (!song.votes.includes(userId)) {
        return ws.send(
          JSON.stringify({ type: "error", data: "you are not voted this song" })
        );
      }
      song.votes = song.votes.filter((vote) => vote !== userId);
      db[roomId].songs.sort((a, b) => b.votes.length - a.votes.length);
      db[roomId].users.forEach((user) => {
        user.send(
          JSON.stringify({ type: "song_updated", data: db[roomId].songs })
        );
      });
    } else if (message.type === "on_end") {
      console.log("on end");
      const { roomId } = message.data;
      db[roomId].songs = db[roomId].songs.filter((song) => !song.isActive);
      if (db[roomId].songs.length > 0) {
        const activeSong = db[roomId].songs.sort(
          (a, b) => b.votes.length - a.votes.length
        )[0];
        activeSong.isActive = true;
        db[roomId].users.forEach((user) => {
          user.send(JSON.stringify({ type: "active_song", data: activeSong }));
        });
      }
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
