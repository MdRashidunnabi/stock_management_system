import { BrandManager } from "@/components/catalog/brand-manager";
import { listBrands } from "@/lib/catalog/brands/actions";
import { requireRole } from "@/lib/auth/tenant";

export const metadata = {
  title: "Brands - ShopOS",
};

export default async function BrandsPage() {
  const tenant = await requireRole(["owner", "manager", "warehouse"]);
  const brands = await listBrands();
  const canWrite = ["owner", "manager"].includes(tenant.role);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight" data-guide="brands">
          Brands
        </h1>
      </header>

      <BrandManager brands={brands} canWrite={canWrite} />
    </div>
  );
}
