import {
  DEMO_STEPS,
  DESTINATIONS,
  GUEST_STARTER_CHIPS,
  PERSONA_CHIPS,
  STAFF_KIND_CHIPS,
  getDestination,
  loginForPersona,
  withGuide,
} from "@/lib/assistant/catalog";
import type {
  AssistantAction,
  AssistantDestination,
  AssistantReply,
  AssistantSession,
  AssistantTurn,
  AssistantTurnInput,
  GuestPersona,
  LookupTopic,
  PendingLogin,
  ShopRole,
  StaffKind,
} from "@/lib/assistant/types";

const ACCOUNT_PHRASES = [
  "access my account",
  "access to my account",
  "my account",
  "sign in",
  "sign me in",
  "log in",
  "login",
  "i want to login",
  "i want to log in",
  "open my account",
  "অ্যাকাউন্ট",
  "লগ ইন",
  "লগইন",
  "logáil isteach",
  "entrar",
  "iniciar sessão",
];

const DEMO_PHRASES = [
  "guest demo",
  "try demo",
  "demo mode",
  "show me a demo",
  "walkthrough",
  "tour",
  "ডেমো",
  "taispeántas",
  "demonstração",
];

const PAYMENT_POS = [
  "take a payment",
  "take payment",
  "customer pay",
  "charge the customer",
  "till payment",
  "cash or card",
  "card machine",
  "contactless",
  "পেমেন্ট নিন",
  "টাকা নিন",
  "glac le híocaíocht",
  "receber pagamento",
];

const PAYMENT_BILLING = [
  "subscription",
  "billing",
  "shopos plan",
  "monthly fee",
  "card on file",
  "invoice",
  "pay shopos",
];

export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{M}\p{N}+#]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasKeyword(text: string, keyword: string): boolean {
  const k = normalizeText(keyword);
  if (!k) return false;
  if (k.includes(" ")) return text.includes(k);
  if (k.length <= 3) {
    return new RegExp(`(?:^|\\s)${escapeRegExp(k)}(?:\\s|$)`).test(text);
  }
  return text.includes(k);
}

function scoreDestination(text: string, dest: AssistantDestination): number {
  let score = 0;
  for (const keyword of dest.keywords) {
    if (hasKeyword(text, keyword)) {
      score += Math.max(1, normalizeText(keyword).split(" ").length);
    }
  }
  return score;
}

export function rankDestinations(
  text: string,
): Array<{ dest: AssistantDestination; score: number }> {
  return DESTINATIONS.map((dest) => ({ dest, score: scoreDestination(text, dest) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function canAccess(dest: AssistantDestination, session: AssistantSession): boolean {
  if (dest.public) return true;
  if (!session.signedIn) return false;
  if (dest.platformOnly) return session.isPlatformStaff;
  if (!dest.roles || dest.roles.length === 0) {
    return Boolean(session.role) || session.isPlatformStaff;
  }
  if (session.role && dest.roles.includes(session.role)) return true;
  if (
    session.isPlatformStaff &&
    dest.roles.some((r) => r === "super_admin" || r === "support_admin")
  ) {
    return true;
  }
  return false;
}

function hrefFor(dest: AssistantDestination, session: AssistantSession): string {
  if (!session.signedIn) return dest.demoHref;
  if (!canAccess(dest, session)) return dest.demoHref;
  if (dest.id === "online-orders" && session.tenantSlug) {
    return withGuide(dest.href, dest.id);
  }
  return withGuide(dest.href, dest.id);
}

function openAction(dest: AssistantDestination, session: AssistantSession): AssistantAction {
  const allowed = session.signedIn && canAccess(dest, session);
  return {
    id: `open-${dest.id}`,
    label: allowed
      ? `Open ${dest.title}`
      : session.signedIn
        ? `View demo: ${dest.title}`
        : `Show me ${dest.title}`,
    href: hrefFor(dest, session),
    variant: "default",
  };
}

function accountAccessReply(): AssistantReply {
  return {
    text: "Owner, manager, staff, admin, or super admin?",
    chips: PERSONA_CHIPS.map((c) => ({ id: c.id, label: c.label, payload: c.payload })),
  };
}

function staffKindReply(): AssistantReply {
  return {
    text: "Cashier, warehouse, accounts, or delivery?",
    chips: STAFF_KIND_CHIPS.map((c) => ({ id: c.id, label: c.label, payload: c.payload })),
  };
}

function loginReply(pending: PendingLogin): AssistantReply {
  return {
    text: `Sign in as ${pending.roleLabel}. Email and password.`,
    showLogin: true,
  };
}

function detectPersona(text: string): GuestPersona | null {
  if (
    hasKeyword(text, "super admin") ||
    hasKeyword(text, "superadmin") ||
    hasKeyword(text, "platform admin")
  ) {
    return "super_admin";
  }
  if (hasKeyword(text, "মালিক") || hasKeyword(text, "úinéir") || hasKeyword(text, "dono")) {
    return "owner";
  }
  if (
    hasKeyword(text, "shop owner") ||
    hasKeyword(text, "owner") ||
    hasKeyword(text, "i am owner")
  ) {
    return "owner";
  }
  if (
    hasKeyword(text, "manager") ||
    hasKeyword(text, "ম্যানেজার") ||
    hasKeyword(text, "bainisteoir") ||
    hasKeyword(text, "gerente")
  ) {
    return "manager";
  }
  if (hasKeyword(text, "staff") || hasKeyword(text, "employee") || hasKeyword(text, "worker")) {
    return "staff";
  }
  if (hasKeyword(text, "admin") || hasKeyword(text, "support admin")) return "admin";
  return null;
}

function detectStaffKind(text: string): StaffKind | null {
  if (hasKeyword(text, "cashier") || hasKeyword(text, "till operator")) return "cashier";
  if (hasKeyword(text, "warehouse") || hasKeyword(text, "storeperson")) return "warehouse";
  if (hasKeyword(text, "accountant") || hasKeyword(text, "bookkeeper")) return "accountant";
  if (hasKeyword(text, "delivery") || hasKeyword(text, "driver")) return "delivery";
  return null;
}

function isAccountIntent(text: string): boolean {
  return ACCOUNT_PHRASES.some((p) => text.includes(p));
}

function isDemoIntent(text: string): boolean {
  return DEMO_PHRASES.some((p) => text.includes(p)) || text === "demo";
}

function paymentBranch(text: string): "pos" | "billing" | "both" | null {
  const mentionsPayment =
    hasKeyword(text, "payment") ||
    hasKeyword(text, "pay") ||
    hasKeyword(text, "paying") ||
    hasKeyword(text, "পেমেন্ট") ||
    hasKeyword(text, "pagamento") ||
    hasKeyword(text, "íocaíocht");
  const posHit =
    PAYMENT_POS.some((p) => text.includes(p)) ||
    hasKeyword(text, "pos") ||
    hasKeyword(text, "till") ||
    hasKeyword(text, "কাউন্টার") ||
    hasKeyword(text, "tillir") ||
    hasKeyword(text, "caixa");
  const billHit = PAYMENT_BILLING.some((p) => text.includes(p));
  if (!mentionsPayment && !posHit && !billHit) return null;
  if (posHit && billHit) return "both";
  if (billHit) return "billing";
  if (posHit) return "pos";
  if (mentionsPayment) return "both";
  return null;
}

function destReply(dest: AssistantDestination, session: AssistantSession): AssistantReply {
  const allowed = !session.signedIn || canAccess(dest, session);
  const text = session.signedIn
    ? allowed
      ? dest.answer
      : `${dest.forbiddenHint ?? "You do not have access to that screen."} You are signed in as ${roleLabel(session)}.`
    : dest.guestAnswer;

  const actions: AssistantAction[] = [];
  if (session.signedIn && allowed) {
    actions.push(openAction(dest, session));
  } else if (session.signedIn && !allowed) {
    actions.push({
      id: `demo-${dest.id}`,
      label: `View demo: ${dest.title}`,
      href: dest.demoHref,
      variant: "outline",
    });
  } else {
    actions.push(openAction(dest, session));
    actions.push({
      id: "signin-for-dest",
      label: "Sign in to open it",
      payload: "I want to access my account",
      variant: "outline",
    });
  }

  return {
    text,
    actions,
    lookupTopic: session.signedIn && allowed ? dest.lookupTopic : undefined,
  };
}

export function roleLabel(session: AssistantSession): string {
  if (session.isPlatformStaff && !session.role) return "platform admin";
  if (!session.role) return "a signed-in user";
  const labels: Record<ShopRole, string> = {
    owner: "Shop Owner",
    manager: "Manager",
    cashier: "Cashier",
    warehouse: "Warehouse",
    accountant: "Accountant",
    delivery: "Delivery",
    support_admin: "Admin",
    super_admin: "Super admin",
  };
  return labels[session.role];
}

function helpReply(session: AssistantSession): AssistantReply {
  if (!session.signedIn) {
    return {
      text: "I can show a demo, or sign you in. Ask for till, stock, or billing.",
      chips: GUEST_STARTER_CHIPS.map((c) => ({ id: c.id, label: c.label, payload: c.payload })),
    };
  }
  if (!session.role && session.isPlatformStaff) {
    return {
      text: `You are signed in as platform staff. I can open the control centre, all shops, or admin access.`,
      actions: [
        { id: "open-platform", label: "Open platform", href: withGuide("/platform", "platform") },
        {
          id: "open-tenants",
          label: "All shops",
          href: withGuide("/platform/tenants", "platform-tenants"),
          variant: "outline",
        },
      ],
    };
  }
  if (!session.role) {
    return {
      text: "You are signed in but have no shop yet. I will take you through onboarding to create one.",
      actions: [{ id: "open-onboarding", label: "Set up shop", href: "/onboarding" }],
    };
  }
  return {
    text: `You are signed in as ${roleLabel(session)}${session.tenantName ? ` at ${session.tenantName}` : ""}. Ask for any screen — POS, sales, stock, billing, tills — and I will answer and open it.`,
    actions: [
      { id: "open-dash", label: "Dashboard", href: withGuide("/dashboard", "dashboard") },
      { id: "open-pos", label: "POS", href: withGuide("/pos", "pos"), variant: "outline" },
    ],
  };
}

function demoReply(step: number): { reply: AssistantReply; demoStep: number } {
  const index = Math.min(Math.max(step, 0), DEMO_STEPS.length - 1);
  const current = DEMO_STEPS[index]!;
  const last = index >= DEMO_STEPS.length - 1;
  const actions: AssistantAction[] = [
    { id: "demo-open", label: current.title, href: current.href },
  ];
  if (!last) {
    actions.push({
      id: "demo-next",
      label: "Next",
      payload: "::demo-next",
      variant: "outline",
    });
  } else {
    actions.push({
      id: "demo-login",
      label: "Sign in",
      payload: "I want to access my account",
      variant: "outline",
    });
  }
  return {
    demoStep: index,
    reply: {
      text: `${current.title}: ${current.body}${last ? " That is the full tour — sign in when you want to use a live shop." : ""}`,
      actions,
    },
  };
}

function startLogin(persona: GuestPersona | StaffKind): AssistantTurn {
  const pending = loginForPersona(persona);
  return {
    replies: [loginReply(pending)],
    phase: "login",
    demoStep: 0,
    pendingLogin: pending,
  };
}

function handleCommand(text: string, input: AssistantTurnInput): AssistantTurn | null {
  if (text === "::demo" || text === "guest demo") {
    const { reply, demoStep } = demoReply(0);
    return { replies: [reply], phase: "demo", demoStep, pendingLogin: null };
  }
  if (text === "::demo-next") {
    const { reply, demoStep } = demoReply(input.demoStep + 1);
    return { replies: [reply], phase: "demo", demoStep, pendingLogin: null };
  }
  if (text.startsWith("::role:")) {
    const persona = text.slice("::role:".length) as GuestPersona;
    if (persona === "staff") {
      return {
        replies: [staffKindReply()],
        phase: "awaiting_staff_kind",
        demoStep: input.demoStep,
        pendingLogin: null,
      };
    }
    if (
      persona === "owner" ||
      persona === "manager" ||
      persona === "admin" ||
      persona === "super_admin"
    ) {
      return startLogin(persona);
    }
  }
  if (text.startsWith("::staff:")) {
    const kind = text.slice("::staff:".length) as StaffKind;
    if (
      kind === "cashier" ||
      kind === "warehouse" ||
      kind === "accountant" ||
      kind === "delivery"
    ) {
      return startLogin(kind);
    }
  }
  return null;
}

function paymentReplies(
  session: AssistantSession,
  branch: "pos" | "billing" | "both",
): AssistantReply[] {
  const pos = getDestination("pos")!;
  const billing = getDestination("billing")!;
  if (branch === "pos") return [destReply(pos, session)];
  if (branch === "billing") return [destReply(billing, session)];
  return [
    {
      text: "There are two payments. Customer money is the till. The ShopOS plan is billing.",
      actions: [
        { ...openAction(pos, session), label: "Customer payment (POS)", id: "pay-pos" },
        {
          ...openAction(billing, session),
          label: "ShopOS billing",
          id: "pay-billing",
          variant: "outline",
        },
      ],
      lookupTopic: session.signedIn ? "payments" : undefined,
    },
  ];
}

export function processAssistantTurn(input: AssistantTurnInput): AssistantTurn {
  const raw = input.text.trim();
  const text = normalizeText(raw.startsWith("::") ? raw : raw);
  const { session } = input;

  const command = handleCommand(raw.startsWith("::") ? raw : text, input);
  if (command) return command;

  if (session.signedIn && isAccountIntent(text)) {
    return {
      replies: [
        {
          text: `You are already signed in as ${session.displayName ?? session.email ?? "your account"} (${roleLabel(session)})${session.tenantName ? ` at ${session.tenantName}` : ""}.`,
        },
      ],
      phase: "idle",
      demoStep: input.demoStep,
      pendingLogin: null,
    };
  }

  const claimedRole =
    !session.signedIn &&
    (hasKeyword(text, "i am") || hasKeyword(text, "i m") || hasKeyword(text, "im"));
  if (claimedRole && input.phase === "idle") {
    const staff = detectStaffKind(text);
    if (staff) return startLogin(staff);
    const persona = detectPersona(text);
    if (persona === "staff") {
      return {
        replies: [staffKindReply()],
        phase: "awaiting_staff_kind",
        demoStep: input.demoStep,
        pendingLogin: null,
      };
    }
    if (persona) return startLogin(persona);
  }

  if (input.phase === "awaiting_role" || (isAccountIntent(text) && !session.signedIn)) {
    const staff = detectStaffKind(text);
    if (staff) return startLogin(staff);
    const persona = detectPersona(text);
    if (persona === "staff") {
      return {
        replies: [staffKindReply()],
        phase: "awaiting_staff_kind",
        demoStep: input.demoStep,
        pendingLogin: null,
      };
    }
    if (persona) return startLogin(persona);
    if (isAccountIntent(text) || input.phase === "awaiting_role") {
      return {
        replies: [accountAccessReply()],
        phase: "awaiting_role",
        demoStep: input.demoStep,
        pendingLogin: null,
      };
    }
  }

  if (input.phase === "awaiting_staff_kind") {
    const staff = detectStaffKind(text);
    if (staff) return startLogin(staff);
    return {
      replies: [staffKindReply()],
      phase: "awaiting_staff_kind",
      demoStep: input.demoStep,
      pendingLogin: null,
    };
  }

  if (isDemoIntent(text)) {
    const { reply, demoStep } = demoReply(0);
    return { replies: [reply], phase: "demo", demoStep, pendingLogin: null };
  }

  const pay = paymentBranch(text);
  if (pay) {
    return {
      replies: paymentReplies(session, pay),
      phase: "idle",
      demoStep: input.demoStep,
      pendingLogin: null,
    };
  }

  const ranked = rankDestinations(text);
  if (ranked.length === 0) {
    return {
      replies: [helpReply(session)],
      phase: "idle",
      demoStep: input.demoStep,
      pendingLogin: null,
    };
  }

  const top = ranked[0]!;
  const close = ranked.filter((row) => row.score >= top.score && row.dest.id !== top.dest.id);
  if (close.length > 0 && top.score <= 2) {
    const options = [top, ...close.slice(0, 2)];
    return {
      replies: [
        {
          text: "I can take you to one of these. Which do you need?",
          actions: options.map((row) => openAction(row.dest, session)),
        },
      ],
      phase: "idle",
      demoStep: input.demoStep,
      pendingLogin: null,
    };
  }

  return {
    replies: [destReply(top.dest, session)],
    phase: "idle",
    demoStep: input.demoStep,
    pendingLogin: null,
  };
}

export function welcomeReply(session: AssistantSession): AssistantReply {
  if (!session.signedIn) {
    return {
      text: "Hi — I can show a demo, or sign you in. Ask for a screen and I’ll open it.",
      chips: GUEST_STARTER_CHIPS.map((c) => ({ id: c.id, label: c.label, payload: c.payload })),
    };
  }
  const name = session.displayName ?? "there";
  return {
    text: `Hi ${name}. You are signed in as ${roleLabel(session)}${session.tenantName ? ` at ${session.tenantName}` : ""}. Ask about any part of ShopOS and I will answer and take you there.`,
    actions: helpReply(session).actions,
  };
}

export type { LookupTopic };
