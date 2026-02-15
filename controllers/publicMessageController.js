const PublicMessage = require("../models/publicMessageModel");

exports.listMessages = async (req, res) => {
  try {
    const rows = await PublicMessage.findAll({
      order: [["createdAt", "DESC"]],
      limit: 200,
      attributes: ["id", "message", "author_name", "author_role", "createdAt"],
    });

    return res.json({ messages: rows });
  } catch (err) {
    console.error("listMessages error:", err);
    return res.status(500).json({ error: "Failed to load messages" });
  }
};

exports.createMessage = async (req, res) => {
  try {
    const raw = req.body?.message;
    const message = String(raw || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    if (message.length > 1000) {
      return res.status(400).json({ error: "Message is too long (max 1000 chars)" });
    }

    const created = await PublicMessage.create({
      message,
      author_name: req.user?.name || req.user?.username || "User",
      author_role: req.user?.role || "General",
      user_id: req.user?.id || null,
    });

    return res.status(201).json({
      message: "Message posted",
      data: {
        id: created.id,
        message: created.message,
        author_name: created.author_name,
        author_role: created.author_role,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    console.error("createMessage error:", err);
    return res.status(500).json({ error: "Failed to post message" });
  }
};
