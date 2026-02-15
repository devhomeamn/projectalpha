const PublicMessage = require("../models/publicMessageModel");
const PublicMessageLog = require("../models/publicMessageLogModel");

function normalizeRole(role) {
  return String(role || "").toLowerCase();
}

function isAdmin(req) {
  return normalizeRole(req.user?.role) === "admin";
}

function isOwner(req, row) {
  return Number(req.user?.id || 0) > 0 && Number(req.user?.id) === Number(row.user_id);
}

function canDelete(req, row) {
  return isAdmin(req) || isOwner(req, row);
}

exports.listMessages = async (req, res) => {
  try {
    const rows = await PublicMessage.findAll({
      order: [["createdAt", "DESC"]],
      limit: 200,
      attributes: ["id", "message", "author_name", "author_role", "user_id", "createdAt", "updatedAt"],
    });

    const messages = rows.map((row) => {
      const data = row.toJSON();
      return {
        ...data,
        can_edit: isOwner(req, data),
        can_delete: canDelete(req, data),
        is_edited: String(data.updatedAt) !== String(data.createdAt),
      };
    });

    return res.json({ messages, is_admin: isAdmin(req) });
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
        user_id: created.user_id,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        can_edit: true,
        can_delete: true,
        is_edited: false,
      },
    });
  } catch (err) {
    console.error("createMessage error:", err);
    return res.status(500).json({ error: "Failed to post message" });
  }
};

exports.updateMessage = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid message id" });
    }

    const raw = req.body?.message;
    const message = String(raw || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    if (message.length > 1000) {
      return res.status(400).json({ error: "Message is too long (max 1000 chars)" });
    }

    const row = await PublicMessage.findByPk(id);
    if (!row) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (!isOwner(req, row)) {
      return res.status(403).json({ error: "You can edit only your own message" });
    }

    const beforeText = row.message;
    row.message = message;
    await row.save();

    await PublicMessageLog.create({
      message_id: row.id,
      action: "edit",
      actor_user_id: req.user?.id || null,
      actor_name: req.user?.name || req.user?.username || "User",
      actor_role: req.user?.role || "General",
      owner_user_id: row.user_id || null,
      owner_name: row.author_name || null,
      before_text: beforeText,
      after_text: row.message,
    });

    return res.json({
      message: "Message updated",
      data: {
        id: row.id,
        message: row.message,
        author_name: row.author_name,
        author_role: row.author_role,
        user_id: row.user_id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        can_edit: isOwner(req, row),
        can_delete: canDelete(req, row),
        is_edited: true,
      },
    });
  } catch (err) {
    console.error("updateMessage error:", err);
    return res.status(500).json({ error: "Failed to update message" });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid message id" });
    }

    const row = await PublicMessage.findByPk(id);
    if (!row) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (!canDelete(req, row)) {
      return res.status(403).json({ error: "You can delete only your own message" });
    }

    await PublicMessageLog.create({
      message_id: row.id,
      action: "delete",
      actor_user_id: req.user?.id || null,
      actor_name: req.user?.name || req.user?.username || "User",
      actor_role: req.user?.role || "General",
      owner_user_id: row.user_id || null,
      owner_name: row.author_name || null,
      before_text: row.message,
      after_text: null,
    });

    await row.destroy();
    return res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("deleteMessage error:", err);
    return res.status(500).json({ error: "Failed to delete message" });
  }
};

exports.listTrace = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const rows = await PublicMessageLog.findAll({
      order: [["createdAt", "DESC"]],
      limit: 200,
      attributes: [
        "id",
        "message_id",
        "action",
        "actor_name",
        "actor_role",
        "owner_name",
        "before_text",
        "after_text",
        "createdAt",
      ],
    });

    return res.json({ traces: rows });
  } catch (err) {
    console.error("listTrace error:", err);
    return res.status(500).json({ error: "Failed to load trace logs" });
  }
};
