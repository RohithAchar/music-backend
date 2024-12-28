"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const wss = new ws_1.WebSocketServer({ port: 8080 });
let db = {};
wss.on("connection", function connection(ws) {
    ws.on("error", console.error);
    ws.on("message", function message(data) {
        const message = JSON.parse(data.toString());
        if (message.type === "create_room") {
            const { id, name } = message.data;
            console.log("creating room", id, name);
        }
    });
    ws.send("something");
});
