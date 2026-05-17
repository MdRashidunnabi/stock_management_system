import { CategoryManager } from "@/components/catalog/category-manager";
import { listCategories } from "@/lib/catalog/categories/actions";
import { requireTenant } from "@/lib/auth/tenant";

export const metadata = {
  title: "Categories - ShopOS",
};

export default async function CategoriesPage() {
  const tenant = await requireTenant();
  const categories = await listCategories();
  const canWrite = ["owner", "manager"].includes(tenant.role);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-muted-foreground text-sm">
          Group products for navigation, reporting, and the online shop.
        </p>
      </header>

      <CategoryManager categories={categories} canWrite={canWrite} />
    </div>
  );
}
