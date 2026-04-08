# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin panel where admins can manage all users, change roles, and access any user's bots with full read/write capabilities.

**Architecture:** Add admin RLS bypass policies to all tables. New `/dashboard/admin/*` routes with server actions that query across tenants. Reuse existing bot page components via mirrored admin routes.

**Tech Stack:** Next.js 16, Supabase (RLS policies), React 19, Tailwind CSS v4, TypeScript

---

### Task 1: Database — Admin RLS Policies

**Files:**
- Create: `supabase/migrations/007_admin_rls.sql`

- [ ] **Step 1: Create the helper function and update all RLS policies**

Apply this migration via Supabase MCP `apply_migration`:

```sql
-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- TENANTS: allow admins to view all tenants
DROP POLICY "Tenants can view own data" ON public.tenants;
CREATE POLICY "Tenants can view own or admin all" ON public.tenants
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

DROP POLICY "Tenants can update own data" ON public.tenants;
CREATE POLICY "Tenants can update own or admin all" ON public.tenants
  FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- BOTS
DROP POLICY "Tenants can manage own bots" ON public.bots;
CREATE POLICY "Tenants can manage own bots or admin all" ON public.bots
  FOR ALL USING (tenant_id = auth.uid() OR public.is_admin());

-- PRODUCTS
DROP POLICY "Tenants can manage own products" ON public.products;
CREATE POLICY "Tenants can manage own products or admin all" ON public.products
  FOR ALL USING (tenant_id = auth.uid() OR public.is_admin());

-- PRODUCT BUNDLES
DROP POLICY "Tenants can manage own bundles" ON public.product_bundles;
CREATE POLICY "Tenants can manage own bundles or admin all" ON public.product_bundles
  FOR ALL USING (tenant_id = auth.uid() OR public.is_admin());

-- BUNDLE ITEMS
DROP POLICY "Tenants can manage bundle items" ON public.product_bundle_items;
CREATE POLICY "Tenants can manage bundle items or admin all" ON public.product_bundle_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.product_bundles pb WHERE pb.id = bundle_id AND pb.tenant_id = auth.uid())
    OR public.is_admin()
  );

-- FLOWS
DROP POLICY "Tenants can manage own flows" ON public.flows;
CREATE POLICY "Tenants can manage own flows or admin all" ON public.flows
  FOR ALL USING (tenant_id = auth.uid() OR public.is_admin());

-- LEADS
DROP POLICY "Tenants can manage own leads" ON public.leads;
CREATE POLICY "Tenants can manage own leads or admin all" ON public.leads
  FOR ALL USING (tenant_id = auth.uid() OR public.is_admin());

-- TRANSACTIONS
DROP POLICY "Tenants can manage own transactions" ON public.transactions;
CREATE POLICY "Tenants can manage own transactions or admin all" ON public.transactions
  FOR ALL USING (tenant_id = auth.uid() OR public.is_admin());

-- TRACKING EVENTS
DROP POLICY "Tenants can manage own tracking events" ON public.tracking_events;
CREATE POLICY "Tenants can manage own tracking events or admin all" ON public.tracking_events
  FOR ALL USING (tenant_id = auth.uid() OR public.is_admin());

-- REMARKETING CONFIGS
DROP POLICY "Tenants can manage own remarketing configs" ON public.remarketing_configs;
CREATE POLICY "Tenants can manage own remarketing configs or admin all" ON public.remarketing_configs
  FOR ALL USING (tenant_id = auth.uid() OR public.is_admin());

-- REMARKETING FLOWS
DROP POLICY "Tenants can manage own remarketing flows" ON public.remarketing_flows;
CREATE POLICY "Tenants can manage own remarketing flows or admin all" ON public.remarketing_flows
  FOR ALL USING (tenant_id = auth.uid() OR public.is_admin());

-- REMARKETING PROGRESS
DROP POLICY "Tenants can view own remarketing progress" ON public.remarketing_progress;
CREATE POLICY "Tenants can view remarketing progress or admin all" ON public.remarketing_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.bots b WHERE b.id = bot_id AND b.tenant_id = auth.uid())
    OR public.is_admin()
  );
```

- [ ] **Step 2: Save migration file locally**

Save the same SQL to `supabase/migrations/007_admin_rls.sql` for version control.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_admin_rls.sql lib/types/database.ts
git commit -m "feat: add admin role and RLS bypass policies"
```

---

### Task 2: Server Actions — Admin Data Access

**Files:**
- Create: `lib/actions/admin-actions.ts`

- [ ] **Step 1: Create admin server actions**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/types/database";

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("role")
    .eq("id", user.id)
    .single();

  return tenant?.role === "admin";
}

export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("role")
    .eq("id", user.id)
    .single();

  if (tenant?.role !== "admin") throw new Error("Forbidden");
  return user.id;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  bots_total: number;
  bots_active: number;
  leads_total: number;
  transactions_total: number;
  revenue_total: number;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  await requireAdmin();
  const supabase = await createClient();

  // Get all tenants (admin RLS allows this)
  const { data: tenants } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (!tenants || tenants.length === 0) return [];

  const users: AdminUser[] = [];

  for (const t of tenants as Tenant[]) {
    // Count bots
    const { data: bots } = await supabase
      .from("bots")
      .select("is_active")
      .eq("tenant_id", t.id);

    const botsTotal = bots?.length ?? 0;
    const botsActive = bots?.filter((b) => b.is_active).length ?? 0;

    // Count leads
    const { count: leadsTotal } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", t.id);

    // Transactions + revenue
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount")
      .eq("tenant_id", t.id)
      .eq("status", "approved");

    const transactionsTotal = txs?.length ?? 0;
    const revenueTotal = (txs ?? []).reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

    users.push({
      id: t.id,
      email: t.email,
      name: t.name,
      role: t.role,
      plan: t.plan,
      created_at: t.created_at,
      last_sign_in_at: null, // Will be fetched client-side if needed
      bots_total: botsTotal,
      bots_active: botsActive,
      leads_total: leadsTotal ?? 0,
      transactions_total: transactionsTotal,
      revenue_total: revenueTotal,
    });
  }

  return users;
}

export async function getAdminUserProfile(userId: string): Promise<AdminUser | null> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", userId)
    .single();

  if (!tenant) return null;

  const t = tenant as Tenant;

  const { data: bots } = await supabase
    .from("bots")
    .select("is_active")
    .eq("tenant_id", t.id);

  const { count: leadsTotal } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", t.id);

  const { data: txs } = await supabase
    .from("transactions")
    .select("amount")
    .eq("tenant_id", t.id)
    .eq("status", "approved");

  return {
    id: t.id,
    email: t.email,
    name: t.name,
    role: t.role,
    plan: t.plan,
    created_at: t.created_at,
    last_sign_in_at: null,
    bots_total: bots?.length ?? 0,
    bots_active: bots?.filter((b) => b.is_active).length ?? 0,
    leads_total: leadsTotal ?? 0,
    transactions_total: txs?.length ?? 0,
    revenue_total: (txs ?? []).reduce((sum, tx) => sum + (tx.amount ?? 0), 0),
  };
}

export interface AdminBot {
  id: string;
  bot_username: string;
  is_active: boolean;
  created_at: string;
  leads_count: number;
  revenue: number;
}

export async function getAdminUserBots(userId: string): Promise<AdminBot[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: bots } = await supabase
    .from("bots")
    .select("id, bot_username, is_active, created_at")
    .eq("tenant_id", userId)
    .order("created_at", { ascending: false });

  if (!bots || bots.length === 0) return [];

  const result: AdminBot[] = [];

  for (const bot of bots) {
    const { count: leadsCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", bot.id);

    const { data: txs } = await supabase
      .from("transactions")
      .select("amount")
      .eq("bot_id", bot.id)
      .eq("status", "approved");

    result.push({
      id: bot.id,
      bot_username: bot.bot_username,
      is_active: bot.is_active,
      created_at: bot.created_at,
      leads_count: leadsCount ?? 0,
      revenue: (txs ?? []).reduce((sum, tx) => sum + (tx.amount ?? 0), 0),
    });
  }

  return result;
}

export async function updateUserRole(userId: string, role: "user" | "admin"): Promise<{ success: boolean }> {
  const adminId = await requireAdmin();
  const supabase = await createClient();

  // Prevent self-demotion
  if (userId === adminId && role !== "admin") {
    throw new Error("Cannot remove your own admin role");
  }

  const { error } = await supabase
    .from("tenants")
    .update({ role })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/admin-actions.ts
git commit -m "feat: add admin server actions"
```

---

### Task 3: Sidebar — Admin Navigation

**Files:**
- Modify: `components/dashboard/sidebar.tsx`
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Update dashboard layout to fetch tenant role**

In `app/dashboard/layout.tsx`, fetch the tenant and pass role to Sidebar:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = tenant?.role === "admin";

  return (
    <div className="flex min-h-screen relative">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-[30%] w-[600px] h-[400px] bg-(--accent) rounded-full opacity-[0.015] blur-[180px]" />
        <div className="absolute bottom-0 right-[20%] w-[500px] h-[300px] bg-(--cyan) rounded-full opacity-[0.01] blur-[150px]" />
      </div>
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 min-w-0 relative z-10">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Update Sidebar to accept isAdmin prop and show admin link**

In `components/dashboard/sidebar.tsx`, add `isAdmin` prop and an "Admin" nav item:

```typescript
"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isBotsActive = pathname === "/dashboard" || (pathname.startsWith("/dashboard/bots") && !pathname.startsWith("/dashboard/admin"));
  const isAdminActive = pathname.startsWith("/dashboard/admin");

  return (
    <aside className="w-[270px] min-h-screen flex flex-col relative" style={{ background: "linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-root) 100%)" }}>
      {/* Subtle right border with glow */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-linear-to-b from-transparent via-(--border-default) to-transparent" />

      {/* Ambient glow */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-(--accent)/[0.03] to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="h-[72px] px-6 flex items-center relative">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="EagleBot" className="w-9 h-9 object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]" />
          <span className="text-base font-bold tracking-tight text-foreground page-title">
            EagleBot
          </span>
        </div>
        {/* Bottom separator with glow */}
        <div className="absolute bottom-0 left-4 right-4 h-px bg-linear-to-r from-transparent via-(--border-default) to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-6 pb-4">
        <p className="text-(--text-ghost) text-[10px] font-bold uppercase tracking-[0.14em] px-3 mb-3">
          Menu
        </p>
        <a
          href="/dashboard"
          className={`nav-item ${isBotsActive ? "active" : ""}`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBotsActive ? "bg-(--accent)/15" : "bg-white/4"}`} style={isBotsActive ? { boxShadow: "0 0 12px -4px rgba(16,185,129,0.3)" } : {}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          Meus Bots
        </a>

        {isAdmin && (
          <>
            <div className="my-4 mx-2 h-px bg-linear-to-r from-transparent via-(--border-default) to-transparent" />
            <p className="text-(--text-ghost) text-[10px] font-bold uppercase tracking-[0.14em] px-3 mb-3">
              Administracao
            </p>
            <a
              href="/dashboard/admin/users"
              className={`nav-item ${isAdminActive ? "active" : ""}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAdminActive ? "bg-(--accent)/15" : "bg-white/4"}`} style={isAdminActive ? { boxShadow: "0 0 12px -4px rgba(16,185,129,0.3)" } : {}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              Admin
            </a>
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 relative">
        <div className="absolute top-0 left-4 right-4 h-px bg-linear-to-r from-transparent via-(--border-default) to-transparent" />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-[13px] text-(--text-muted) hover:text-(--red) hover:bg-(--red-muted) transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-white/3 flex items-center justify-center group-hover:bg-(--red)/10 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          Sair
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/layout.tsx components/dashboard/sidebar.tsx
git commit -m "feat: add admin nav item to sidebar"
```

---

### Task 4: Admin Users Page — List All Users

**Files:**
- Create: `app/dashboard/admin/users/page.tsx`
- Create: `components/dashboard/admin-user-table.tsx`

- [ ] **Step 1: Create the AdminUserTable component**

```typescript
// components/dashboard/admin-user-table.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminUser } from "@/lib/actions/admin-actions";
import { updateUserRole } from "@/lib/actions/admin-actions";

interface AdminUserTableProps {
  users: AdminUser[];
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function AdminUserTable({ users: initialUsers }: AdminUserTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const router = useRouter();

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleRoleChange = async (userId: string, newRole: "user" | "admin") => {
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar role");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "admin", "user"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={`toggle-btn ${roleFilter === f ? "on" : "off"}`}
            >
              {f === "all" ? "Todos" : f === "admin" ? "Admins" : "Usuarios"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Usuario</th>
                <th className="table-header">Role</th>
                <th className="table-header">Plano</th>
                <th className="table-header">Bots</th>
                <th className="table-header">Leads</th>
                <th className="table-header">Vendas</th>
                <th className="table-header">Receita</th>
                <th className="table-header">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className="cursor-pointer hover:bg-white/[0.02] transition"
                  onClick={() => router.push(`/dashboard/admin/users/${user.id}`)}
                >
                  <td className="table-cell">
                    <div>
                      <p className="text-foreground text-sm font-medium">{user.name || "Sem nome"}</p>
                      <p className="text-(--text-muted) text-xs">{user.email}</p>
                    </div>
                  </td>
                  <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as "user" | "admin")}
                      disabled={updatingId === user.id}
                      className="input py-1.5! px-2! text-xs! w-24! rounded-lg!"
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-info">{user.plan ?? "Free"}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-foreground text-sm stat-value">{user.bots_active}</span>
                    <span className="text-(--text-muted) text-xs">/{user.bots_total}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-foreground text-sm stat-value">{user.leads_total}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-foreground text-sm stat-value">{user.transactions_total}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-(--accent) text-sm font-semibold stat-value">{formatCurrency(user.revenue_total)}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-(--text-secondary) text-xs">{formatDate(user.created_at)}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center text-(--text-muted) py-12!">
                    Nenhum usuario encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the admin users page**

```typescript
// app/dashboard/admin/users/page.tsx
import { redirect } from "next/navigation";
import { isAdmin, getAdminUsers } from "@/lib/actions/admin-actions";
import { AdminUserTable } from "@/components/dashboard/admin-user-table";

export default async function AdminUsersPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const users = await getAdminUsers();

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8 animate-up">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center section-icon"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight page-title">
              Painel Admin
            </h1>
            <p className="text-(--text-secondary) text-sm">
              Gerencie todos os usuarios da plataforma
            </p>
          </div>
        </div>
      </div>

      <div className="animate-up-1">
        <AdminUserTable users={users} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/admin/users/page.tsx components/dashboard/admin-user-table.tsx
git commit -m "feat: add admin users list page"
```

---

### Task 5: Admin User Profile Page

**Files:**
- Create: `app/dashboard/admin/users/[userId]/page.tsx`
- Create: `components/dashboard/admin-user-profile.tsx`

- [ ] **Step 1: Create the AdminUserProfile component**

```typescript
// components/dashboard/admin-user-profile.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminUser, AdminBot } from "@/lib/actions/admin-actions";
import { updateUserRole } from "@/lib/actions/admin-actions";

interface AdminUserProfileProps {
  user: AdminUser;
  bots: AdminBot[];
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function AdminUserProfile({ user: initialUser, bots }: AdminUserProfileProps) {
  const [user, setUser] = useState(initialUser);
  const [updatingRole, setUpdatingRole] = useState(false);
  const router = useRouter();

  const handleRoleChange = async (newRole: "user" | "admin") => {
    setUpdatingRole(true);
    try {
      await updateUserRole(user.id, newRole);
      setUser((prev) => ({ ...prev, role: newRole }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar role");
    } finally {
      setUpdatingRole(false);
    }
  };

  const stats = [
    { label: "Bots", value: `${user.bots_active}/${user.bots_total}`, color: "var(--accent)" },
    { label: "Leads", value: user.leads_total.toString(), color: "var(--cyan)" },
    { label: "Vendas", value: user.transactions_total.toString(), color: "var(--purple)" },
    { label: "Receita", value: formatCurrency(user.revenue_total), color: "var(--accent)" },
  ];

  return (
    <div>
      {/* Back link */}
      <a
        href="/dashboard/admin/users"
        className="inline-flex items-center gap-2 text-(--text-muted) text-sm hover:text-foreground transition mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Voltar
      </a>

      {/* User header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, transparent), color-mix(in srgb, var(--cyan) 10%, transparent))",
                color: "var(--accent)",
              }}
            >
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground page-title">{user.name || "Sem nome"}</h2>
              <p className="text-(--text-secondary) text-sm">{user.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="badge badge-info">{user.plan ?? "Free"}</span>
                <span className="text-(--text-muted) text-xs">Desde {formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>
          <div>
            <label className="input-label">Role</label>
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(e.target.value as "user" | "admin")}
              disabled={updatingRole}
              className="input py-2! px-3! text-sm! w-32!"
            >
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-5 relative top-glow" style={{ "--accent": s.color } as React.CSSProperties}>
            <p className="text-(--text-muted) text-xs font-semibold uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-xl font-bold stat-value text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bots */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <h3 className="text-foreground font-semibold text-sm">Bots ({bots.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Bot</th>
                <th className="table-header">Status</th>
                <th className="table-header">Leads</th>
                <th className="table-header">Receita</th>
                <th className="table-header">Criado</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => (
                <tr key={bot.id} className="hover:bg-white/[0.02] transition">
                  <td className="table-cell">
                    <span className="text-foreground text-sm font-medium">@{bot.bot_username}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${bot.is_active ? "badge-active" : "badge-inactive"}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${bot.is_active ? "bg-(--accent)" : "bg-(--text-ghost)"}`} />
                      {bot.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-foreground text-sm stat-value">{bot.leads_count}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-(--accent) text-sm font-semibold stat-value">{formatCurrency(bot.revenue)}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-(--text-secondary) text-xs">{formatDate(bot.created_at)}</span>
                  </td>
                  <td className="table-cell text-right">
                    <a
                      href={`/dashboard/admin/users/${user.id}/bots/${bot.id}/flows`}
                      className="btn-ghost py-1.5! px-3! text-xs!"
                    >
                      Gerenciar
                    </a>
                  </td>
                </tr>
              ))}
              {bots.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-(--text-muted) py-12!">
                    Nenhum bot encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the admin user profile page**

```typescript
// app/dashboard/admin/users/[userId]/page.tsx
import { redirect, notFound } from "next/navigation";
import { isAdmin, getAdminUserProfile, getAdminUserBots } from "@/lib/actions/admin-actions";
import { AdminUserProfile } from "@/components/dashboard/admin-user-profile";

export default async function AdminUserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { userId } = await params;
  const user = await getAdminUserProfile(userId);
  if (!user) notFound();

  const bots = await getAdminUserBots(userId);

  return (
    <div className="p-8 max-w-5xl">
      <div className="animate-up">
        <AdminUserProfile user={user} bots={bots} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/admin/users/\[userId\]/page.tsx components/dashboard/admin-user-profile.tsx
git commit -m "feat: add admin user profile page"
```

---

### Task 6: Admin Bot Pages — Reuse Existing Components

**Files:**
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/layout.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/flows/page.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/flows/[flowId]/editor/page.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/products/page.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/bundles/page.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/leads/page.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/transactions/page.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/remarketing/page.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/remarketing/[flowId]/editor/page.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/tracking/page.tsx`
- Create: `app/dashboard/admin/users/[userId]/bots/[botId]/settings/page.tsx`

- [ ] **Step 1: Create the admin bot layout**

This mirrors `app/dashboard/bots/[botId]/layout.tsx` but with admin guard and adjusted back URL:

```typescript
// app/dashboard/admin/users/[userId]/bots/[botId]/layout.tsx
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { BotSidebar } from "@/components/dashboard/bot-sidebar";
import type { Bot } from "@/lib/types/database";

export default async function AdminBotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { userId, botId } = await params;
  const supabase = await createClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .eq("tenant_id", userId)
    .single();

  if (!bot) notFound();

  const typedBot = bot as Bot;

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <BotSidebar
        botId={botId}
        botUsername={typedBot.bot_username}
        basePath={`/dashboard/admin/users/${userId}/bots/${botId}`}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Update BotSidebar to accept optional basePath**

In `components/dashboard/bot-sidebar.tsx`, add a `basePath` prop so links work in admin context. Find the props interface and the link definitions. Change the href pattern from hardcoded `/dashboard/bots/${botId}/...` to use `basePath ?? /dashboard/bots/${botId}`:

Add to props:
```typescript
interface BotSidebarProps {
  botId: string;
  botUsername: string;
  basePath?: string;
}
```

Then in the component function signature and in every `href`, replace `/dashboard/bots/${botId}` with `${base}` where `const base = basePath ?? `/dashboard/bots/${botId}`;`.

Also update the "Voltar" (back) link: if `basePath` is provided, the back button should go to the admin user profile. Extract the userId from basePath:
```typescript
const backUrl = basePath
  ? basePath.replace(/\/bots\/.*$/, "")
  : "/dashboard";
```

- [ ] **Step 3: Create all admin bot sub-pages**

Each page mirrors its counterpart under `app/dashboard/bots/[botId]/`. They import the same components and run the same queries. The only difference is the admin guard and extracting `userId` + `botId` from params.

**Flows page** — `app/dashboard/admin/users/[userId]/bots/[botId]/flows/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { FlowList } from "@/components/dashboard/flow-list";
import type { Flow } from "@/lib/types/database";

export default async function AdminFlowsPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { userId, botId } = await params;
  const supabase = await createClient();

  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <FlowList botId={botId} flows={(flows ?? []) as Flow[]} />
    </div>
  );
}
```

**Flow editor** — `app/dashboard/admin/users/[userId]/bots/[botId]/flows/[flowId]/editor/page.tsx`:

```typescript
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { FlowEditor } from "@/components/dashboard/flow-builder/flow-editor";
import type { FlowData } from "@/lib/types/database";

export default async function AdminFlowEditorPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string; flowId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { userId, botId, flowId } = await params;
  const supabase = await createClient();

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .single();

  if (!flow) notFound();

  const { data: bundles } = await supabase
    .from("product_bundles")
    .select("id, name")
    .eq("bot_id", botId)
    .eq("is_active", true);

  return (
    <FlowEditor
      flowId={flowId}
      flowName={flow.name}
      initialData={flow.flow_data as FlowData}
      botId={botId}
      bundles={(bundles ?? []).map((b) => ({ id: b.id, name: b.name }))}
      backUrl={`/dashboard/admin/users/${userId}/bots/${botId}/flows`}
    />
  );
}
```

**Products** — `app/dashboard/admin/users/[userId]/bots/[botId]/products/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { ProductList } from "@/components/dashboard/product-list";
import type { Product } from "@/lib/types/database";

export default async function AdminProductsPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <ProductList botId={botId} products={(products ?? []) as Product[]} />
    </div>
  );
}
```

**Bundles** — `app/dashboard/admin/users/[userId]/bots/[botId]/bundles/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { BundleList } from "@/components/dashboard/bundle-list";

export default async function AdminBundlesPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;
  const supabase = await createClient();

  const { data: bundles } = await supabase
    .from("product_bundles")
    .select("*, product_bundle_items(*, products(*))")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <BundleList botId={botId} bundles={bundles ?? []} />
    </div>
  );
}
```

**Leads** — `app/dashboard/admin/users/[userId]/bots/[botId]/leads/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { LeadsTable } from "@/components/dashboard/leads-table";
import type { Lead } from "@/lib/types/database";

export default async function AdminLeadsPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;
  const supabase = await createClient();

  const pageSize = 20;
  const { data: leads, count } = await supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(0, pageSize - 1);

  return (
    <div className="p-8">
      <LeadsTable
        botId={botId}
        initialLeads={(leads ?? []) as Lead[]}
        total={count ?? 0}
        currentPage={1}
        pageSize={pageSize}
      />
    </div>
  );
}
```

**Transactions** — `app/dashboard/admin/users/[userId]/bots/[botId]/transactions/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import type { Transaction } from "@/lib/types/database";

export default async function AdminTransactionsPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, products(name)")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <TransactionsTable botId={botId} transactions={(transactions ?? []) as (Transaction & { products: { name: string } })[]} />
    </div>
  );
}
```

**Tracking** — `app/dashboard/admin/users/[userId]/bots/[botId]/tracking/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { TrackingStats } from "@/components/dashboard/tracking-stats";

export default async function AdminTrackingPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("tracking_events")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="p-8">
      <TrackingStats events={events ?? []} />
    </div>
  );
}
```

**Remarketing** — `app/dashboard/admin/users/[userId]/bots/[botId]/remarketing/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/actions/admin-actions";
import { getOrCreateConfig, listFlows } from "@/lib/actions/remarketing-actions";
import { RemarketingDashboard } from "@/components/dashboard/remarketing-dashboard";
import type { RemarketingConfig, RemarketingFlow } from "@/lib/types/database";

export default async function AdminRemarketingPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;

  const config = (await getOrCreateConfig(botId)) as RemarketingConfig;
  const flows = (await listFlows(config.id)) as RemarketingFlow[];

  return (
    <div className="p-8">
      <RemarketingDashboard botId={botId} config={config} flows={flows} />
    </div>
  );
}
```

**Remarketing flow editor** — `app/dashboard/admin/users/[userId]/bots/[botId]/remarketing/[flowId]/editor/page.tsx`:

```typescript
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { FlowEditor } from "@/components/dashboard/flow-builder/flow-editor";
import { saveRemarketingFlow } from "@/lib/actions/remarketing-actions";
import type { FlowData } from "@/lib/types/database";

export default async function AdminRemarketingEditorPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string; flowId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { userId, botId, flowId } = await params;
  const supabase = await createClient();

  const { data: flow } = await supabase
    .from("remarketing_flows")
    .select("*")
    .eq("id", flowId)
    .single();

  if (!flow) notFound();

  const { data: bundles } = await supabase
    .from("product_bundles")
    .select("id, name")
    .eq("bot_id", botId)
    .eq("is_active", true);

  return (
    <FlowEditor
      flowId={flowId}
      flowName={flow.name}
      initialData={flow.flow_data as FlowData}
      botId={botId}
      bundles={(bundles ?? []).map((b) => ({ id: b.id, name: b.name }))}
      saveAction={saveRemarketingFlow}
      backUrl={`/dashboard/admin/users/${userId}/bots/${botId}/remarketing`}
    />
  );
}
```

**Settings** — `app/dashboard/admin/users/[userId]/bots/[botId]/settings/page.tsx`:

```typescript
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { BotSettingsForm } from "@/components/dashboard/bot-settings-form";
import type { Bot } from "@/lib/types/database";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;
  const supabase = await createClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .single();

  if (!bot) notFound();

  return (
    <div className="p-8">
      <BotSettingsForm bot={bot as Bot} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/admin/
git commit -m "feat: add admin bot management pages"
```

---

### Task 7: Update BotSidebar for Admin Context

**Files:**
- Modify: `components/dashboard/bot-sidebar.tsx`

- [ ] **Step 1: Read the current BotSidebar and update**

Read `components/dashboard/bot-sidebar.tsx`. Add `basePath` prop to the interface:

```typescript
interface BotSidebarProps {
  botId: string;
  botUsername: string;
  basePath?: string;
}
```

In the component body, compute the base and back URLs:

```typescript
const base = basePath ?? `/dashboard/bots/${botId}`;
const backUrl = basePath ? basePath.replace(/\/bots\/.*$/, "") : "/dashboard";
```

Then replace every `href={`/dashboard/bots/${botId}/...`}` with `href={`${base}/...`}`, and update the back link to use `backUrl`.

Also update the `pathname.startsWith(...)` checks for active state to use `base` instead of the hardcoded path.

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/bot-sidebar.tsx
git commit -m "feat: support admin basePath in BotSidebar"
```

---

### Task 8: Verify Build

- [ ] **Step 1: Run build**

```bash
npx next build
```

Expected: Compiled successfully, no type errors.

- [ ] **Step 2: Manual test checklist**

1. Login as admin (`felipebollauf12@gmail.com`)
2. Verify "Admin" nav item appears in sidebar
3. Click Admin → see all users listed
4. Change another user's role via inline dropdown
5. Click on a user → see profile with stats and bots
6. Click "Gerenciar" on a bot → navigate to bot pages
7. Verify all bot sub-pages load (flows, leads, transactions, etc.)
8. Login as regular user → verify "Admin" nav item does NOT appear
9. Try navigating to `/dashboard/admin/users` as regular user → verify redirect to `/dashboard`
