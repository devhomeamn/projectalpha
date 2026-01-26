// controllers/aoClearanceController.js
const { Op } = require("sequelize");
const Record = require("../models/recordModel");
const AOClearanceRequest = require("../models/aoClearanceRequestModel");

// helper: actor name (consistent with your existing patterns)
function getActor(req) {
  const u = req.user || {};
  return u.username || u.email || u.name || `user_${u.id || "unknown"}`;
}

// POST /api/ao-clearance-requests
// role: general, master
exports.createRequest = async (req, res) => {
  try {
    const { record_id, request_note } = req.body;

    if (!record_id) {
      return res.status(400).json({ message: "record_id is required" });
    }

    const record = await Record.findByPk(record_id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    // Optional: prevent requesting clearance if already cleared
    if (record.ao_status === "cleared") {
      return res.status(400).json({ message: "Already cleared." });
    }

    // Prevent duplicate pending request for same record
    const existingPending = await AOClearanceRequest.findOne({
      where: { record_id: record.id, status: "pending" },
    });
    if (existingPending) {
      return res.status(400).json({ message: "A pending request already exists." });
    }

    const file = req.file;

    const created = await AOClearanceRequest.create({
      record_id: record.id,
      bd_no: record.bd_no || record.bd_no === 0 ? String(record.bd_no) : "",
      request_note: request_note || null,

      attachment_name: file ? file.originalname : null,
      attachment_path: file ? `uploads/ao_clearance_requests/${file.filename}` : null,
      attachment_mime: file ? file.mimetype : null,
      attachment_size: file ? file.size : null,

      requested_by: getActor(req),
      status: "pending",
    });

    // Update record status to requested (keep objection history intact)
    await record.update({
      ao_status: "requested",
    });

    return res.status(201).json({ message: "Clearance request submitted", data: created });
  } catch (err) {
    console.error("createRequest error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/ao-clearance-requests?status=pending
// role: admin
exports.listRequests = async (req, res) => {
  try {
    const status = req.query.status; // pending|approved|rejected|all
    const where = {};

    if (status && status !== "all") where.status = status;

    const rows = await AOClearanceRequest.findAll({
      where,
      include: [
        {
          model: Record,
          required: false,
          attributes: [
            "id",
            "file_name",
            "bd_no",
            "serial_no",
            "section_id",
            "subcategory_id",
            "rack_id",
            "ao_status",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({ data: rows });
  } catch (err) {
    console.error("listRequests error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/ao-clearance-requests/mine
// role: general, master
exports.listMine = async (req, res) => {
  try {
    const actor = getActor(req);

    const rows = await AOClearanceRequest.findAll({
      where: { requested_by: actor },
      order: [["createdAt", "DESC"]],
    });

    return res.json({ data: rows });
  } catch (err) {
    console.error("listMine error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/ao-clearance-requests/:id/decide
// role: admin
// body: { decision: "approved"|"rejected", admin_note?: string }
exports.decideRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, admin_note } = req.body;

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "decision must be approved or rejected" });
    }

    const row = await AOClearanceRequest.findByPk(id);
    if (!row) return res.status(404).json({ message: "Request not found" });

    if (row.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be decided." });
    }

    const record = await Record.findByPk(row.record_id);
    if (!record) return res.status(404).json({ message: "Record not found for this request" });

    const actor = getActor(req);
    const decidedAt = new Date();

    await row.update({
      status: decision,
      admin_note: admin_note || null,
      decided_by: actor,
      decided_at: decidedAt,
    });

    if (decision === "approved") {
      await record.update({
        ao_status: "cleared",
        ao_cleared_by: actor,
        ao_cleared_at: decidedAt,
      });
    } else {
      // rejected → revert record status back to open (so it stays visible & requestable again)
      await record.update({
        ao_status: "open",
      });
    }

    return res.json({ message: `Request ${decision}`, data: row });
  } catch (err) {
    console.error("decideRequest error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
