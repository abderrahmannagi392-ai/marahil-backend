const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const socketIo = require("socket.io");

/* ================= APP ================= */
const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: { origin: "*" }
});

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // ✅ مهم لربط الصفحات

/* ================= DB ================= */
mongoose.connect("mongodb://127.0.0.1:27017/chat-app")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

/* ================= MODELS ================= */
const User = require("./User");
const Message = require("./models/Message");

/* ================= OTP ================= */
const otpStore = new Map();

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "abdarrahmannagi@gmail.com",
    pass: "pmdpbvjgapdjaqhb"
  }
});

/* ===================================================
   🔐 REGISTER
=================================================== */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, identifier, password } = req.body;

    if (!name || !identifier || !password) {
      return res.json({ success: false, message: "Missing fields" });
    }

    const exists = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    });

    if (exists) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email: identifier.includes("@") ? identifier : null,
      phone: !identifier.includes("@") ? identifier : null,
      password: hashed,
      verified: false,
      friends: []
    });

    await user.save();

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(identifier, code);

    setTimeout(() => otpStore.delete(identifier), 5 * 60 * 1000);

    if (identifier.includes("@")) {
      await transporter.sendMail({
        from: "Chat App",
        to: identifier,
        subject: "Verification Code",
        text: "Your code: " + code
      });
    } else {
      console.log("📱 OTP CODE:", code);
    }

    res.json({ success: true, message: "OTP sent" });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

/* ===================================================
   🔐 VERIFY OTP
=================================================== */
app.post("/api/auth/verify-code", async (req, res) => {
  const { identifier, code } = req.body;

  const saved = otpStore.get(identifier);

  if (saved === code) {
    await User.updateOne(
      { $or: [{ email: identifier }, { phone: identifier }] },
      { verified: true }
    );

    otpStore.delete(identifier);

    return res.json({ success: true });
  }

  res.json({ success: false, message: "Invalid code" });
});

/* ===================================================
   🔐 LOGIN
=================================================== */
app.post("/api/auth/login", async (req, res) => {
  const { identifier, password } = req.body;

  const user = await User.findOne({
    $or: [{ email: identifier }, { phone: identifier }]
  });

  if (!user) return res.json({ success: false });

  const match = await bcrypt.compare(password, user.password);

  if (!match) return res.json({ success: false });

  if (!user.verified) {
    return res.json({ success: false, message: "Not verified" });
  }

  res.json({
    success: true,
    user: {
      _id: user._id,
      name: user.name
    }
  });
});

/* ===================================================
   👥 USERS
=================================================== */
app.get("/api/users", async (req, res) => {
  const users = await User.find({}, "name email phone");
  res.json(users);
});

/* ===================================================
   🤝 FRIENDS
=================================================== */
app.post("/api/friends/add", async (req, res) => {
  const { userId, friendId } = req.body;

  if (!userId || !friendId) {
    return res.json({ success: false });
  }

  const user = await User.findById(userId);

  if (!user) return res.json({ success: false });

  if (!user.friends.includes(friendId)) {
    user.friends.push(friendId);
    await user.save();
  }

  res.json({ success: true });
});

/* ===================================================
   💬 CHAT HISTORY
=================================================== */
app.get("/api/messages/:user1/:user2", async (req, res) => {
  const room = [req.params.user1, req.params.user2]
    .sort()
    .join("_");

  const messages = await Message.find({ room })
    .sort({ createdAt: 1 });

  res.json(messages);
});

/* ===================================================
   📥 INBOX
=================================================== */
app.get("/api/inbox/:user", async (req, res) => {
  const user = req.params.user;

  const messages = await Message.find({
    $or: [{ from: user }, { to: user }]
  }).sort({ createdAt: -1 });

  const inbox = {};

  messages.forEach(msg => {
    const other = msg.from === user ? msg.to : msg.from;

    if (!inbox[other]) {
      inbox[other] = {
        user: other,
        lastMessage: msg.text,
        time: new Date(msg.createdAt).toLocaleTimeString(),
        unread: msg.to === user ? 1 : 0
      };
    } else {
      if (msg.to === user) inbox[other].unread++;
    }
  });

  res.json(Object.values(inbox));
});

/* ===================================================
   ⚡ SOCKET.IO
=================================================== */
const onlineUsers = new Map();

io.on("connection", (socket) => {

  console.log("🟢 User connected");

  socket.on("user_online", (user) => {
    if (!user) return;

    onlineUsers.set(user, socket.id);
    io.emit("online_users", [...onlineUsers.keys()]);
  });

  socket.on("send_message", async ({ from, to, text }) => {

    if (!from || !to || !text) return;

    const room = [from, to].sort().join("_");

    const message = new Message({
      room,
      from,
      to,
      text,
      createdAt: new Date()
    });

    await message.save();

    const payload = {
      from,
      to,
      text,
      createdAt: message.createdAt
    };

    const target = onlineUsers.get(to);

    if (target) {
      io.to(target).emit("receive_message", payload);
    }

    socket.emit("receive_message", payload);
  });

  socket.on("disconnect", () => {
    for (let [user, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(user);
        break;
      }
    }

    io.emit("online_users", [...onlineUsers.keys()]);
  });

});

/* ===================================================
   🚀 START SERVER
=================================================== */
server.listen(3001, () => {
  console.log("🚀 Server running on http://localhost:3001");
});