import { CategoryManager } from "@/components/catalog/category-manager";
import { listCategories } from "@/lib/catalog/categories/actions";
import { requireRole } from "@/lib/auth/tenant";

export const metadata = {
  title: "Categories - ShopOS",
};

export default async function CategoriesPage() {
  const tenant = await requireRole(["owner", "manager", "warehouse"]);
  const categories = await listCategories();
  const canWrite = ["owner", "manager"].includes(tenant.role);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight" data-guide="categories">
          Categories
        </h1>
      </header>

      <CategoryManager categories={categories} canWrite={canWrite} />
    </div>
  );
}
