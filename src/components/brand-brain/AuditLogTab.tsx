import { useState } from "react";
import { History, Search, Filter, ShieldCheck, User, Calendar } from "lucide-react";
import { BrandAuditLog, AuditEntityType, AuditAction } from "../../types";

interface AuditLogTabProps {
  logs: BrandAuditLog[];
}

export function AuditLogTab({ logs }: AuditLogTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEntity, setFilterEntity] = useState<AuditEntityType | "all">("all");
  const [filterAction, setFilterAction] = useState<AuditAction | "all">("all");

  const filteredLogs = logs.filter((log) => {
    if (filterEntity !== "all" && log.entityType !== filterEntity) return false;
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        log.summary.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.entityId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Brand Brain Audit Trail & Provenance</h2>
          <p className="text-xs text-neutral-500">
            Immutable log of all knowledge modifications, policy updates, and brand definitions for full organizational accountability.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold">Audit Logging Enforced</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit trail by summary, author, or ID..."
            className="w-full bg-transparent focus:outline-none text-neutral-800 placeholder:text-neutral-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value as AuditEntityType | "all")}
            className="px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-700 font-medium"
          >
            <option value="all">All Entities</option>
            <option value="profile">Profile</option>
            <option value="product">Products</option>
            <option value="audience">Audiences</option>
            <option value="voice">Voice</option>
            <option value="terminology">Terminology</option>
            <option value="policy">Policies</option>
            <option value="competitor">Competitors</option>
          </select>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value as AuditAction | "all")}
            className="px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-700 font-medium"
          >
            <option value="all">All Actions</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="archive">Archived</option>
            <option value="unarchive">Restored</option>
            <option value="delete">Deleted</option>
          </select>
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs divide-y divide-neutral-100 overflow-hidden">
        {filteredLogs.map((log) => (
          <div key={log.id} className="p-4 hover:bg-neutral-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-3">
              <span
                className={`px-2.5 py-1 rounded-md font-mono font-bold text-[10px] uppercase shrink-0 ${
                  log.action === "create"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : log.action === "update"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : log.action === "archive"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : log.action === "delete"
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                }`}
              >
                {log.action}
              </span>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900 uppercase tracking-wider text-[11px]">
                    {log.entityType}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">({log.entityId})</span>
                </div>
                <p className="text-neutral-700">{log.summary}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-neutral-500 shrink-0 self-end sm:self-auto">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3 text-neutral-400" />
                <span className="font-medium text-neutral-700">{log.userName}</span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3 text-neutral-400" />
                <span>{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <History className="w-8 h-8 text-neutral-300 mx-auto" />
            <p className="text-sm font-medium text-neutral-600">No audit logs matching search</p>
          </div>
        )}
      </div>
    </div>
  );
}
