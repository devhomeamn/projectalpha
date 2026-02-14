const DEFAULT_SECTION_RULES = Object.freeze({
  requires_allocate_table: false,
  enable_audit_objection: false,
  allow_duplicate_bd: false,
});

function normalizeSectionName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[\s_\-]+/g, "")
    .trim();
}

function inferLegacySectionRules(sectionName) {
  const clean = normalizeSectionName(sectionName);
  const isOP = clean.includes("officerspayop");
  const isLALAO = clean.replace(/[\/\\]/g, "") === "lalao";

  return {
    requires_allocate_table: isOP,
    enable_audit_objection: isLALAO,
    allow_duplicate_bd: isLALAO,
  };
}

function sanitizeSectionRules(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    requires_allocate_table: !!raw.requires_allocate_table,
    enable_audit_objection: !!raw.enable_audit_objection,
    allow_duplicate_bd: !!raw.allow_duplicate_bd,
  };
}

function resolveSectionFormRules(sectionName, storedRules) {
  return {
    ...DEFAULT_SECTION_RULES,
    ...inferLegacySectionRules(sectionName),
    ...sanitizeSectionRules(storedRules),
  };
}

module.exports = {
  DEFAULT_SECTION_RULES,
  normalizeSectionName,
  inferLegacySectionRules,
  sanitizeSectionRules,
  resolveSectionFormRules,
};
