import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, TrendingUp, DollarSign, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const categoryColors = {
  'Engine Parts': '#f97316',
  'Electrical': '#3b82f6',
  'Electronics': '#a855f7',
  'Plumbing': '#14b8a6',
  'Rigging': '#06b6d4',
  'Deck Hardware': '#f59e0b',
  'Safety Equipment': '#ef4444',
  'Consumables': '#64748b',
  'Sealants/Adhesives': '#ec4899',
  'Filters': '#22c55e',
  'Belts/Hoses': '#6366f1',
  'Fasteners': '#84cc16',
  'Paint/Gelcoat': '#8b5cf6',
  'HVAC': '#0ea5e9',
  'Tools': '#f43f5e',
  'Workshop Supplies': '#10b981',
  'Other': '#6b7280'
};

export default function InventoryDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const itemsData = await base44.entities.InventoryItem.list('name');
      const filteredItems = itemsData.filter(item => item.item_type !== 'VEHICLE');
      setItems(filteredItems);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalStock = (item) => {
    return (item.stock_novigrad || 0) + (item.stock_van_1 || 0) + (item.stock_van_2 || 0);
  };

  const calculateStats = () => {
    const categoryStats = {};
    let totalItems = 0;
    let totalValue = 0;
    let totalStock = 0;
    let lowStockCount = 0;

    items.forEach(item => {
      const category = item.category || 'Other';
      const stock = getTotalStock(item);
      const value = (item.unit_cost || item.sales_price || 0) * stock;

      if (!categoryStats[category]) {
        categoryStats[category] = {
          category,
          items: 0,
          stock: 0,
          value: 0,
          color: categoryColors[category] || '#6b7280'
        };
      }

      categoryStats[category].items += 1;
      categoryStats[category].stock += stock;
      categoryStats[category].value += value;

      totalItems += 1;
      totalStock += stock;
      totalValue += value;

      if (item.item_type === 'TOOL' && stock <= (item.min_stock_level || 1)) {
        lowStockCount += 1;
      }
    });

    return {
      categoryStats: Object.values(categoryStats).sort((a, b) => b.value - a.value),
      totalItems,
      totalStock,
      totalValue,
      lowStockCount
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Statistics</h1>
          <p className="text-slate-500 mt-1">Overview and breakdown by category</p>
        </div>
        <Link to={createPageUrl('Inventory')}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
            <p className="text-xs text-slate-500 mt-1">
              {stats.categoryStats.length} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStock.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">
              Units across all locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-slate-500 mt-1">
              Current inventory value
            </p>
          </CardContent>
        </Card>

        <Card className={stats.lowStockCount > 0 ? 'border-amber-200 bg-amber-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.lowStockCount > 0 ? 'text-amber-800' : ''}`}>
              {stats.lowStockCount}
            </div>
            <p className={`text-xs mt-1 ${stats.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
              Items need reordering
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Value by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Value by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.categoryStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="category" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value) => `€${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                  {stats.categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stock Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.categoryStats}
                  dataKey="stock"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.category}: ${entry.stock}`}
                  labelLine={false}
                >
                  {stats.categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-slate-900">Category</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-900">Items</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-900">Total Stock</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-900">Total Value</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-900">Avg Value/Item</th>
                </tr>
              </thead>
              <tbody>
                {stats.categoryStats.map((cat, index) => (
                  <tr key={index} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium">{cat.category}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4">{cat.items}</td>
                    <td className="text-right py-3 px-4">{cat.stock.toLocaleString()}</td>
                    <td className="text-right py-3 px-4">
                      €{cat.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-3 px-4">
                      €{(cat.value / cat.items).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-slate-50">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-right py-3 px-4">{stats.totalItems}</td>
                  <td className="text-right py-3 px-4">{stats.totalStock.toLocaleString()}</td>
                  <td className="text-right py-3 px-4">
                    €{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-right py-3 px-4">
                    €{(stats.totalValue / stats.totalItems).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}