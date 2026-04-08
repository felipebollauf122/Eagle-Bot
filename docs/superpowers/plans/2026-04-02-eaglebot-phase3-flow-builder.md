# Phase 3: Flow Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a visual drag-and-drop flow editor using React Flow that lets users create, edit, and save Telegram bot message flows — the core UI experience of EagleBot.

**Architecture:** The Flow Builder is a full-screen client component (`"use client"`) built on `@xyflow/react` (React Flow v12). It lives at `/dashboard/bots/[botId]/flows/[flowId]/editor`. Flows are loaded from Supabase on the server page, passed as props to the client-side editor. The editor saves flow data (nodes + edges as JSONB) back to Supabase via a server action. Per-bot pages require a new dynamic route segment `[botId]` with its own sub-sidebar for bot-specific navigation.

**Tech Stack:** Next.js 16, React 19, @xyflow/react (React Flow v12), Tailwind 4, TypeScript, Supabase

**Spec reference:** `docs/superpowers/specs/2026-04-01-eaglebot-design.md` — Flow Builder section

---

## File Structure

```
app/dashboard/bots/[botId]/
├── layout.tsx                          # Bot-scoped layout with sub-sidebar
├── page.tsx                            # Bot dashboard (redirect to flows for now)
├── flows/
│   ├── page.tsx                        # Flow list page
│   └── [flowId]/
│       └── editor/
│           └── page.tsx                # Flow editor page (loads flow, renders editor)
components/dashboard/
├── bot-sidebar.tsx                     # Per-bot sidebar navigation
├── flow-list.tsx                       # Flow list component
├── flow-builder/
│   ├── flow-editor.tsx                 # Main React Flow canvas + toolbar
│   ├── node-palette.tsx                # Left sidebar — draggable node types
│   ├── node-config-panel.tsx           # Right panel — node configuration form
│   ├── nodes/
│   │   ├── trigger-node.tsx            # Custom Trigger node component
│   │   ├── text-node.tsx               # Custom Text node component
│   │   ├── image-node.tsx              # Custom Image node component
│   │   ├── button-node.tsx             # Custom Button node component
│   │   ├── delay-node.tsx              # Custom Delay node component
│   │   ├── condition-node.tsx          # Custom Condition node component
│   │   ├── input-node.tsx              # Custom Input node component
│   │   └── action-node.tsx             # Custom Action node component
│   └── config-forms/
│       ├── trigger-config.tsx          # Trigger node config form
│       ├── text-config.tsx             # Text node config form
│       ├── image-config.tsx            # Image node config form
│       ├── button-config.tsx           # Button node config form
│       ├── delay-config.tsx            # Delay node config form
│       ├── condition-config.tsx        # Condition node config form
│       ├── input-config.tsx            # Input node config form
│       └── action-config.tsx           # Action node config form
lib/
├── actions/
│   └── flow-actions.ts                 # Server actions: saveFlow, createFlow, deleteFlow, toggleFlow
```

---

## Task 1: Add @xyflow/react dependency and bot-scoped routing

**Files:**
- Modify: `package.json`
- Create: `app/dashboard/bots/[botId]/layout.tsx`
- Create: `app/dashboard/bots/[botId]/page.tsx`
- Create: `components/dashboard/bot-sidebar.tsx`

- [ ] **Step 1: Add @xyflow/react to package.json**

Add to `dependencies` in `package.json`:
```json
"@xyflow/react": "^12"
```

Then run:
```bash
npm install
```

- [ ] **Step 2: Create bot sub-sidebar component**

Create `components/dashboard/bot-sidebar.tsx`:
```tsx
"use client";

import { usePathname } from "next/navigation";

interface BotSidebarProps {
  botId: string;
  botUsername: string;
}

const botNavItems = [
  { label: "Fluxos", segment: "flows", icon: "🔀" },
  { label: "Leads", segment: "leads", icon: "👥" },
  { label: "Transações", segment: "transactions", icon: "💰" },
  { label: "Tracking", segment: "tracking", icon: "📈" },
  { label: "Configurações", segment: "settings", icon: "⚙️" },
];

export function BotSidebar({ botId, botUsername }: BotSidebarProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/bots/${botId}`;

  return (
    <aside className="w-56 min-h-screen bg-[#0d0d14] border-r border-white/5 flex flex-col">
      <div className="p-4 border-b border-white/5">
        <a
          href="/dashboard"
          className="text-white/40 hover:text-white text-xs transition"
        >
          ← Voltar
        </a>
        <h2 className="text-sm font-bold text-white mt-2 truncate">
          @{botUsername}
        </h2>
      </div>

      <nav className="flex-1 px-2 py-3">
        {botNavItems.map((item) => {
          const href = `${basePath}/${item.segment}`;
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <a
              key={item.segment}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm transition ${
                isActive
                  ? "bg-purple-600/10 text-purple-400"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Create bot-scoped layout**

Create `app/dashboard/bots/[botId]/layout.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { BotSidebar } from "@/components/dashboard/bot-sidebar";
import type { Bot } from "@/lib/types/database";

export default async function BotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .single();

  if (!bot) notFound();

  const typedBot = bot as Bot;

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <BotSidebar botId={botId} botUsername={typedBot.bot_username} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create bot dashboard page (redirect to flows)**

Create `app/dashboard/bots/[botId]/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default async function BotDashboardPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  redirect(`/dashboard/bots/${botId}/flows`);
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json components/dashboard/bot-sidebar.tsx app/dashboard/bots/
git commit -m "feat: add bot-scoped routing with sub-sidebar navigation"
```

---

## Task 2: Flow server actions (CRUD)

**Files:**
- Create: `lib/actions/flow-actions.ts`

- [ ] **Step 1: Create flow server actions**

Create `lib/actions/flow-actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { FlowData, TriggerType } from "@/lib/types/database";

export async function createFlow(botId: string, name: string, triggerType: TriggerType, triggerValue: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Get tenant_id from user
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!tenant) throw new Error("Tenant not found");

  const defaultFlowData: FlowData = {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        data: { trigger: triggerType, command: triggerValue },
        position: { x: 250, y: 50 },
      },
    ],
    edges: [],
  };

  const { data: flow, error } = await supabase
    .from("flows")
    .insert({
      tenant_id: tenant.id,
      bot_id: botId,
      name,
      trigger_type: triggerType,
      trigger_value: triggerValue,
      flow_data: defaultFlowData,
      is_active: false,
      version: 1,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create flow: ${error.message}`);

  redirect(`/dashboard/bots/${botId}/flows/${flow.id}/editor`);
}

export async function saveFlow(flowId: string, flowData: FlowData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("flows")
    .update({
      flow_data: flowData,
      version: undefined, // will be incremented by trigger if set up
    })
    .eq("id", flowId);

  if (error) throw new Error(`Failed to save flow: ${error.message}`);

  return { success: true };
}

export async function toggleFlow(flowId: string, isActive: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("flows")
    .update({ is_active: isActive })
    .eq("id", flowId);

  if (error) throw new Error(`Failed to toggle flow: ${error.message}`);

  return { success: true };
}

export async function deleteFlow(flowId: string, botId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("flows")
    .delete()
    .eq("id", flowId);

  if (error) throw new Error(`Failed to delete flow: ${error.message}`);

  redirect(`/dashboard/bots/${botId}/flows`);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/flow-actions.ts
git commit -m "feat: add flow server actions (create, save, toggle, delete)"
```

---

## Task 3: Flow list page

**Files:**
- Create: `app/dashboard/bots/[botId]/flows/page.tsx`
- Create: `components/dashboard/flow-list.tsx`

- [ ] **Step 1: Create flow list component**

Create `components/dashboard/flow-list.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createFlow, toggleFlow, deleteFlow } from "@/lib/actions/flow-actions";
import type { Flow, TriggerType } from "@/lib/types/database";

interface FlowListProps {
  flows: Flow[];
  botId: string;
}

export function FlowList({ flows, botId }: FlowListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("command");
  const [triggerValue, setTriggerValue] = useState("/start");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createFlow(botId, name, triggerType, triggerValue);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleToggle = async (flowId: string, currentState: boolean) => {
    await toggleFlow(flowId, !currentState);
    window.location.reload();
  };

  const handleDelete = async (flowId: string) => {
    if (!confirm("Tem certeza que deseja excluir este fluxo?")) return;
    await deleteFlow(flowId, botId);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Fluxos</h1>
          <p className="text-white/50 mt-1">
            Crie e gerencie seus fluxos de mensagens
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition"
        >
          + Novo Fluxo
        </button>
      </div>

      {showCreate && (
        <div className="bg-[#12121a] border border-white/10 rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Criar Novo Fluxo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Nome do Fluxo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Boas-vindas"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Tipo de Gatilho</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="command">Comando</option>
                <option value="first_contact">Primeiro Contato</option>
                <option value="callback">Callback</option>
                <option value="payment_event">Evento de Pagamento</option>
              </select>
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Valor do Gatilho</label>
              <input
                type="text"
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                placeholder="/start"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar Fluxo"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {flows.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-5xl mb-4 block">🔀</span>
          <h2 className="text-white text-lg font-semibold mb-2">Nenhum fluxo ainda</h2>
          <p className="text-white/40 mb-6">
            Crie seu primeiro fluxo de mensagens
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {flows.map((flow) => (
            <div
              key={flow.id}
              className="bg-[#12121a] border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-white/20 transition"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    flow.is_active ? "bg-green-400" : "bg-white/20"
                  }`}
                />
                <div>
                  <h3 className="text-white font-medium">{flow.name}</h3>
                  <p className="text-white/40 text-xs mt-0.5">
                    {flow.trigger_type === "command" ? `Comando: ${flow.trigger_value}` : flow.trigger_type}
                    {" · "}
                    {flow.flow_data.nodes.length} nós
                    {" · "}
                    v{flow.version}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(flow.id, flow.is_active)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition ${
                    flow.is_active
                      ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                      : "bg-white/5 text-white/40 hover:bg-white/10"
                  }`}
                >
                  {flow.is_active ? "Ativo" : "Inativo"}
                </button>
                <a
                  href={`/dashboard/bots/${flow.bot_id}/flows/${flow.id}/editor`}
                  className="px-3 py-1.5 bg-purple-600/10 text-purple-400 text-xs rounded-lg hover:bg-purple-600/20 transition"
                >
                  Editar
                </a>
                <button
                  onClick={() => handleDelete(flow.id)}
                  className="px-3 py-1.5 bg-red-500/10 text-red-400 text-xs rounded-lg hover:bg-red-500/20 transition"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create flow list page**

Create `app/dashboard/bots/[botId]/flows/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { FlowList } from "@/components/dashboard/flow-list";
import type { Flow } from "@/lib/types/database";

export default async function FlowsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  return <FlowList flows={(flows ?? []) as Flow[]} botId={botId} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/bots/\[botId\]/flows/ components/dashboard/flow-list.tsx
git commit -m "feat: add flow list page with create, toggle, and delete"
```

---

## Task 4: Custom React Flow node components

**Files:**
- Create: `components/dashboard/flow-builder/nodes/trigger-node.tsx`
- Create: `components/dashboard/flow-builder/nodes/text-node.tsx`
- Create: `components/dashboard/flow-builder/nodes/image-node.tsx`
- Create: `components/dashboard/flow-builder/nodes/button-node.tsx`
- Create: `components/dashboard/flow-builder/nodes/delay-node.tsx`
- Create: `components/dashboard/flow-builder/nodes/condition-node.tsx`
- Create: `components/dashboard/flow-builder/nodes/input-node.tsx`
- Create: `components/dashboard/flow-builder/nodes/action-node.tsx`

All custom nodes share the same pattern: styled dark card with colored accent, handles for connections, and a compact preview of the node data.

- [ ] **Step 1: Create trigger node**

Create `components/dashboard/flow-builder/nodes/trigger-node.tsx`:
```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function TriggerNode({ data, selected }: NodeProps) {
  const trigger = String(data.trigger ?? "command");
  const command = String(data.command ?? "/start");

  return (
    <div
      className={`bg-[#12121a] border rounded-xl px-4 py-3 min-w-[180px] shadow-lg ${
        selected ? "border-green-400" : "border-green-500/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-green-400 text-xs font-semibold uppercase">Gatilho</span>
      </div>
      <p className="text-white text-sm">
        {trigger === "command" ? command : trigger === "first_contact" ? "Primeiro contato" : trigger}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-green-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
    </div>
  );
}
```

- [ ] **Step 2: Create text node**

Create `components/dashboard/flow-builder/nodes/text-node.tsx`:
```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function TextNode({ data, selected }: NodeProps) {
  const text = String(data.text ?? "Mensagem...");
  const preview = text.length > 60 ? text.slice(0, 60) + "..." : text;

  return (
    <div
      className={`bg-[#12121a] border rounded-xl px-4 py-3 min-w-[200px] max-w-[280px] shadow-lg ${
        selected ? "border-blue-400" : "border-blue-500/30"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <span className="text-blue-400 text-xs font-semibold uppercase">Texto</span>
      </div>
      <p className="text-white/70 text-sm">{preview}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
    </div>
  );
}
```

- [ ] **Step 3: Create image node**

Create `components/dashboard/flow-builder/nodes/image-node.tsx`:
```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function ImageNode({ data, selected }: NodeProps) {
  const caption = data.caption ? String(data.caption) : "Sem legenda";

  return (
    <div
      className={`bg-[#12121a] border rounded-xl px-4 py-3 min-w-[180px] shadow-lg ${
        selected ? "border-blue-400" : "border-blue-500/30"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <span className="text-blue-400 text-xs font-semibold uppercase">Imagem</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl">🖼️</span>
        <p className="text-white/70 text-sm">{caption}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
    </div>
  );
}
```

- [ ] **Step 4: Create button node**

Create `components/dashboard/flow-builder/nodes/button-node.tsx`:
```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

interface ButtonData {
  text: string;
  action: string;
  value: string;
}

export function ButtonNode({ data, selected }: NodeProps) {
  const text = String(data.text ?? "Mensagem com botões");
  const buttons = (data.buttons ?? []) as ButtonData[];

  return (
    <div
      className={`bg-[#12121a] border rounded-xl px-4 py-3 min-w-[200px] max-w-[280px] shadow-lg ${
        selected ? "border-blue-400" : "border-blue-500/30"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <span className="text-blue-400 text-xs font-semibold uppercase">Botões</span>
      </div>
      <p className="text-white/70 text-sm mb-2">{text.length > 40 ? text.slice(0, 40) + "..." : text}</p>
      <div className="space-y-1">
        {buttons.map((btn, i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white/60 text-xs text-center"
          >
            {btn.text}
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
    </div>
  );
}
```

- [ ] **Step 5: Create delay node**

Create `components/dashboard/flow-builder/nodes/delay-node.tsx`:
```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function DelayNode({ data, selected }: NodeProps) {
  const amount = Number(data.amount ?? 0);
  const unit = String(data.unit ?? "seconds");
  const unitLabel = unit === "seconds" ? "seg" : unit === "minutes" ? "min" : "hrs";

  return (
    <div
      className={`bg-[#12121a] border rounded-xl px-4 py-3 min-w-[160px] shadow-lg ${
        selected ? "border-gray-400" : "border-gray-500/30"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-gray-400 text-xs font-semibold uppercase">Delay</span>
      </div>
      <p className="text-white text-sm">⏱️ {amount} {unitLabel}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
    </div>
  );
}
```

- [ ] **Step 6: Create condition node**

Create `components/dashboard/flow-builder/nodes/condition-node.tsx`:
```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function ConditionNode({ data, selected }: NodeProps) {
  const field = String(data.field ?? "campo");
  const operator = String(data.operator ?? "equals");
  const value = String(data.value ?? "");

  const opLabel: Record<string, string> = {
    equals: "=",
    not_equals: "≠",
    exists: "existe",
    not_exists: "não existe",
    contains: "contém",
    greater_than: ">",
    less_than: "<",
  };

  return (
    <div
      className={`bg-[#12121a] border rounded-xl px-4 py-3 min-w-[200px] shadow-lg ${
        selected ? "border-orange-400" : "border-orange-500/30"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-orange-400" />
        <span className="text-orange-400 text-xs font-semibold uppercase">Condição</span>
      </div>
      <p className="text-white/70 text-sm">
        {field} {opLabel[operator] ?? operator} {value}
      </p>
      <div className="flex justify-between mt-2">
        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          className="!bg-green-400 !w-3 !h-3 !border-2 !border-[#12121a] !left-[30%]"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          className="!bg-red-400 !w-3 !h-3 !border-2 !border-[#12121a] !left-[70%]"
        />
      </div>
      <div className="flex justify-between mt-1 px-1">
        <span className="text-green-400 text-[10px]">Sim</span>
        <span className="text-red-400 text-[10px]">Não</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create input node**

Create `components/dashboard/flow-builder/nodes/input-node.tsx`:
```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function InputNode({ data, selected }: NodeProps) {
  const prompt = String(data.prompt ?? "Pergunta...");
  const variable = String(data.variable ?? "resposta");

  return (
    <div
      className={`bg-[#12121a] border rounded-xl px-4 py-3 min-w-[200px] max-w-[280px] shadow-lg ${
        selected ? "border-purple-400" : "border-purple-500/30"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-purple-400" />
        <span className="text-purple-400 text-xs font-semibold uppercase">Input</span>
      </div>
      <p className="text-white/70 text-sm">{prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt}</p>
      <p className="text-purple-400/60 text-xs mt-1">→ {`{{${variable}}}`}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
    </div>
  );
}
```

- [ ] **Step 8: Create action node**

Create `components/dashboard/flow-builder/nodes/action-node.tsx`:
```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function ActionNode({ data, selected }: NodeProps) {
  const actionType = String(data.action_type ?? "set_variable");
  const labels: Record<string, string> = {
    add_tag: "Adicionar Tag",
    remove_tag: "Remover Tag",
    set_variable: "Definir Variável",
    start_flow: "Iniciar Fluxo",
    stop_flow: "Parar Fluxo",
  };

  const detail =
    actionType === "add_tag" || actionType === "remove_tag"
      ? String(data.tag ?? "")
      : actionType === "set_variable"
        ? `${data.variable ?? ""} = ${data.value ?? ""}`
        : "";

  return (
    <div
      className={`bg-[#12121a] border rounded-xl px-4 py-3 min-w-[180px] shadow-lg ${
        selected ? "border-gray-400" : "border-gray-500/30"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-gray-400 text-xs font-semibold uppercase">Ação</span>
      </div>
      <p className="text-white text-sm">{labels[actionType] ?? actionType}</p>
      {detail && <p className="text-white/40 text-xs mt-0.5">{detail}</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/flow-builder/nodes/
git commit -m "feat: add all custom React Flow node components (8 types)"
```

---

## Task 5: Node palette (draggable sidebar)

**Files:**
- Create: `components/dashboard/flow-builder/node-palette.tsx`

- [ ] **Step 1: Create node palette**

Create `components/dashboard/flow-builder/node-palette.tsx`:
```tsx
"use client";

import type { DragEvent } from "react";

interface NodeTypeItem {
  type: string;
  label: string;
  color: string;
  category: string;
}

const nodeTypes: NodeTypeItem[] = [
  { type: "trigger", label: "Gatilho", color: "bg-green-400", category: "Início" },
  { type: "text", label: "Texto", color: "bg-blue-400", category: "Mensagens" },
  { type: "image", label: "Imagem", color: "bg-blue-400", category: "Mensagens" },
  { type: "button", label: "Botões", color: "bg-blue-400", category: "Mensagens" },
  { type: "input", label: "Input", color: "bg-purple-400", category: "Mensagens" },
  { type: "delay", label: "Delay", color: "bg-gray-400", category: "Lógica" },
  { type: "condition", label: "Condição", color: "bg-orange-400", category: "Lógica" },
  { type: "action", label: "Ação", color: "bg-gray-400", category: "Ações" },
];

const categories = ["Início", "Mensagens", "Lógica", "Ações"];

function onDragStart(event: DragEvent, nodeType: string) {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.effectAllowed = "move";
}

export function NodePalette() {
  return (
    <div className="w-52 bg-[#0d0d14] border-r border-white/5 p-3 overflow-y-auto">
      <h3 className="text-white/40 text-xs font-semibold uppercase mb-3 px-1">Componentes</h3>
      {categories.map((cat) => {
        const items = nodeTypes.filter((n) => n.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="mb-4">
            <p className="text-white/30 text-[10px] uppercase font-semibold px-1 mb-1.5">{cat}</p>
            {items.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg mb-1 cursor-grab active:cursor-grabbing hover:bg-white/5 transition"
              >
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-white/70 text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/flow-builder/node-palette.tsx
git commit -m "feat: add draggable node palette sidebar"
```

---

## Task 6: Node configuration panel

**Files:**
- Create: `components/dashboard/flow-builder/node-config-panel.tsx`
- Create: `components/dashboard/flow-builder/config-forms/trigger-config.tsx`
- Create: `components/dashboard/flow-builder/config-forms/text-config.tsx`
- Create: `components/dashboard/flow-builder/config-forms/image-config.tsx`
- Create: `components/dashboard/flow-builder/config-forms/button-config.tsx`
- Create: `components/dashboard/flow-builder/config-forms/delay-config.tsx`
- Create: `components/dashboard/flow-builder/config-forms/condition-config.tsx`
- Create: `components/dashboard/flow-builder/config-forms/input-config.tsx`
- Create: `components/dashboard/flow-builder/config-forms/action-config.tsx`

- [ ] **Step 1: Create individual config forms**

Create `components/dashboard/flow-builder/config-forms/trigger-config.tsx`:
```tsx
"use client";

interface TriggerConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function TriggerConfig({ data, onChange }: TriggerConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-white/60 text-xs mb-1">Tipo de Gatilho</label>
        <select
          value={String(data.trigger ?? "command")}
          onChange={(e) => onChange({ ...data, trigger: e.target.value })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="command">Comando</option>
          <option value="first_contact">Primeiro Contato</option>
        </select>
      </div>
      {String(data.trigger ?? "command") === "command" && (
        <div>
          <label className="block text-white/60 text-xs mb-1">Comando</label>
          <input
            type="text"
            value={String(data.command ?? "/start")}
            onChange={(e) => onChange({ ...data, command: e.target.value })}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
      )}
    </div>
  );
}
```

Create `components/dashboard/flow-builder/config-forms/text-config.tsx`:
```tsx
"use client";

interface TextConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function TextConfig({ data, onChange }: TextConfigProps) {
  return (
    <div>
      <label className="block text-white/60 text-xs mb-1">Mensagem</label>
      <textarea
        value={String(data.text ?? "")}
        onChange={(e) => onChange({ ...data, text: e.target.value })}
        rows={5}
        placeholder="Use {{first_name}} para variáveis"
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
      />
      <p className="text-white/30 text-xs mt-1">
        Variáveis: {`{{first_name}}`}, {`{{username}}`}, ou variáveis do estado
      </p>
    </div>
  );
}
```

Create `components/dashboard/flow-builder/config-forms/image-config.tsx`:
```tsx
"use client";

interface ImageConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function ImageConfig({ data, onChange }: ImageConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-white/60 text-xs mb-1">URL da Imagem</label>
        <input
          type="url"
          value={String(data.image_url ?? "")}
          onChange={(e) => onChange({ ...data, image_url: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        />
      </div>
      <div>
        <label className="block text-white/60 text-xs mb-1">Legenda (opcional)</label>
        <input
          type="text"
          value={String(data.caption ?? "")}
          onChange={(e) => onChange({ ...data, caption: e.target.value })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        />
      </div>
    </div>
  );
}
```

Create `components/dashboard/flow-builder/config-forms/button-config.tsx`:
```tsx
"use client";

interface ButtonData {
  text: string;
  action: string;
  value: string;
}

interface ButtonConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function ButtonConfig({ data, onChange }: ButtonConfigProps) {
  const text = String(data.text ?? "");
  const buttons = (data.buttons ?? []) as ButtonData[];

  const updateButton = (index: number, field: keyof ButtonData, value: string) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...data, buttons: updated });
  };

  const addButton = () => {
    onChange({
      ...data,
      buttons: [...buttons, { text: "Novo Botão", action: "callback", value: "" }],
    });
  };

  const removeButton = (index: number) => {
    onChange({ ...data, buttons: buttons.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-white/60 text-xs mb-1">Mensagem</label>
        <textarea
          value={text}
          onChange={(e) => onChange({ ...data, text: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-white/60 text-xs mb-1">Botões</label>
        {buttons.map((btn, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-2.5 mb-2 space-y-2">
            <input
              type="text"
              value={btn.text}
              onChange={(e) => updateButton(i, "text", e.target.value)}
              placeholder="Texto do botão"
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-purple-500"
            />
            <div className="flex gap-2">
              <select
                value={btn.action}
                onChange={(e) => updateButton(i, "action", e.target.value)}
                className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none"
              >
                <option value="callback">Callback</option>
                <option value="go_to_node">Ir para nó</option>
                <option value="open_url">Abrir URL</option>
              </select>
              <button
                onClick={() => removeButton(i)}
                className="px-2 py-1 text-red-400 text-xs hover:bg-red-500/10 rounded"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              value={btn.value}
              onChange={(e) => updateButton(i, "value", e.target.value)}
              placeholder={btn.action === "open_url" ? "https://..." : "Valor"}
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-purple-500"
            />
          </div>
        ))}
        <button
          onClick={addButton}
          className="w-full py-1.5 border border-dashed border-white/10 rounded-lg text-white/40 text-xs hover:border-white/20 hover:text-white/60 transition"
        >
          + Adicionar Botão
        </button>
      </div>
    </div>
  );
}
```

Create `components/dashboard/flow-builder/config-forms/delay-config.tsx`:
```tsx
"use client";

interface DelayConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function DelayConfig({ data, onChange }: DelayConfigProps) {
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <label className="block text-white/60 text-xs mb-1">Duração</label>
        <input
          type="number"
          value={Number(data.amount ?? 0)}
          onChange={(e) => onChange({ ...data, amount: parseInt(e.target.value) || 0 })}
          min={0}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        />
      </div>
      <div className="flex-1">
        <label className="block text-white/60 text-xs mb-1">Unidade</label>
        <select
          value={String(data.unit ?? "seconds")}
          onChange={(e) => onChange({ ...data, unit: e.target.value })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="seconds">Segundos</option>
          <option value="minutes">Minutos</option>
          <option value="hours">Horas</option>
        </select>
      </div>
    </div>
  );
}
```

Create `components/dashboard/flow-builder/config-forms/condition-config.tsx`:
```tsx
"use client";

interface ConditionConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function ConditionConfig({ data, onChange }: ConditionConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-white/60 text-xs mb-1">Campo</label>
        <input
          type="text"
          value={String(data.field ?? "")}
          onChange={(e) => onChange({ ...data, field: e.target.value })}
          placeholder="Ex: paid, email, tag"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        />
      </div>
      <div>
        <label className="block text-white/60 text-xs mb-1">Operador</label>
        <select
          value={String(data.operator ?? "equals")}
          onChange={(e) => onChange({ ...data, operator: e.target.value })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="equals">Igual a</option>
          <option value="not_equals">Diferente de</option>
          <option value="exists">Existe</option>
          <option value="not_exists">Não existe</option>
          <option value="contains">Contém</option>
          <option value="greater_than">Maior que</option>
          <option value="less_than">Menor que</option>
        </select>
      </div>
      {!["exists", "not_exists"].includes(String(data.operator ?? "equals")) && (
        <div>
          <label className="block text-white/60 text-xs mb-1">Valor</label>
          <input
            type="text"
            value={String(data.value ?? "")}
            onChange={(e) => onChange({ ...data, value: e.target.value })}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
      )}
    </div>
  );
}
```

Create `components/dashboard/flow-builder/config-forms/input-config.tsx`:
```tsx
"use client";

interface InputConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function InputConfig({ data, onChange }: InputConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-white/60 text-xs mb-1">Mensagem / Pergunta</label>
        <textarea
          value={String(data.prompt ?? "")}
          onChange={(e) => onChange({ ...data, prompt: e.target.value })}
          rows={3}
          placeholder="Qual seu email?"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-white/60 text-xs mb-1">Salvar em variável</label>
        <input
          type="text"
          value={String(data.variable ?? "")}
          onChange={(e) => onChange({ ...data, variable: e.target.value })}
          placeholder="email"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        />
        <p className="text-white/30 text-xs mt-1">
          A resposta será salva como {`{{${data.variable || "variavel"}}}`}
        </p>
      </div>
    </div>
  );
}
```

Create `components/dashboard/flow-builder/config-forms/action-config.tsx`:
```tsx
"use client";

interface ActionConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function ActionConfig({ data, onChange }: ActionConfigProps) {
  const actionType = String(data.action_type ?? "set_variable");

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-white/60 text-xs mb-1">Tipo de Ação</label>
        <select
          value={actionType}
          onChange={(e) => onChange({ ...data, action_type: e.target.value })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="add_tag">Adicionar Tag</option>
          <option value="remove_tag">Remover Tag</option>
          <option value="set_variable">Definir Variável</option>
          <option value="start_flow">Iniciar Fluxo</option>
          <option value="stop_flow">Parar Fluxo</option>
        </select>
      </div>
      {(actionType === "add_tag" || actionType === "remove_tag") && (
        <div>
          <label className="block text-white/60 text-xs mb-1">Tag</label>
          <input
            type="text"
            value={String(data.tag ?? "")}
            onChange={(e) => onChange({ ...data, tag: e.target.value })}
            placeholder="comprador"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
      )}
      {actionType === "set_variable" && (
        <>
          <div>
            <label className="block text-white/60 text-xs mb-1">Variável</label>
            <input
              type="text"
              value={String(data.variable ?? "")}
              onChange={(e) => onChange({ ...data, variable: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">Valor</label>
            <input
              type="text"
              value={String(data.value ?? "")}
              onChange={(e) => onChange({ ...data, value: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the config panel dispatcher**

Create `components/dashboard/flow-builder/node-config-panel.tsx`:
```tsx
"use client";

import type { Node } from "@xyflow/react";
import { TriggerConfig } from "./config-forms/trigger-config";
import { TextConfig } from "./config-forms/text-config";
import { ImageConfig } from "./config-forms/image-config";
import { ButtonConfig } from "./config-forms/button-config";
import { DelayConfig } from "./config-forms/delay-config";
import { ConditionConfig } from "./config-forms/condition-config";
import { InputConfig } from "./config-forms/input-config";
import { ActionConfig } from "./config-forms/action-config";

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
}

const labels: Record<string, string> = {
  trigger: "Gatilho",
  text: "Texto",
  image: "Imagem",
  button: "Botões",
  delay: "Delay",
  condition: "Condição",
  input: "Input",
  action: "Ação",
};

export function NodeConfigPanel({ node, onUpdate, onClose, onDelete }: NodeConfigPanelProps) {
  if (!node) return null;

  const handleChange = (data: Record<string, unknown>) => {
    onUpdate(node.id, data);
  };

  const configForms: Record<string, React.ReactNode> = {
    trigger: <TriggerConfig data={node.data} onChange={handleChange} />,
    text: <TextConfig data={node.data} onChange={handleChange} />,
    image: <ImageConfig data={node.data} onChange={handleChange} />,
    button: <ButtonConfig data={node.data} onChange={handleChange} />,
    delay: <DelayConfig data={node.data} onChange={handleChange} />,
    condition: <ConditionConfig data={node.data} onChange={handleChange} />,
    input: <InputConfig data={node.data} onChange={handleChange} />,
    action: <ActionConfig data={node.data} onChange={handleChange} />,
  };

  return (
    <div className="w-72 bg-[#0d0d14] border-l border-white/5 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">
          {labels[node.type ?? ""] ?? "Configuração"}
        </h3>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-sm"
        >
          ✕
        </button>
      </div>

      {configForms[node.type ?? ""]}

      <div className="mt-6 pt-4 border-t border-white/5">
        <button
          onClick={() => onDelete(node.id)}
          className="w-full py-2 bg-red-500/10 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition"
        >
          Excluir Nó
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/flow-builder/config-forms/ components/dashboard/flow-builder/node-config-panel.tsx
git commit -m "feat: add node configuration panel with forms for all 8 node types"
```

---

## Task 7: Main flow editor (React Flow canvas)

**Files:**
- Create: `components/dashboard/flow-builder/flow-editor.tsx`

- [ ] **Step 1: Create the main flow editor component**

Create `components/dashboard/flow-builder/flow-editor.tsx`:
```tsx
"use client";

import { useCallback, useState, useRef, useMemo, type DragEvent } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { NodePalette } from "./node-palette";
import { NodeConfigPanel } from "./node-config-panel";
import { TriggerNode } from "./nodes/trigger-node";
import { TextNode } from "./nodes/text-node";
import { ImageNode } from "./nodes/image-node";
import { ButtonNode } from "./nodes/button-node";
import { DelayNode } from "./nodes/delay-node";
import { ConditionNode } from "./nodes/condition-node";
import { InputNode } from "./nodes/input-node";
import { ActionNode } from "./nodes/action-node";
import { saveFlow } from "@/lib/actions/flow-actions";
import type { FlowData } from "@/lib/types/database";

interface FlowEditorProps {
  flowId: string;
  flowName: string;
  initialData: FlowData;
  botId: string;
}

const nodeTypeComponents = {
  trigger: TriggerNode,
  text: TextNode,
  image: ImageNode,
  button: ButtonNode,
  delay: DelayNode,
  condition: ConditionNode,
  input: InputNode,
  action: ActionNode,
};

const defaultNodeData: Record<string, Record<string, unknown>> = {
  trigger: { trigger: "command", command: "/start" },
  text: { text: "Mensagem aqui..." },
  image: { image_url: "", caption: "" },
  button: { text: "Escolha uma opção:", buttons: [] },
  delay: { amount: 5, unit: "seconds" },
  condition: { field: "", operator: "equals", value: "" },
  input: { prompt: "Qual seu email?", variable: "email" },
  action: { action_type: "set_variable", variable: "", value: "" },
};

let nodeIdCounter = 0;
function generateNodeId(type: string) {
  nodeIdCounter++;
  return `${type}-${Date.now()}-${nodeIdCounter}`;
}

export function FlowEditor({ flowId, flowName, initialData, botId }: FlowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const nodeTypes = useMemo(() => nodeTypeComponents, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: `e-${Date.now()}` }, eds));
    },
    [setEdges],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };

      const newNode: Node = {
        id: generateNodeId(type),
        type,
        position,
        data: { ...defaultNodeData[type] },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...data } } : n)),
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId ? { ...prev, data: { ...data } } : prev,
      );
    },
    [setNodes],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const flowData: FlowData = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type as FlowData["nodes"][0]["type"],
          data: n.data,
          position: n.position,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
        })),
      };
      await saveFlow(flowId, flowData);
      setLastSaved(new Date().toLocaleTimeString("pt-BR"));
    } catch (error) {
      console.error("Failed to save flow:", error);
    } finally {
      setSaving(false);
    }
  }, [flowId, nodes, edges]);

  return (
    <div className="flex h-screen">
      <NodePalette />

      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-14 bg-[#0d0d14] border-b border-white/5 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <a
              href={`/dashboard/bots/${botId}/flows`}
              className="text-white/40 hover:text-white text-sm transition"
            >
              ←
            </a>
            <h2 className="text-white font-semibold text-sm">{flowName}</h2>
          </div>
          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-white/30 text-xs">Salvo às {lastSaved}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[#0a0a0f]"
            defaultEdgeOptions={{
              style: { stroke: "#6b21a8", strokeWidth: 2 },
              animated: true,
            }}
          >
            <Controls className="!bg-[#12121a] !border-white/10 !rounded-lg [&>button]:!bg-[#12121a] [&>button]:!border-white/10 [&>button]:!text-white/60 [&>button:hover]:!bg-white/10" />
            <MiniMap
              className="!bg-[#12121a] !border-white/10 !rounded-lg"
              nodeColor="#6b21a8"
              maskColor="rgba(0,0,0,0.7)"
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#ffffff08"
            />
          </ReactFlow>
        </div>
      </div>

      <NodeConfigPanel
        node={selectedNode}
        onUpdate={handleUpdateNode}
        onClose={() => setSelectedNode(null)}
        onDelete={handleDeleteNode}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/flow-builder/flow-editor.tsx
git commit -m "feat: add main flow editor with React Flow canvas, drag-and-drop, save"
```

---

## Task 8: Flow editor page (server component that loads data)

**Files:**
- Create: `app/dashboard/bots/[botId]/flows/[flowId]/editor/page.tsx`

- [ ] **Step 1: Create the editor page**

Create `app/dashboard/bots/[botId]/flows/[flowId]/editor/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { FlowEditor } from "@/components/dashboard/flow-builder/flow-editor";
import type { Flow } from "@/lib/types/database";

export default async function FlowEditorPage({
  params,
}: {
  params: Promise<{ botId: string; flowId: string }>;
}) {
  const { botId, flowId } = await params;
  const supabase = await createClient();

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .eq("bot_id", botId)
    .single();

  if (!flow) notFound();

  const typedFlow = flow as Flow;

  return (
    <FlowEditor
      flowId={typedFlow.id}
      flowName={typedFlow.name}
      initialData={typedFlow.flow_data}
      botId={botId}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/bots/\[botId\]/flows/\[flowId\]/editor/
git commit -m "feat: add flow editor page that loads flow data and renders editor"
```

---

## Task 9: Update BotCard to link to bot pages and update main sidebar

**Files:**
- Modify: `components/dashboard/bot-card.tsx`

- [ ] **Step 1: Update BotCard to link to bot dashboard**

Read the current `components/dashboard/bot-card.tsx` and update it so clicking a bot card navigates to `/dashboard/bots/[botId]`. The card should link to the bot's flows page.

Read the file first, then modify the main wrapper to be an `<a>` tag:

In `components/dashboard/bot-card.tsx`, change the outer `<div>` to an `<a>` tag:
```tsx
<a href={`/dashboard/bots/${bot.id}/flows`} className="...existing classes... cursor-pointer">
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/bot-card.tsx
git commit -m "feat: make bot cards link to bot flows page"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Verify all new files exist**

```bash
find app/dashboard/bots -type f | sort
find components/dashboard/flow-builder -type f | sort
ls lib/actions/flow-actions.ts
```

Expected files:
```
app/dashboard/bots/[botId]/layout.tsx
app/dashboard/bots/[botId]/page.tsx
app/dashboard/bots/[botId]/flows/page.tsx
app/dashboard/bots/[botId]/flows/[flowId]/editor/page.tsx
components/dashboard/flow-builder/flow-editor.tsx
components/dashboard/flow-builder/node-palette.tsx
components/dashboard/flow-builder/node-config-panel.tsx
components/dashboard/flow-builder/nodes/trigger-node.tsx
components/dashboard/flow-builder/nodes/text-node.tsx
components/dashboard/flow-builder/nodes/image-node.tsx
components/dashboard/flow-builder/nodes/button-node.tsx
components/dashboard/flow-builder/nodes/delay-node.tsx
components/dashboard/flow-builder/nodes/condition-node.tsx
components/dashboard/flow-builder/nodes/input-node.tsx
components/dashboard/flow-builder/nodes/action-node.tsx
components/dashboard/flow-builder/config-forms/trigger-config.tsx
components/dashboard/flow-builder/config-forms/text-config.tsx
components/dashboard/flow-builder/config-forms/image-config.tsx
components/dashboard/flow-builder/config-forms/button-config.tsx
components/dashboard/flow-builder/config-forms/delay-config.tsx
components/dashboard/flow-builder/config-forms/condition-config.tsx
components/dashboard/flow-builder/config-forms/input-config.tsx
components/dashboard/flow-builder/config-forms/action-config.tsx
lib/actions/flow-actions.ts
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Navigate to:
1. `/dashboard` — should show bot list
2. Click a bot → should go to `/dashboard/bots/[botId]/flows`
3. Create a flow → should redirect to editor
4. Editor should show React Flow canvas with drag-and-drop working

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "chore: Phase 3 Flow Builder complete"
```
