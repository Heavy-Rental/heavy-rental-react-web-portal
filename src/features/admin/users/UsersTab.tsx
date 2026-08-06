import { useState, type Dispatch, type SetStateAction } from "react";
import { Search, X } from "lucide-react";
import { userApi } from "../../../app/api";
import type { Role } from "../../../app/types";
import { mono, display, sans } from "../../../lib/styles";
import type { UserRow } from "../AdminDataContext";

export function UsersTab({
  users,
  setUsers,
  showToast,
}: {
  users: UserRow[];
  setUsers: Dispatch<SetStateAction<UserRow[]>>;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [userSearch, setUserSearch] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "" });

  const handleUserDelete = async (id: number) => {
    try {
      await userApi.remove(id);
      setUsers((prev) => prev.filter((x) => x.id !== id));
      setDeleteUserId(null);
      showToast("User removed.", "error");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to remove user.",
        "error",
      );
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <>
      {deleteUserId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 max-w-sm w-full" style={sans}>
            <p className="font-black text-xl text-foreground mb-2" style={display}>
              REMOVE USER?
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete the user account and all associated data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteUserId(null)}
                className="flex-1 py-2 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUserDelete(deleteUserId)}
                className="flex-1 py-2 bg-red-500 text-white text-xs font-bold tracking-wider uppercase hover:bg-red-600 transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md" style={sans}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-xl font-black text-foreground" style={display}>
                EDIT USER
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {(["name", "email"] as const).map((field) => (
                <div key={field}>
                  <label className="text-xs text-muted-foreground mb-1.5 block capitalize">
                    {field}
                  </label>
                  <input
                    value={editingUser[field]}
                    onChange={(e) =>
                      setEditingUser((u) => (u ? { ...u, [field]: e.target.value } : u))
                    }
                    className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser((u) => (u ? { ...u, role: e.target.value as Role } : u))
                  }
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
                >
                  <option value="customer">Customer</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await userApi.update(editingUser.id, {
                        name: editingUser.name,
                        email: editingUser.email,
                        role: editingUser.role,
                      });
                      setUsers((prev) =>
                        prev.map((u) => (u.id === editingUser.id ? editingUser : u)),
                      );
                      setEditingUser(null);
                      showToast("User updated.");
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : "Failed to update user.",
                        "error",
                      );
                    }
                  }}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md" style={sans}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-0.5" style={mono}>
                  User Management
                </p>
                <h2 className="text-xl font-black text-foreground" style={display}>
                  ADD CUSTOMER
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setNewUser({ name: "", email: "" });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {(["name", "email"] as const).map((field) => (
                <div key={field}>
                  <label className="text-xs text-muted-foreground mb-1.5 block capitalize">
                    {field}
                  </label>
                  <input
                    value={newUser[field]}
                    onChange={(e) => setNewUser((u) => ({ ...u, [field]: e.target.value }))}
                    placeholder={field === "name" ? "Full name" : "email@example.com"}
                    className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddUser(false);
                    setNewUser({ name: "", email: "" });
                  }}
                  className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={!newUser.name.trim() || !newUser.email.trim()}
                  onClick={async () => {
                    try {
                      const created = await userApi.create({
                        name: newUser.name.trim(),
                        email: newUser.email.trim(),
                        role: "customer",
                      });
                      setUsers((prev) => [
                        ...prev,
                        {
                          id: created.id,
                          name: created.name,
                          email: created.email,
                          role: created.role,
                          rentals: 0,
                          spent: 0,
                          status: "Inactive",
                        },
                      ]);
                      setShowAddUser(false);
                      setNewUser({ name: "", email: "" });
                      showToast("Customer added.");
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : "Failed to add customer.",
                        "error",
                      );
                    }
                  }}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2" style={mono}>
            Admin · User Management
          </p>
          <h1 className="text-5xl font-black text-foreground leading-none" style={display}>
            USERS
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {users.length} registered users · {users.filter((u) => u.status === "Active").length} active
          </p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-xs font-bold tracking-widest uppercase hover:bg-red-600 transition-all shrink-0"
        >
          + Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Users", value: users.length, color: "text-foreground" },
          {
            label: "Customers",
            value: users.filter((u) => u.role === "customer").length,
            color: "text-primary",
          },
          {
            label: "Employees",
            value: users.filter((u) => u.role === "employee").length,
            color: "text-blue-400",
          },
          {
            label: "Active",
            value: users.filter((u) => u.status === "Active").length,
            color: "text-green-400",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground" style={mono}>
              {label}
            </span>
            <span className={`text-2xl font-black ${color}`} style={display}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 mb-6">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full"
        />
        {userSearch && (
          <button onClick={() => setUserSearch("")}>
            <X size={13} className="text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <div className="bg-card border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["User", "Email", "Role", "Rentals", "Total Spent", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap"
                    style={mono}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-black text-primary shrink-0">
                        {u.name[0]}
                      </div>
                      <p className="font-semibold text-foreground">{u.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" style={mono}>
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold border ${u.role === "customer" ? "bg-primary/10 text-primary border-primary/30" : u.role === "employee" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground text-center" style={mono}>
                    {u.rentals}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground" style={mono}>
                    {u.spent > 0 ? `S$${u.spent.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold border ${u.status === "Active" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-secondary text-muted-foreground border-border"}`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteUserId(u.id)}
                        className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground" style={mono}>
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>
      </div>
    </>
  );
}
