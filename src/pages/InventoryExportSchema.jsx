import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Copy, CheckCircle2 } from 'lucide-react';

export default function InventoryExportSchema() {
  const [copied, setCopied] = React.useState(false);

  const inventorySchema = {
    entity_name: "InventoryItem",
    description: "Tools and inventory management system",
    fields: {
      // REQUIRED FIELDS
      name: { type: "string", required: true, description: "Item name" },

      // BASIC INFO
      item_type: { type: "string", enum: ["TOOL", "VEHICLE"], default: "TOOL", description: "Type of item" },
      sku: { type: "string", description: "Internal SKU/part number" },
      description: { type: "string", description: "Item description" },
      category: {
        type: "string",
        enum: ["Engine Parts", "Electrical", "Electronics", "Plumbing", "Rigging", "Deck Hardware", "Safety Equipment", "Consumables", "Sealants/Adhesives", "Filters", "Belts/Hoses", "Fasteners", "Paint/Gelcoat", "HVAC", "Tools", "Van", "Car", "Truck", "Trailer", "Other"],
        default: "Other"
      },
      quantity_mode: { type: "string", enum: ["unique", "pooled"], default: "pooled", description: "unique = single asset, pooled = multiple units" },

      // SUPPLIER INFO
      manufacturer: { type: "string", description: "Manufacturer name" },
      manufacturer_part_number: { type: "string", description: "Manufacturer part number" },
      supplier: { type: "string", description: "Supplier name" },
      supplier_part_number: { type: "string", description: "Supplier part number" },

      // PRICING
      unit: { type: "string", enum: ["Piece", "Meter", "Liter", "Kg", "Set", "Box", "Roll"], default: "Piece" },
      unit_cost: { type: "number", description: "Cost per unit in EUR" },
      markup_percent: { type: "number", default: 30, description: "Markup percentage" },
      sales_price: { type: "number", description: "Sales price in EUR" },

      // STOCK (for TOOL items)
      stock_novigrad: { type: "number", default: 0, description: "Stock at Novigrad base" },
      stock_van_1: { type: "number", default: 0, description: "Stock in Van 1" },
      stock_van_2: { type: "number", default: 0, description: "Stock in Van 2" },
      stock_reserved: { type: "number", default: 0, description: "Reserved stock" },
      min_stock_level: { type: "number", default: 1, description: "Low stock threshold" },
      reorder_quantity: { type: "number", description: "Reorder quantity" },
      lead_time_days: { type: "number", description: "Supplier lead time in days" },

      // TRACKING
      serial_number_required: { type: "boolean", default: false, description: "Track by serial number" },
      location_in_warehouse: { type: "string", description: "Shelf/bin location" },
      location_base: { type: "string", description: "Primary location for unique assets" },
      photo_url: { type: "string", description: "Photo URL" },
      notes: { type: "string", description: "Additional notes" },
      status: { type: "string", enum: ["Active", "Maintenance", "Discontinued", "Out of Stock", "Retired"], default: "Active" },

      // VEHICLE SPECIFIC (only for item_type = "VEHICLE")
      license_plate: { type: "string", description: "Vehicle license plate" },
      vin: { type: "string", description: "Vehicle identification number" },
      make: { type: "string", description: "Vehicle make/brand" },
      model: { type: "string", description: "Vehicle model" },
      year: { type: "number", description: "Vehicle year" },
      vehicle_type: { type: "string", enum: ["Van", "Car", "Truck", "Trailer", "Other"] },
      fuel_type: { type: "string", enum: ["Diesel", "Petrol", "Electric", "Hybrid"] },
      capacity_notes: { type: "string", description: "Load/passenger capacity notes" },
      insurance_expiry: { type: "string", format: "date", description: "Insurance expiration (YYYY-MM-DD)" },
      maintenance_due_date: { type: "string", format: "date", description: "Next maintenance date (YYYY-MM-DD)" }
    }
  };

  const exampleCSV = `name,item_type,category,sku,manufacturer,manufacturer_part_number,supplier,unit,unit_cost,markup_percent,sales_price,stock_novigrad,stock_van_1,stock_van_2,min_stock_level,status
Oil Filter Volvo D2-55,TOOL,Filters,VOL-D2-55-OIL,Volvo Penta,3888460,Marine Parts Co,Piece,12.50,30,16.25,10,2,2,5,Active
Spark Plug NGK BPR6ES,TOOL,Engine Parts,NGK-BPR6ES,NGK,BPR6ES,Parts Supplier,Piece,3.20,35,4.32,50,10,10,20,Active
Antifouling Paint Red 5L,TOOL,Paint/Gelcoat,PAINT-AF-RED-5L,International,AF-RED-5L,Paint Shop,Liter,45.00,25,56.25,8,0,0,3,Active
Diesel Engine Oil 10W40,TOOL,Consumables,OIL-10W40-5L,Castrol,10W40-5L,Oil Distributor,Liter,8.50,30,11.05,20,5,5,10,Active`;

  const exampleJSON = [
    {
      name: "Oil Filter Volvo D2-55",
      item_type: "TOOL",
      category: "Filters",
      sku: "VOL-D2-55-OIL",
      manufacturer: "Volvo Penta",
      manufacturer_part_number: "3888460",
      supplier: "Marine Parts Co",
      unit: "Piece",
      unit_cost: 12.50,
      markup_percent: 30,
      sales_price: 16.25,
      stock_novigrad: 10,
      stock_van_1: 2,
      stock_van_2: 2,
      min_stock_level: 5,
      status: "Active"
    },
    {
      name: "Work Van Alpha 1",
      item_type: "VEHICLE",
      category: "Van",
      license_plate: "ZG-1234-AB",
      make: "Mercedes",
      model: "Sprinter",
      year: 2020,
      vehicle_type: "Van",
      fuel_type: "Diesel",
      status: "Active"
    }
  ];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadCSV = (text, filename) => {
    const blob = new Blob([text], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory & Tools Export Schema</h1>
        <p className="text-slate-500 mt-1">Reference structure for importing inventory data</p>
      </div>

      {/* Schema Structure */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Entity Schema</CardTitle>
            <Button
              onClick={() => copyToClipboard(JSON.stringify(inventorySchema, null, 2))}
              size="sm"
              variant="outline"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Schema'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-50 rounded-lg p-4 overflow-x-auto text-xs">
            {JSON.stringify(inventorySchema, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* CSV Example */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>CSV Import Template</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => copyToClipboard(exampleCSV)}
                size="sm"
                variant="outline"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy CSV
              </Button>
              <Button
                onClick={() => downloadCSV(exampleCSV, 'inventory_import_template.csv')}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-50 rounded-lg p-4 overflow-x-auto text-xs font-mono">
            {exampleCSV}
          </pre>
        </CardContent>
      </Card>

      {/* JSON Example */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>JSON Import Examples</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => copyToClipboard(JSON.stringify(exampleJSON, null, 2))}
                size="sm"
                variant="outline"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy JSON
              </Button>
              <Button
                onClick={() => downloadJSON(exampleJSON, 'inventory_import_examples.json')}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-50 rounded-lg p-4 overflow-x-auto text-xs">
            {JSON.stringify(exampleJSON, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Field Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Field Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-slate-900 mb-2">Required Fields</h3>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li><code className="bg-slate-100 px-1 rounded">name</code> - Item name (required)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-slate-900 mb-2">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {inventorySchema.fields.category.enum.map(cat => (
                  <span key={cat} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-slate-900 mb-2">Units</h3>
              <div className="flex flex-wrap gap-2">
                {inventorySchema.fields.unit.enum.map(unit => (
                  <span key={unit} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                    {unit}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-slate-900 mb-2">Stock Locations</h3>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li><code className="bg-slate-100 px-1 rounded">stock_novigrad</code> - Main warehouse</li>
                <li><code className="bg-slate-100 px-1 rounded">stock_van_1</code> - Van 1 inventory</li>
                <li><code className="bg-slate-100 px-1 rounded">stock_van_2</code> - Van 2 inventory</li>
                <li><code className="bg-slate-100 px-1 rounded">stock_reserved</code> - Reserved for jobs</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-slate-900 mb-2">Notes</h3>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li>All prices in EUR</li>
                <li>Dates in YYYY-MM-DD format</li>
                <li>Stock values default to 0 if not provided</li>
                <li>Vehicle-specific fields only apply when item_type = "VEHICLE"</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}