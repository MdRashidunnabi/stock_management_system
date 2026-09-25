export type PosDeviceRow = {
  id: string;
  tenant_id: string;
  device_id: string;
  label: string | null;
  user_agent: string | null;
  last_heartbeat_at: string;
  revoked_at: string | null;
  created_at: string;
  branch_id: string | null;
  till_number: number | null;
};
