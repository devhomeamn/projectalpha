const { Op, fn, col, literal } = require("sequelize");
const Record = require("../models/recordModel");
const Section = require("../models/sectionModel");
const Subcategory = require("../models/subcategoryModel");
const Rack = require("../models/rackModel");
const ChequeRegisterEntry = require("../models/chequeRegisterEntryModel");
const User = require("../models/userModel");

if (!ChequeRegisterEntry.associations?.creator) {
  ChequeRegisterEntry.belongsTo(User, { foreignKey: "created_by", as: "creator" });
}

// 1) Section wise records + count
exports.sectionWiseReport = async (req, res) => {
  try {
    const records = await Record.findAll({
      where: { status: "active" },
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
      order: [["section_id", "ASC"], ["subcategory_id", "ASC"], ["rack_id", "ASC"]],
    });

    // group by section
    const grouped = {};
    records.forEach(r => {
      const sname = r.Section?.name || "Unknown";
      if (!grouped[sname]) grouped[sname] = { count: 0, items: [] };
      grouped[sname].count++;
      grouped[sname].items.push(r);
    });

    res.json(grouped);
  } catch (err) {
    console.error("sectionWiseReport error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 2) Central records
exports.centralReport = async (req, res) => {
  try {
    const central = await Record.findAll({
      where: { status: "central" },
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
      order: [["updatedAt", "DESC"]],
    });

    res.json(central);
  } catch (err) {
    console.error("centralReport error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 3) Movement history (central এ গেছে এমন রেকর্ড)
exports.movementHistoryReport = async (req, res) => {
  try {
    const moved = await Record.findAll({
      where: { status: "central" },
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
      order: [["updatedAt", "DESC"]],
    });

    // previous id থেকে নাম বের করতে (controller এ getRecords এর মত)
    const enhanced = await Promise.all(
      moved.map(async (r) => {
        let prevSection = null, prevSub = null, prevRack = null;

        if (r.previous_section_id) {
          const s = await Section.findByPk(r.previous_section_id);
          prevSection = s?.name || null;
        }
        if (r.previous_subcategory_id) {
          const sb = await Subcategory.findByPk(r.previous_subcategory_id);
          prevSub = sb?.name || null;
        }
        if (r.previous_rack_id) {
          const rk = await Rack.findByPk(r.previous_rack_id);
          prevRack = rk?.name || null;
        }

        return {
          ...r.toJSON(),
          previous_location: {
            section_name: prevSection,
            subcategory_name: prevSub,
            rack_name: prevRack,
          },
        };
      })
    );

    res.json(enhanced);
  } catch (err) {
    console.error("movementHistoryReport error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 4) User activity (added_by + moved_by summary)
exports.userActivityReport = async (req, res) => {
  try {
    const added = await Record.findAll({
      attributes: ["added_by", [fn("COUNT", col("id")), "total_added"]],
      group: ["added_by"],
    });

    const moved = await Record.findAll({
      where: { status: "central" },
      attributes: ["moved_by", [fn("COUNT", col("id")), "total_moved"]],
      group: ["moved_by"],
    });

    res.json({ added, moved });
  } catch (err) {
    console.error("userActivityReport error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 5) Monthly summary (new records + central moves)
exports.monthlySummaryReport = async (req, res) => {
  try {
    const createdByMonth = await Record.findAll({
      attributes: [
        [fn("DATE_FORMAT", col("createdAt"), "%Y-%m"), "month"],
        [fn("COUNT", col("id")), "total_created"],
      ],
      group: [literal("month")],
      order: [[literal("month"), "ASC"]],
    });

    const movedByMonth = await Record.findAll({
      where: { status: "central" },
      attributes: [
        [fn("DATE_FORMAT", col("updatedAt"), "%Y-%m"), "month"],
        [fn("COUNT", col("id")), "total_moved_central"],
      ],
      group: [literal("month")],
      order: [[literal("month"), "ASC"]],
    });

    res.json({ createdByMonth, movedByMonth });
  } catch (err) {
    console.error("monthlySummaryReport error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 6) Cheque register report (active entries)
exports.chequeRegisterReport = async (req, res) => {
  try {
    const { status, q, origin_section_id, from, to } = req.query;

    const where = { deleted_at: null };

    if (status && status !== "all") where.status = status;
    if (origin_section_id) where.origin_section_id = Number(origin_section_id);

    if (from || to) {
      where.received_date = {};
      if (from) where.received_date[Op.gte] = String(from).slice(0, 10);
      if (to) where.received_date[Op.lte] = String(to).slice(0, 10);
    }

    if (q) {
      const term = String(q).trim();
      if (term) {
        where[Op.or] = [
          { bill_ref_no: { [Op.like]: `%${term}%` } },
          { token_no: { [Op.like]: `%${term}%` } },
          ...(Number.isFinite(Number(term)) ? [{ entry_no: Number(term) }] : []),
        ];
      }
    }

    const [entries, sections] = await Promise.all([
      ChequeRegisterEntry.findAll({
        where,
        include: [
          {
            model: User,
            as: "creator",
            attributes: ["id", "name", "username"],
            required: false,
          },
        ],
        order: [["received_date", "DESC"], ["entry_no", "DESC"]],
      }),
      Section.findAll({ attributes: ["id", "name"], raw: true }),
    ]);

    const sectionMap = new Map(sections.map((s) => [Number(s.id), s.name]));

    const rows = entries.map((entry) => {
      const item = entry.toJSON();
      return {
        ...item,
        origin_section_name: sectionMap.get(Number(item.origin_section_id)) || null,
        returned_to_section_name: sectionMap.get(Number(item.returned_to_section_id)) || null,
        created_by_name: item.creator?.name || item.creator?.username || null,
      };
    });

    const summary = rows.reduce(
      (acc, item) => {
        const amount = Number(item.amount || 0);
        acc.total_entries += 1;
        acc.total_amount += Number.isFinite(amount) ? amount : 0;

        if (item.status === "received") acc.received += 1;
        else if (item.status === "processing") acc.processing += 1;
        else if (item.status === "returned") acc.returned += 1;

        return acc;
      },
      {
        total_entries: 0,
        total_amount: 0,
        received: 0,
        processing: 0,
        returned: 0,
      }
    );

    res.json({ summary, entries: rows });
  } catch (err) {
    console.error("chequeRegisterReport error:", err);
    res.status(500).json({ error: err.message });
  }
};
