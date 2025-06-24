require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const session = require("express-session");
const path = require("path");
const nodemailer = require("nodemailer");
const helmet = require("helmet");
const multer = require("multer");
const http = require("http");
const socketio = require("socket.io");
const app = express();

const server = http.createServer(app);
const io = socketio(server);

io.on("connection", (socket) => {
  // console.log("✅ A user connected");

  socket.on("typing", ({ sender, receiver }) => {
    socket.broadcast.emit("showTyping", { sender, receiver });
  });

  socket.on("stopTyping", ({ sender, receiver }) => {
    socket.broadcast.emit("hideTyping", { sender, receiver });
  });
});

const PORT = process.env.PORT || 3000;
app.use(helmet());

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to the MySQL database");
  }
});
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());


function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  })
);

app.get("/contact", (req, res) => {
  res.render("contact");
});

app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;

  // For now, just log the message (later, integrate with email or DB)
  console.log(`📩 New Contact Form:
  From: ${name} <${email}>
  Message: ${message}`);

  res.send("Thank you for contacting us! We'll get back to you shortly.");
});

app.get("/help", (req, res) => {
  res.render("help");
});

app.get("/terms", (req, res) => {
  res.render("terms");
});

app.get("/privacy", (req, res) => {
  res.render("privacy");
});
const upload = multer({ storage: storage });

app.get("/edit-profile", (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.redirect("/login");

  const sql = "SELECT * FROM users WHERE id = ?";
  db.query(sql, [userId], (err, rows) => {
    if (err || rows.length === 0) return res.send("User not found");
    res.render("edit_profile", { user: rows[0] });
  });
});

app.post("/edit-profile", upload.single("avatar"), (req, res) => {
  const userId = req.session.userId;
  const { bio } = req.body;
  let avatarUrl = '';

  if (req.file) {
    avatarUrl = "/uploads/" + req.file.filename;
  }

  const sql = avatarUrl
    ? "UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?"
    : "UPDATE users SET bio = ? WHERE id = ?";

  const params = avatarUrl
    ? [bio, avatarUrl, userId]
    : [bio, userId];

  db.query(sql, params, (err, result) => {
    if (err) return res.send("Update failed.");
    res.redirect(`/user/${req.session.username}`);
  });
});

app.get('/search', (req, res) => {
  const username = req.query.username;

  const searchQuery = 'SELECT * FROM users WHERE username = ?';
  db.query(searchQuery, [username], (err, results) => {
    if (err) {
      console.error(err);
      return res.send("Error occurred");
    }

    if (results.length > 0) {
      res.redirect(`/user/${username}`);
    } else {
      res.render('usernotfound', { searched: username });
    }
  });
});


// redirect root → signup
app.get("/", (req, res) => {
  if (!req.session.username) {
    return res.redirect("/login");
  }

  db.query("SELECT * FROM tweets ORDER BY time DESC", (err, tweets) => {
    if (err) throw err;
    res.render("index", {
      tweets: tweets,
      username: req.session.username
    });
  });
});

app.get("/signup", (req, res) => res.render("signup"));

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.send("Missing fields");

  try {
    const hashed = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
    db.query(sql, [username, email, hashed], err => {
      if (err) {
        console.error(err);
        return res.send("Username or Email already exists.");
      }
      res.redirect("/login");
    });
  } catch (e) {
    res.send("Signup error");
  }
});
// 1. Show form
app.get("/forgot-password", (req, res) => {
  res.render("forgot");
});

// 2. Handle form POST
app.post("/forgot-password", (req, res) => {
  const { email } = req.body;

  const token = crypto.randomBytes(20).toString('hex');
  const expires = Date.now() + 3600000; // 1 hour

  const sql = "UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?";
  db.query(sql, [token, expires, email], (err, result) => {
    if (err || result.affectedRows === 0) return res.send("Email not found.");

    // Send email using nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "st831062@gmail.com",
        pass: "gwcc ktrv jitg tovo"
      }
    });

    const resetLink = `http://localhost:3000/reset-password/${token}`;
    const mailOptions = {
      from: "Twitter Feed <yourgmail@gmail.com>",
      to: email,
      subject: "Reset Your Twitter Feed Password",
      html: `<p>Click the link below to reset your password:</p><a href="${resetLink}">${resetLink}</a>`
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error(err);
        return res.send("Error sending email.");
      }

      // ✅ Redirect to login page with a success query parameter
      res.redirect("/login?reset=sent");
    });
  });
});

app.get("/reset-password/:token", (req, res) => {
  const { token } = req.params;
  const sql = "SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?";
  db.query(sql, [token, Date.now()], (err, results) => {
    if (err || results.length === 0) return res.send("Invalid or expired token.");
    res.render("reset_password", { token });
  });
});

app.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  const sql = `
    UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL 
    WHERE reset_token = ? AND reset_expires > ?`;

  db.query(sql, [hash, token, Date.now()], (err, result) => {
    if (err || result.affectedRows === 0) return res.send("Reset failed.");
    res.send("✅ Password updated! You can now login.");
  });
});


app.get("/login", (req, res) => {
  const reset = req.query.reset;
  res.render("login", { reset });
});


app.post("/login", (req, res) => {
  const { loginInput, password } = req.body;
  if (!loginInput || !password) return res.send("Missing fields");

  const sql = "SELECT * FROM users WHERE username = ? OR email = ?";
  db.query(sql, [loginInput, loginInput], async (err, rows) => {
    if (err || rows.length === 0)
      return res.send("Invalid credentials");

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Incorrect password");

    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect("/feed");
  });
});


app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/feed", requireAuth, (req, res) => {
  const tweetSql = "SELECT * FROM tweets ORDER BY time DESC";
  db.query(tweetSql, (err, tweets) => {
    if (err) return res.send("DB error loading tweets");

    if (tweets.length === 0)
      return res.render("index", { tweets: [], username: req.session.username });

    const ids = tweets.map(t => t.id);
    const commentSql =
      "SELECT * FROM comments WHERE tweet_id IN (?) ORDER BY time ASC";
    db.query(commentSql, [ids], (err, comments) => {
      if (err) return res.send("DB error loading comments");

      // group comments by tweet_id
      const map = {};
      comments.forEach(c => {
        (map[c.tweet_id] = map[c.tweet_id] || []).push(c);
      });
      tweets.forEach(t => (t.comments = map[t.id] || []));

      res.render("index", { tweets, username: req.session.username });
    });
  });
});

app.post("/tweet", requireAuth, (req, res) => {
  const { content } = req.body;
  const username = req.session.username;
  if (!content) return res.redirect("/feed");

  const sql = "INSERT INTO tweets (username, content) VALUES (?, ?)";
  db.query(sql, [username, content], err => {
    if (err) console.error(err);
    res.redirect("/feed");
  });
});




app.post("/delete/:id", requireAuth, (req, res) => {
  const sql = "DELETE FROM tweets WHERE id = ?";
  db.query(sql, [req.params.id], () => res.redirect("/feed"));
});

app.post("/comment/:tweetId", requireAuth, (req, res) => {
  const { tweetId } = req.params;
  const { comment } = req.body;
  const username = req.session.username;
  if (!comment) return res.redirect("/feed");

  const sql =
    "INSERT INTO comments (tweet_id, username, comment) VALUES (?, ?, ?)";
  db.query(sql, [tweetId, username, comment], () => res.redirect("/feed"));
});

app.get("/api/tweets", (req, res) => {
  db.query("SELECT * FROM tweets ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
});

app.post("/api/tweets", requireAuth, (req, res) => {
  const { content } = req.body;
  const username = req.session.username;
  if (!content) return res.status(400).json({ error: "Content required" });

  const sql = "INSERT INTO tweets (username, content) VALUES (?, ?)";
  db.query(sql, [username, content], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.status(201).json({ message: "Tweet posted", tweetId: result.insertId });
  });
});

/* ────────────────────────────────────────────────────────────────
   GET /user/:username   — profile page
   ---------------------------------------------------------------- */
app.get('/user/:username', (req, res) => {
  const profileUsername = req.params.username;
  const viewerId = req.session.userId || null;

  const profileSql = "SELECT * FROM users WHERE username = ?";
  db.query(profileSql, [profileUsername], (err, uRows) => {
    if (err || uRows.length === 0) return res.status(404).send("User not found");
    const profile = uRows[0];
    const isOwner = req.session.username === profileUsername;

    const tweetSql = "SELECT * FROM tweets WHERE username = ? ORDER BY time DESC";
    db.query(tweetSql, [profileUsername], (err2, tweets) => {
      if (err2) return res.status(500).send("Error loading tweets");

      const ids = tweets.map(t => t.id);
      const commentSql = ids.length
        ? "SELECT * FROM comments WHERE tweet_id IN (?) ORDER BY time ASC"
        : null;

      const attachComments = (cb) => {
        if (!commentSql) return cb(null);
        db.query(commentSql, [ids], (err3, comments) => {
          if (err3) return cb(err3);
          const map = {};
          comments.forEach(c => {
            (map[c.tweet_id] = map[c.tweet_id] || []).push(c);
          });
          tweets.forEach(t => (t.comments = map[t.id] || []));
          cb(null);
        });
      };

      attachComments(err3 => {
        if (err3) return res.status(500).send("Error loading comments");

        const isFollowingSql = `
          SELECT 1 FROM follows
          WHERE follower_id = ? AND following_id = ?
        `;
        db.query(isFollowingSql, [viewerId, profile.id], (e4, fRes) => {
          if (e4) return res.status(500).send("Error loading follow status");
          const isFollowing = fRes.length > 0;

          const countFollowersSql = "SELECT COUNT(*) AS c FROM follows WHERE following_id = ?";
          const countFollowingSql = "SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?";

          db.query(countFollowersSql, [profile.id], (e5, r1) => {
            if (e5) return res.status(500).send("Error counting followers");
            db.query(countFollowingSql, [profile.id], (e6, r2) => {
              if (e6) return res.status(500).send("Error counting following");

              res.render("profile", {
                username: profileUsername,
                profile,
                tweets,
                isOwner,
                isFollowing,
                followerCount: r1[0].c,
                followingCount: r2[0].c
              });
            });
          });
        });
      });
    });
  });
});



// Follow a user
app.post("/follow/:username", (req, res) => {
  const followerId = req.session.userId;
  const followingUsername = req.params.username;

  console.log("👉 Attempt to follow:", req.session.userId, "→", req.params.username);

  const getIdSql = "SELECT id FROM users WHERE username = ?";
  db.query(getIdSql, [followingUsername], (err, results) => {
    if (err || results.length === 0) return res.send("User not found");
    const followingId = results[0].id;

    if (followerId === followingId) return res.send("You can't follow yourself.");

    const insertSql = "INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)";
    db.query(insertSql, [followerId, followingId], (err) => {
      if (err) return res.send("Error following user");
      res.redirect(`/user/${followingUsername}`);
    });
  });
});

/* ───────────────────────────────────────────────
   POST /like/:id   — like a tweet (AJAX-friendly)
   ─────────────────────────────────────────────── */
app.post("/like/:id", requireAuth, (req, res) => {
  const tweetId = req.params.id;
  const userId = req.session.userId;

  // Check if user already liked this tweet
  const checkSql = "SELECT * FROM likes WHERE user_id = ? AND tweet_id = ?";
  db.query(checkSql, [userId, tweetId], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });

    if (rows.length > 0) {
      // Already liked → do nothing
      db.query("SELECT likes FROM tweets WHERE id = ?", [tweetId], (err2, r2) => {
        if (err2) return res.status(500).json({ error: "Fetch failed" });
        return res.json({ likes: r2[0].likes });
      });
    } else {
      // Insert like and increment count
      const insertLikeSql = "INSERT INTO likes (user_id, tweet_id) VALUES (?, ?)";
      db.query(insertLikeSql, [userId, tweetId], (err3) => {
        if (err3) return res.status(500).json({ error: "Insert failed" });

        db.query("UPDATE tweets SET likes = likes + 1 WHERE id = ?", [tweetId], (err4) => {
          if (err4) return res.status(500).json({ error: "Update failed" });

          db.query("SELECT likes FROM tweets WHERE id = ?", [tweetId], (err5, r5) => {
            if (err5) return res.status(500).json({ error: "Fetch after update failed" });
            return res.json({ likes: r5[0].likes });
          });
        });
      });
    }
  });
});


// Unfollow a user
app.post("/unfollow/:username", (req, res) => {
  const followerId = req.session.userId;
  const followingUsername = req.params.username;

  const getIdSql = "SELECT id FROM users WHERE username = ?";
  db.query(getIdSql, [followingUsername], (err, results) => {
    if (err || results.length === 0) return res.send("User not found");
    const followingId = results[0].id;

    const deleteSql = "DELETE FROM follows WHERE follower_id = ? AND following_id = ?";
    db.query(deleteSql, [followerId, followingId], (err) => {
      if (err) return res.send("Error unfollowing user");
      res.redirect(`/user/${followingUsername}`);
    });
  });
});



app.get("/edit/:id", requireAuth, (req, res) => {
  const tweetId = req.params.id;
  const sql = "SELECT * FROM tweets WHERE id = ?";
  db.query(sql, [tweetId], (err, rows) => {
    if (err || rows.length === 0) return res.send("Tweet not found");
    const tweet = rows[0];

    // Only allow editing own tweets
    if (tweet.username !== req.session.username) return res.redirect("/feed");

    res.render("edit", { tweet });
  });
});

app.post("/edit/:id", requireAuth, (req, res) => {
  const tweetId = req.params.id;
  const { content } = req.body;

  const sql = "UPDATE tweets SET content = ? WHERE id = ?";
  db.query(sql, [content, tweetId], (err) => {
    if (err) return res.send("Edit failed");
    res.redirect("/feed");
  });
});


// 📩 Show all users except self to start a DM
app.get("/dm", requireAuth, (req, res) => {
  const userId = req.session.userId;
  db.query("SELECT id, username FROM users WHERE id != ?", [userId], (err, users) => {
    if (err) return res.send("Error loading users");
    res.render("dm_users", { users });
  });
});

// 📩 Show chat with selected user
/* ----------  Direct‑Message (DM) routes  ---------- */

// GET  /dm/:id   ➜ show chat with selected user
app.get("/dm/:id", requireAuth, (req, res) => {
  const receiverId = parseInt(req.params.id, 10);
  const currentUserId = req.session.userId;
  const currentUser = { id: currentUserId, username: req.session.username };

  db.query("SELECT id, username FROM users WHERE id = ?", [receiverId], (err, rows) => {
    if (err || rows.length === 0) return res.send("User not found");
    const recipient = rows[0];

    const msgSql = `
      SELECT m.*, u.username AS sender_name
      FROM   messages m
      JOIN   users    u ON u.id = m.sender_id
      WHERE  (m.sender_id = ? AND m.receiver_id = ?)
         OR  (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.time ASC
    `;
    const params = [currentUserId, receiverId, receiverId, currentUserId];

    db.query(msgSql, params, (err, messages) => {
      if (err) {
        console.error("MySQL Error (DM fetch):", err);
        return res.send("Error loading messages");
      }

      res.render("dm_chat", {
        recipient,
        messages,
        currentUserId,
        currentUser
      });
    });
  });
});

// POST /dm/:id  ➜ send a new private message
app.post("/dm/:id", requireAuth, (req, res) => {
  const receiverId = parseInt(req.params.id, 10);
  const senderId = req.session.userId;
  const { message } = req.body;

  if (!message) return res.redirect(`/dm/${receiverId}`);

  const insertSql = `
    INSERT INTO messages (sender_id, receiver_id, message)
    VALUES (?, ?, ?)
  `;
  db.query(insertSql, [senderId, receiverId, message], err => {
    if (err) {
      console.error("MySQL Error (DM insert):", err);
      return res.send("Error sending message");
    }
    res.redirect(`/dm/${receiverId}`);   // refresh chat
  });
});

// Follow a user
app.post("/follow/:username", (req, res) => {
  const followerId = req.session.userId;
  const followingUsername = req.params.username;

  const getIdSql = "SELECT id FROM users WHERE username = ?";
  db.query(getIdSql, [followingUsername], (err, results) => {
    if (err || results.length === 0) return res.send("User not found");
    const followingId = results[0].id;

    if (followerId === followingId) return res.send("You can't follow yourself.");

    const insertSql = "INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)";
    db.query(insertSql, [followerId, followingId], (err) => {
      if (err) return res.send("Error following user");
      res.redirect(`/user/${followingUsername}`);
    });
  });
});

// Unfollow a user
app.post("/unfollow/:username", (req, res) => {
  const followerId = req.session.userId;
  const followingUsername = req.params.username;

  const getIdSql = "SELECT id FROM users WHERE username = ?";
  db.query(getIdSql, [followingUsername], (err, results) => {
    if (err || results.length === 0) return res.send("User not found");
    const followingId = results[0].id;

    const deleteSql = "DELETE FROM follows WHERE follower_id = ? AND following_id = ?";
    db.query(deleteSql, [followerId, followingId], (err) => {
      if (err) return res.send("Error unfollowing user");
      res.redirect(`/user/${followingUsername}`);
    });
  });
});

app.post("/like/:id", requireAuth, (req, res) => {
  const tweetId = req.params.id;

  const updateSql = "UPDATE tweets SET likes = likes + 1 WHERE id = ?";
  db.query(updateSql, [tweetId], (err) => {
    if (err) return res.status(500).send("Error updating likes");

    const getLikesSql = "SELECT likes FROM tweets WHERE id = ?";
    db.query(getLikesSql, [tweetId], (err2, rows) => {
      if (err2 || rows.length === 0) {
        return res.status(500).send("Error fetching updated likes");
      }
      res.json({ likes: rows[0].likes });
    });
  });
});


server.listen(PORT, () =>
  console.log(`🚀 MyTweetHub running at http://localhost:${PORT}`)
);
