"use server";

import { revalidatePath } from "next/cache";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { addBranchSchema } from "@/lib/branches/schemas";
import { createClient } from "@/lib/supabase/server";

export const addBranchAction = staffActionClient(["owner", "manager"])
  .metadata({ actionName: "branches.add" })
  .inputSchema(addBranchSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("add_branch_for_tenant", {
      p_tenant_id: ctx.tenant.tenantId,
      p_code: parsedInput.code,
      p_name: parsedInput.name,
      p_address_line1: parsedInput.addressLine1 || undefined,
      p_city: parsedInput.city || undefined,
      p_county: parsedInput.county || undefined,
      p_eircode: parsedInput.eircode || undefined,
    });

    if (error) {
      if (error.code === "42501") throw new ActionError(error.message);
      throw new ActionError("Could not add branch.");
    }

    revalidatePath("/settings/branches");
    return { ok: true as const, branchId: data as string };
  });
