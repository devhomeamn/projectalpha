const INVENTORY_PERMISSIONS = {
  inventory_item_manage: "inventory_item_manage",
  inventory_request_create: "inventory_request_create",
  inventory_request_view_own: "inventory_request_view_own",
  inventory_request_review: "inventory_request_review",
  inventory_request_forward: "inventory_request_forward",
  inventory_request_approve: "inventory_request_approve",
  inventory_issue: "inventory_issue",
  inventory_report_view: "inventory_report_view",
};

const ROLE_PERMISSION_MAP = {
  admin: Object.values(INVENTORY_PERMISSIONS),
  "inventory manager": [
    INVENTORY_PERMISSIONS.inventory_item_manage,
    INVENTORY_PERMISSIONS.inventory_request_review,
    INVENTORY_PERMISSIONS.inventory_request_approve,
    INVENTORY_PERMISSIONS.inventory_issue,
    INVENTORY_PERMISSIONS.inventory_report_view,
  ],
  general: [
    INVENTORY_PERMISSIONS.inventory_request_create,
    INVENTORY_PERMISSIONS.inventory_request_view_own,
  ],
  master: [
    INVENTORY_PERMISSIONS.inventory_request_review,
    INVENTORY_PERMISSIONS.inventory_request_forward,
  ],
};

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getInventoryPermissionsByRole(role) {
  return ROLE_PERMISSION_MAP[normalizeRole(role)] || [];
}

function hasInventoryPermission(user, permission) {
  const perms = getInventoryPermissionsByRole(user?.role);
  return perms.includes(permission);
}

function requireInventoryPermission(...permissions) {
  const requested = permissions.filter(Boolean);
  return (req, res, next) => {
    const user = req.user || {};
    const role = normalizeRole(user.role);

    const perms = getInventoryPermissionsByRole(role);
    if (!perms.length) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!requested.length || requested.some((permission) => perms.includes(permission))) {
      req.inventoryPermissions = perms;
      return next();
    }

    return res.status(403).json({ message: "Forbidden" });
  };
}

module.exports = {
  INVENTORY_PERMISSIONS,
  getInventoryPermissionsByRole,
  hasInventoryPermission,
  requireInventoryPermission,
};
