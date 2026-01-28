import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function TeamPreviewMode({ onUserSelect, currentUserId }) {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      const techsData = await base44.entities.Technician.list();
      setTechnicians(techsData.filter(t => t.status === 'Active'));
    } catch (error) {
      console.error('Error loading technicians:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTechs = technicians.filter(t =>
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="m-4 border-blue-300 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-blue-900">
            👁️ Admin Preview Mode
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUserSelect(null)}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-blue-700 mt-1">
          View tasks from a technician's perspective
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search technician..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Technician List */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filteredTechs.map(tech => (
            <button
              key={tech.id}
              onClick={() => onUserSelect(tech.id)}
              className={`w-full text-left p-2 rounded-lg border-2 transition-all text-xs ${
                currentUserId === tech.id
                  ? 'border-blue-600 bg-blue-100'
                  : 'border-blue-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="font-medium text-slate-900">
                {tech.first_name} {tech.last_name}
              </div>
              <div className="text-slate-500 text-[10px] mt-0.5">{tech.email}</div>
            </button>
          ))}
        </div>

        {filteredTechs.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-4">
            No technicians found
          </p>
        )}

        {/* Clear Button */}
        {currentUserId && (
          <Button
            onClick={() => onUserSelect(null)}
            variant="outline"
            size="sm"
            className="w-full text-xs"
          >
            Exit Preview Mode
          </Button>
        )}
      </CardContent>
    </Card>
  );
}