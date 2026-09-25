"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { evaluateLicenseLease, parseLicenseLease, type LicenseDecision } from "@/lib/license/lease";
import { getOrCreateDeviceId } from "@/lib/license/device";
import { heartbeatTill } from "@/lib/license/heartbeat-client";
import { clearPackedLicense, readPackedLicense, writePackedLicense } from "@/lib/license/store";
import { verifyLeaseSignature } from "@/lib/license/verify-client";

type LicenseState = {
  ready: boolean;
  deviceId: string;
  canSell: boolean;
  reason: string;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

const LicenseContext = createContext<LicenseState | null>(null);

async function decideStored(opts: {
  tenantId: string;
  deviceId: string;
  verifyKey: string;
}): Promise<LicenseDecision> {
  const packed = readPackedLicense(opts.tenantId);
  if (!packed) {
    return evaluateLicenseLease(null, { deviceId: opts.deviceId, tenantId: opts.tenantId });
  }
  const signatureOk = await verifyLeaseSignature(packed.lease, packed.signature, opts.verifyKey);
  if (!signatureOk) {
    return {
      allowed: false,
      reason: "This till license is not valid. Connect to ShopOS to renew it.",
    };
  }
  return evaluateLicenseLease(packed.lease, {
    deviceId: opts.deviceId,
    tenantId: opts.tenantId,
  });
}

export function LicenseHeartbeat({
  tenantId,
  verifyKey,
  children,
}: {
  tenantId: string;
  verifyKey: string;
  children: React.ReactNode;
}) {
  const [deviceId, setDeviceId] = useState("");
  const [ready, setReady] = useState(false);
  const [canSell, setCanSell] = useState(false);
  const [reason, setReason] = useState("Activating this till…");
  const [refreshing, setRefreshing] = useState(false);

  const applyDecision = useCallback((decision: LicenseDecision) => {
    setCanSell(decision.allowed);
    setReason(decision.reason);
  }, []);

  const refresh = useCallback(async () => {
    const id = getOrCreateDeviceId();
    if (!id || !tenantId) return;
    setDeviceId(id);
    setRefreshing(true);
    try {
      const online = typeof navigator === "undefined" || navigator.onLine;
      if (online) {
        const result = await heartbeatTill({ deviceId: id, label: "Till" });
        if (result.ok) {
          const lease = parseLicenseLease(result.lease);
          if (!lease) {
            applyDecision({
              allowed: false,
              reason: "This till license is not valid. Connect to ShopOS to renew it.",
            });
            return;
          }
          writePackedLicense(tenantId, { lease, signature: result.signature });
          if (result.verifyKey) {
            window.__SHOPOS_LICENSE_PUBKEY = result.verifyKey;
          }
          const decision = evaluateLicenseLease(lease, {
            deviceId: id,
            tenantId,
          });
          applyDecision(decision);
          return;
        }
        if (result.code === "revoked") {
          clearPackedLicense(tenantId);
          applyDecision({ allowed: false, reason: result.error });
          return;
        }
      }
      applyDecision(await decideStored({ tenantId, deviceId: id, verifyKey }));
    } catch {
      applyDecision(await decideStored({ tenantId, deviceId: id, verifyKey }));
    } finally {
      setRefreshing(false);
      setReady(true);
    }
  }, [applyDecision, tenantId, verifyKey]);

  useEffect(() => {
    if (verifyKey) window.__SHOPOS_LICENSE_PUBKEY = verifyKey;
  }, [verifyKey]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    const onOnline = () => {
      void refresh();
    };
    window.addEventListener("online", onOnline);
    const interval = window.setInterval(
      () => {
        if (typeof navigator === "undefined" || navigator.onLine) void refresh();
      },
      15 * 60 * 1000,
    );
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const value = useMemo<LicenseState>(
    () => ({
      ready,
      deviceId,
      canSell,
      reason,
      refreshing,
      refresh,
    }),
    [ready, deviceId, canSell, reason, refreshing, refresh],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useTillLicense(): LicenseState {
  const ctx = useContext(LicenseContext);
  if (ctx) return ctx;
  return {
    ready: true,
    deviceId: "",
    canSell: false,
    reason: "This till is not activated. Connect to the internet and sign in once.",
    refreshing: false,
    refresh: async () => {},
  };
}
