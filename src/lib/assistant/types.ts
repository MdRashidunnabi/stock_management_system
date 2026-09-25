export type ShopRole =
  | "owner"
  | "manager"
  | "cashier"
  | "warehouse"
  | "accountant"
  | "delivery"
  | "support_admin"
  | "super_admin";

export type GuestPersona = "owner" | "manager" | "staff" | "admin" | "super_admin";

export type StaffKind = "cashier" | "warehouse" | "accountant" | "delivery";

export type AssistantPhase = "idle" | "awaiting_role" | "awaiting_staff_kind" | "login" | "demo";

export type LookupTopic =
  | "sales"
  | "billing"
  | "stock"
  | "tills"
  | "purchasing"
  | "online"
  | "team"
  | "payments";

export type AssistantSession = {
  signedIn: boolean;
  email: string | null;
  displayName: string | null;
  role: ShopRole | null;
  tenantName: string | null;
  tenantSlug: string | null;
  isPlatformStaff: boolean;
};

export type AssistantChip = {
  id: string;
  label: string;
  payload: string;
};

export type AssistantAction = {
  id: string;
  label: string;
  href?: string;
  payload?: string;
  variant?: "default" | "outline" | "secondary";
};

export type PendingLogin = {
  roleLabel: string;
  next: string;
  persona: GuestPersona | StaffKind;
};

export type AssistantDestination = {
  id: string;
  title: string;
  href: string;
  demoHref: string;
  keywords: string[];
  answer: string;
  guestAnswer: string;
  roles?: ShopRole[];
  public?: boolean;
  platformOnly?: boolean;
  lookupTopic?: LookupTopic;
  forbiddenHint?: string;
};

export type AssistantReply = {
  text: string;
  chips?: AssistantChip[];
  actions?: AssistantAction[];
  showLogin?: boolean;
  lookupTopic?: LookupTopic;
  facts?: string[];
};

export type AssistantTurnInput = {
  text: string;
  session: AssistantSession;
  phase: AssistantPhase;
  demoStep: number;
  pendingLogin: PendingLogin | null;
};

export type AssistantTurn = {
  replies: AssistantReply[];
  phase: AssistantPhase;
  demoStep: number;
  pendingLogin: PendingLogin | null;
};
