import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Plus, 
  Search, 
  Wrench,
  MoreHorizontal,
  Phone,
  Mail,
  Star,
  Badge as BadgeIcon,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import TechnicianForm from '@/components/technicians/TechnicianForm';
import SendInviteButton from '@/components/invites/SendInviteButton';

const roleColors = {
  'Lead Technician': 'bg-purple-100 text-purple-700',
  'Technician': 'bg-blue-100 text-blue-700',
  'Assistant': 'bg-cyan-100 text-cyan-700',
  'Apprentice': 'bg-slate-100 text-slate-700'
};

const availabilityColors = {
  Available: 'bg-emerald-100 text-emerald-700',
  'On Job': 'bg-amber-100 text-amber-700',
  'Off Duty': 'bg-slate-100 text-slate-700',
  Vacation: 'bg-blue-100 text-blue-700',
  Sick: 'bg-red-100 text-red-700'
};

const skillColors = {
  Mechanics: 'bg-orange-50 text-orange-700 border-orange-200',
  Electronics: 'bg-blue-50 text-blue-700 border-blue-200',
  'GRP/Gelcoat': 'bg-purple-50 text-purple-700 border-purple-200',
  Rigging: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Plumbing: 'bg-teal-50 text-teal-700 border-teal-200',
  HVAC: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Sealing: 'bg-pink-50 text-pink-700 border-pink-200',
  Diagnostics: 'bg-amber-50 text-amber-700 border-amber-200',
  Installations: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'General Service': 'bg-slate-50 text-slate-700 border-slate-200'
};

export default function Technicians() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const techData = await base44.entities.Technician.list('last_name');
      setTechnicians(techData);
    } catch (error) {
      console.error('Error loading technicians:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (techData) => {
    try {
      if (editingTechnician) {
        await base44.entities.Technician.update(editingTechnician.id, techData);
      } else {
        await base44.entities.Technician.create(techData);
      }
      await loadData();
      setShowForm(false);
      setEditingTechnician(null);
    } catch (error) {
      console.error('Error saving technician:', error);
      alert('Failed to save technician: ' + error.message);
      throw error;
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this technician?')) {
      try {
        await base44.entities.Technician.delete(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting technician:', error);
      }
    }
  };

  const filteredTechnicians = technicians.filter(tech => {
    const searchLower = searchTerm.toLowerCase();
    const name = `${tech.first_name || ''} ${tech.last_name || ''}`.toLowerCase();
    return name.includes(searchLower) || tech.email?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Technicians</h1>
          <p className="text-slate-500 mt-1">{technicians.length} team members</p>
        </div>
        <Button 
          onClick={() => { setEditingTechnician(null); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Technician
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search technicians..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Technicians Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredTechnicians.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No technicians found</h3>
            <p className="text-slate-500 mt-1">Add your first team member</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTechnicians.map((tech) => (
            <Card key={tech.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <Avatar className="h-16 w-16 flex-shrink-0">
                      {tech.photo_url && <AvatarImage src={tech.photo_url} />}
                      <AvatarFallback 
                        className="text-white text-lg"
                        style={{ backgroundColor: tech.color || '#3b82f6' }}
                      >
                        {tech.first_name?.[0]}{tech.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>

                    {/* Technician Details */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: Name, Role, Availability, External Badge */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-semibold text-slate-900">
                          {tech.first_name} {tech.last_name}
                        </h3>
                        <Badge className={roleColors[tech.role]}>{tech.role}</Badge>
                        <Badge className={availabilityColors[tech.availability_status]}>
                          {tech.availability_status}
                        </Badge>
                        {tech.is_external && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            External
                          </Badge>
                        )}
                      </div>

                      {/* Row 2: Contact Info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 mb-2">
                        {tech.email && (
                          <a href={`mailto:${tech.email}`} className="flex items-center gap-1 hover:text-blue-600">
                            <Mail className="h-3 w-3" />
                            {tech.email}
                          </a>
                        )}
                        {tech.phone && (
                          <>
                            {tech.email && <span>•</span>}
                            <a href={`tel:${tech.phone}`} className="flex items-center gap-1 hover:text-blue-600">
                              <Phone className="h-3 w-3" />
                              {tech.phone}
                            </a>
                          </>
                        )}
                        {tech.home_base && (
                          <>
                            {(tech.email || tech.phone) && <span>•</span>}
                            <span>Base: {tech.home_base}</span>
                          </>
                        )}
                      </div>

                      {/* Row 3: Skills */}
                      {tech.skills && tech.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tech.skills.slice(0, 6).map((skill, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className={`text-xs ${skillColors[skill] || 'bg-slate-50 text-slate-700 border-slate-200'}`}
                            >
                              {skill}
                            </Badge>
                          ))}
                          {tech.skills.length > 6 && (
                            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-200">
                              +{tech.skills.length - 6} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <SendInviteButton
                      email={tech.email}
                      role="TECHNICIAN"
                      technicianId={tech.id}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingTechnician(tech); setShowForm(true); }}
                      className="h-7 w-7 p-0"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingTechnician(tech); setShowForm(true); }}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(tech.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Technician Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingTechnician(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTechnician ? 'Edit Technician' : 'Add Technician'}</DialogTitle>
          </DialogHeader>
          <TechnicianForm
            technician={editingTechnician}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingTechnician(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}