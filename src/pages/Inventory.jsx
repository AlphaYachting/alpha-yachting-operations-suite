import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Plus, 
  Search, 
  Package,
  MoreHorizontal,
  AlertTriangle,
  Truck,
  Archive
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import InventoryForm from '@/components/inventory/InventoryForm';

const categoryColors = {
  'Engine Parts': 'bg-orange-100 text-orange-700',
  'Electrical': 'bg-blue-100 text-blue-700',
  'Electronics': 'bg-purple-100 text-purple-700',
  'Plumbing': 'bg-teal-100 text-teal-700',
  'Rigging': 'bg-cyan-100 text-cyan-700',
  'Deck Hardware': 'bg-amber-100 text-amber-700',
  'Safety Equipment': 'bg-red-100 text-red-700',
  'Consumables': 'bg-slate-100 text-slate-700',
  'Sealants/Adhesives': 'bg-pink-100 text-pink-700',
  'Filters': 'bg-green-100 text-green-700',
  'Belts/Hoses': 'bg-indigo-100 text-indigo-700',
  'Fasteners': 'bg-lime-100 text-lime-700',
  'Paint/Gelcoat': 'bg-violet-100 text-violet-700',
  'HVAC': 'bg-sky-100 text-sky-700',
  'Tools': 'bg-rose-100 text-rose-700',
  'Other': 'bg-gray-100 text-gray-700'
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const itemsData = await base44.entities.InventoryItem.list('name');
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (itemData) => {
    try {
      if (editingItem) {
        await base44.entities.InventoryItem.update(editingItem.id, itemData);
      } else {
        await base44.entities.InventoryItem.create(itemData);
      }
      await loadData();
      setShowForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await base44.entities.InventoryItem.delete(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const getTotalStock = (item) => {
    return (item.stock_novigrad || 0) + (item.stock_van_1 || 0) + (item.stock_van_2 || 0);
  };

  const isLowStock = (item) => {
    const total = getTotalStock(item);
    return total <= (item.min_stock_level || 1);
  };

  const filteredItems = items.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = item.name?.toLowerCase().includes(searchLower) ||
      item.sku?.toLowerCase().includes(searchLower) ||
      item.manufacturer?.toLowerCase().includes(searchLower);
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = items.filter(isLowStock);
  const categories = [...new Set(items.map(i => i.category))].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 mt-1">{items.length} items in stock</p>
        </div>
        <Button 
          onClick={() => { setEditingItem(null); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Low Stock Alert</p>
                <p className="text-sm text-amber-700">
                  {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need reordering
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No items found</h3>
            <p className="text-slate-500 mt-1">Add your first inventory item</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Base</TableHead>
                <TableHead className="text-center">Van 1</TableHead>
                <TableHead className="text-center">Van 2</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const totalStock = getTotalStock(item);
                const lowStock = isLowStock(item);
                
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          {item.sku && `SKU: ${item.sku}`}
                          {item.manufacturer && ` • ${item.manufacturer}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={categoryColors[item.category] || 'bg-slate-100'}>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={lowStock && item.stock_novigrad <= 0 ? 'text-red-600 font-medium' : ''}>
                        {item.stock_novigrad || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{item.stock_van_1 || 0}</TableCell>
                    <TableCell className="text-center">{item.stock_van_2 || 0}</TableCell>
                    <TableCell className="text-right">
                      €{(item.sales_price || item.unit_cost || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        {lowStock && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingItem(item); setShowForm(true); }}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(item.id)}
                              className="text-red-600"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Inventory Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
          </DialogHeader>
          <InventoryForm
            item={editingItem}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingItem(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}