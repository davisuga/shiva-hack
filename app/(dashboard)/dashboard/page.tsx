import { getReceipts, getReceiptStats } from "@/lib/actions/receipts";
import { getProductGroups, getCategoryStats } from "@/lib/actions/items";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Receipt, TrendingUp, ShoppingCart, DollarSign, BarChart3 } from "lucide-react";

export default async function DashboardPage() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [statsResult, recentReceipts, topProducts, categoryStats] = await Promise.all([
    getReceiptStats({ startDate: firstDayOfMonth }),
    getReceipts({ limit: 5 }),
    getProductGroups({ limit: 5, startDate: firstDayOfMonth }),
    getCategoryStats({ startDate: firstDayOfMonth }),
  ]);

  const stats = statsResult.stats;
  const receipts = recentReceipts.receipts;
  const products = topProducts.groups;
  const categories = categoryStats.categories;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Track your spending and discover savings opportunities
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.totalSpent.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receipts</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.receiptCount}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">Active categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Product</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products[0]?.normalizedName || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {products[0] ? `R$ ${products[0].totalSpent.toFixed(2)}` : "No data"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Receipts</CardTitle>
            <CardDescription>Your latest uploaded receipts</CardDescription>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No receipts yet</p>
                <p className="text-sm">Upload your first receipt to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(receipt.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {receipt.items.length} items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {receipt.currency} {receipt.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Most purchased items this month</CardDescription>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No products yet</p>
                <p className="text-sm">Start uploading receipts to see insights</p>
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product, index) => (
                  <div
                    key={`${product.normalizedName}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{product.normalizedName}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.category} • {product.purchaseCount} purchases
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        R$ {product.totalSpent.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg: R$ {product.averageUnitPrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
          <CardDescription>Where your money goes</CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No category data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category, index) => {
                const percentage = ((category.totalSpent / stats.totalSpent) * 100).toFixed(1);
                return (
                  <div key={`${category.category}-${index}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{category.category}</span>
                      <span className="text-sm text-muted-foreground">
                        R$ {category.totalSpent.toFixed(2)} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
