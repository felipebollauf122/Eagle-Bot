# Admin Panel — Design Spec

## Overview

Painel administrativo para gerenciar todos os usuarios do EagleBot. Admins podem visualizar e editar qualquer recurso do sistema como se fossem o dono, alem de gerenciar roles de usuarios.

## Database Changes

### Migration: `add_admin_role`
- Already applied: `ALTER TABLE tenants ADD COLUMN role text NOT NULL DEFAULT 'user'`
- Values: `'user'` (default) | `'admin'`
- Admin account: `felipebollauf12@gmail.com`

### RLS Policy Updates
Add admin bypass to ALL existing RLS policies on these tables:
- `bots`, `products`, `product_bundles`, `product_bundle_items`
- `flows`, `leads`, `transactions`, `tracking_events`
- `remarketing_configs`, `remarketing_flows`, `remarketing_progress`

Pattern for each policy:
```sql
-- Existing: tenant_id = auth.uid()
-- New: tenant_id = auth.uid() OR EXISTS (SELECT 1 FROM tenants WHERE id = auth.uid() AND role = 'admin')
```

## Navigation

- New "Admin" nav item in `sidebar.tsx`, below "Meus Bots"
- Shield icon, accent color
- Only visible when `tenant.role === 'admin'`
- Links to `/dashboard/admin/users`

## Pages & Routes

### 1. `/dashboard/admin/users` — User List

Table columns:
| Column | Source |
|--------|--------|
| Nome | tenants.name |
| Email | tenants.email |
| Role | tenants.role (inline toggle dropdown) |
| Plano | tenants.plan |
| Cadastro | tenants.created_at |
| Ultimo login | auth.users.last_sign_in_at (via service role) |
| Bots | count(bots) with active/total breakdown |
| Leads | count(leads) |
| Transacoes | count(transactions where status='approved') |
| Receita | sum(transactions.amount where status='approved') |

Features:
- Search by name/email
- Filter by role (all / admin / user)
- Click row opens user profile
- Inline role toggle (dropdown: user/admin)

### 2. `/dashboard/admin/users/[userId]` — User Profile

Sections:
- **Header**: name, email, role (editable dropdown), plan, cadastro, ultimo login
- **Stats cards**: total bots, total leads, total transactions, total revenue
- **Bot list**: table with bot name, username, status (active/inactive), leads count, revenue
- Click bot row navigates to `/dashboard/admin/users/[userId]/bots/[botId]/flows`

### 3. `/dashboard/admin/users/[userId]/bots/[botId]/*` — Bot Management

Reuses ALL existing bot page components:
- `/flows` — FlowList
- `/flows/[flowId]/editor` — FlowEditor
- `/products` — ProductList
- `/bundles` — BundleList
- `/leads` — LeadsTable
- `/transactions` — TransactionsTable
- `/remarketing` — RemarketingDashboard
- `/remarketing/[flowId]/editor` — FlowEditor (remarketing)
- `/tracking` — TrackingStats
- `/settings` — BotSettingsForm

These pages fetch data using the `userId` param instead of `auth.uid()`. Since RLS policies will allow admin access to all data, the existing Supabase queries will work — we just need to filter by `bot.tenant_id = userId` instead of relying on RLS auto-filtering.

## Data Access Strategy

**Approach: RLS policies with admin bypass**

All existing RLS policies get an additional OR clause that checks if the current user is an admin. This means:
- Existing code continues to work unchanged for regular users
- Admin queries automatically have access to all data
- No need for service role key in frontend (more secure)

For admin-specific pages, server actions will:
1. Verify the current user is admin (query tenants table)
2. Query data filtered by the target `userId` param
3. RLS allows it because the user is admin

Exception: `auth.users.last_sign_in_at` requires service role access (Supabase auth admin API).

## Components

### New Components
- `AdminGuard` — Server component wrapper, checks role, redirects to `/dashboard` if not admin
- `AdminUserTable` — User list with aggregated metrics
- `AdminUserProfile` — User detail page with stats and bot list
- `AdminRoleToggle` — Inline dropdown to change user role

### Reused Components (no changes needed)
- `BotSidebar` — Navigation within a bot (needs `backUrl` adjustment for admin context)
- `BotSettingsForm`, `FlowList`, `FlowEditor`, `LeadsTable`, `TransactionsTable`
- `ProductList`, `BundleList`, `RemarketingDashboard`, `TrackingStats`
- `OverviewStats` (adapted for single-user context)

## Server Actions

### New: `lib/actions/admin-actions.ts`
- `getAdminUsers()` — List all tenants with aggregated metrics
- `getUserProfile(userId)` — Single tenant with stats
- `getUserBots(userId)` — List bots for a specific tenant
- `updateUserRole(userId, role)` — Change user role
- `isAdmin()` — Check if current user is admin

### Modified: Existing bot page server components
- Admin bot pages pass `userId` to existing queries
- Existing queries work because RLS allows admin access

## Security

- Admin check happens server-side in every admin route (AdminGuard)
- RLS policies enforce admin access at database level (defense in depth)
- Role changes require existing admin (can't self-promote via API)
- `updateUserRole` action verifies caller is admin before executing

## Design System

All admin pages use the existing "Obsidian Command" design system:
- Cards with gradient surfaces
- Accent color for admin-specific elements
- Table styling consistent with LeadsTable/TransactionsTable
- Shield icon motif for admin branding
