import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Plus, 
  Search, 
  ClipboardList,
  Filter,
  MoreHorizontal,
  Edit,
  Copy,
  Archive,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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
import { format } from 'date-fns';

export default function TaskTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [templateItems, setTemplateItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadCurrentUser();
    loadTemplates();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const [templatesData, itemsData] = await Promise.all([
        base44.entities.TaskTemplateList.list('-updated_date'),
        base44.entities.TaskTemplateItem.list()
      ]);
      setTemplates(templatesData);
      setTemplateItems(itemsData);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const getItemCount = (templateId) => {
    return templateItems.filter(item => item.template_list_id === templateId).length;
  };

  const handleDuplicate = async (template) => {
    try {
      const items = templateItems.filter(item => item.template_list_id === template.id);
      
      const newTemplate = await base44.entities.TaskTemplateList.create({
        name: `${template.name} (Copy)`,
        description: template.description,
        category: template.category,
        is_active: template.is_active,
        default_priority: template.default_priority,
        tags: template.tags
      });

      for (const item of items) {
        await base44.entities.TaskTemplateItem.create({
          template_list_id: newTemplate.id,
          sort_order: item.sort_order,
          title: item.title,
          description: item.description,
          default_estimated_hours: item.default_estimated_hours,
          default_role: item.default_role,
          default_required_vehicle: item.default_required_vehicle,
          required_tools_note: item.required_tools_note,
          is_optional: item.is_optional,
          requires_customer_approval: item.requires_customer_approval
        });
      }

      await loadTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
    }
  };

  const handleArchive = async (templateId) => {
    try {
      const template = templates.find(t => t.id === templateId);
      await base44.entities.TaskTemplateList.update(templateId, {
        is_active: !template.is_active
      });
      await loadTemplates();
    } catch (error) {
      console.error('Error archiving template:', error);
    }
  };

  const handleDelete = async (templateId) => {
    if (window.confirm('Delete this template and all its items? This cannot be undone.')) {
      try {
        const items = templateItems.filter(item => item.template_list_id === templateId);
        await Promise.all(items.map(item => base44.entities.TaskTemplateItem.delete(item.id)));
        await base44.entities.TaskTemplateList.delete(templateId);
        await loadTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin && currentUser) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">Access Denied</h3>
        <p className="text-slate-500 mt-1">Only administrators can manage task templates</p>
      </div>
    );
  }

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && template.is_active) ||
      (statusFilter === 'inactive' && !template.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Templates</h1>
          <p className="text-slate-500 mt-1">Reusable task lists for recurring work orders</p>
        </div>
        <Button 
          onClick={() => navigate(createPageUrl('TemplateDetail'))}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Engine">Engine</SelectItem>
            <SelectItem value="Electrical">Electrical</SelectItem>
            <SelectItem value="Hull">Hull</SelectItem>
            <SelectItem value="Commissioning">Commissioning</SelectItem>
            <SelectItem value="Winterization">Winterization</SelectItem>
            <SelectItem value="Electronics">Electronics</SelectItem>
            <SelectItem value="Plumbing">Plumbing</SelectItem>
            <SelectItem value="Rigging">Rigging</SelectItem>
            <SelectItem value="General Service">General Service</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No templates found</h3>
            <p className="text-slate-500 mt-1">Create your first template to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => {
            const itemCount = getItemCount(template.id);
            return (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">{template.name}</h3>
                        {template.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600">
                            <Archive className="h-3 w-3 mr-1" />
                            Archived
                          </Badge>
                        )}
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                      
                      {template.description && (
                        <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                        <span>{itemCount} task{itemCount !== 1 ? 's' : ''}</span>
                        <span>Updated {format(new Date(template.updated_date), 'MMM d, yyyy')}</span>
                        {template.default_priority && (
                          <Badge variant="outline" className="text-xs">
                            Priority: {template.default_priority}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`${createPageUrl('TemplateDetail')}?id=${template.id}`)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleArchive(template.id)}>
                            <Archive className="h-4 w-4 mr-2" />
                            {template.is_active ? 'Archive' : 'Restore'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(template.id)}
                            className="text-red-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}


    </div>
  );
}