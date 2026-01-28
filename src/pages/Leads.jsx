import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Mail, Anchor, MapPin, Plus, Edit, Trash2, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LeadForm from '@/components/leads/LeadForm';
import LeadConversionDialog from '@/components/leads/LeadConversionDialog';
import LeadTaskList from '@/components/leads/LeadTaskList';
import LeadStatusChange from '@/components/leads/LeadStatusChange';

const statusColors = {
  'Pending': 'bg-amber-100 text-amber-700',
  'Contacted': 'bg-blue-100 text-blue-700',
  'Converted': 'bg-emerald-100 text-emerald-700',
  'Rejected': 'bg-red-100 text-red-700',
  'Lost': 'bg-slate-100 text-slate-700'
};

const priorityColors = {
  'Low': 'bg-slate-100 text-slate-700',
  'Medium': 'bg-blue-100 text-blue-700',
  'High': 'bg-amber-100 text-amber-700',
  'Urgent': 'bg-red-100 text-red-700'
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [convertingLead, setConvertingLead] = useState(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [selectedLeadDetail, setSelectedLeadDetail] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [allLeads, allLocations] = await Promise.all([
        base44.entities.Lead.list('-created_date'),
        base44.entities.Location.list()
      ]);
      setLeads(allLeads);
      setLocations(allLocations);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLead = async (formData) => {
    try {
      if (editingLead) {
        await base44.entities.Lead.update(editingLead.id, formData);
      } else {
        await base44.entities.Lead.create(formData);
      }
      await loadData();
      setShowForm(false);
      setEditingLead(null);
    } catch (error) {
      console.error('Error saving lead:', error);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (window.confirm('Delete this lead?')) {
      try {
        await base44.entities.Lead.delete(leadId);
        setLeads(leads.filter(l => l.id !== leadId));
      } catch (error) {
        console.error('Error deleting lead:', error);
      }
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.boat_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
        <Button onClick={() => {
          setEditingLead(null);
          setShowForm(true);
        }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          New Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['Pending', 'Contacted', 'Converted', 'Lost'].map(status => {
          const count = leads.filter(l => l.status === status).length;
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-1">{status}</p>
                <p className="text-2xl font-bold text-slate-900">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Search by name, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Contacted">Contacted</SelectItem>
                <SelectItem value="Converted">Converted</SelectItem>
                <SelectItem value="Lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads List */}
      <div className="space-y-3">
        {filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-slate-500">No leads found</p>
            </CardContent>
          </Card>
        ) : (
          filteredLeads.map(lead => (
            <Card key={lead.id} className="hover:border-slate-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{lead.name}</h3>
                      <Badge className={statusColors[lead.status]}>
                        {lead.status}
                      </Badge>
                      <Badge className={priorityColors[lead.priority]}>
                        {lead.priority}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600 mb-3">
                      {lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-400" />
                          {lead.phone}
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-slate-400" />
                          {lead.email}
                        </div>
                      )}
                      {lead.boat_name && (
                        <div className="flex items-center gap-2">
                          <Anchor className="h-4 w-4 text-slate-400" />
                          {lead.boat_name}
                        </div>
                      )}
                      {lead.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          {lead.location}
                        </div>
                      )}
                    </div>

                    {lead.notes && (
                      <div className="bg-slate-50 p-2 rounded text-sm text-slate-700 mb-2">
                        {lead.notes}
                      </div>
                    )}

                    <div className="flex gap-2 text-xs text-slate-500">
                      <span>Created: {format(parseISO(lead.created_date), 'MMM d, yyyy')}</span>
                      {lead.converted_at && (
                        <span>Converted: {format(parseISO(lead.converted_at), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedLeadDetail(lead)}
                    >
                      Tasks & Notes
                    </Button>
                    {lead.status === 'Pending' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setConvertingLead(lead);
                          setShowConvertDialog(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Convert
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingLead(lead);
                        setShowForm(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteLead(lead.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Lead Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'New Lead'}</DialogTitle>
          </DialogHeader>
          <LeadForm
            lead={editingLead}
            locations={locations}
            onSave={handleSaveLead}
            onCancel={() => {
              setShowForm(false);
              setEditingLead(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog (with tasks) */}
      <Dialog open={!!selectedLeadDetail} onOpenChange={(open) => !open && setSelectedLeadDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedLeadDetail?.name}</DialogTitle>
          </DialogHeader>
          {selectedLeadDetail && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-medium">{selectedLeadDetail.phone}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium">{selectedLeadDetail.email || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Boat</p>
                  <p className="font-medium">{selectedLeadDetail.boat_name || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium">{selectedLeadDetail.location || '-'}</p>
                </div>
              </div>

              {selectedLeadDetail.description && (
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600 mb-2 font-medium">Description/Inquiry</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedLeadDetail.description}</p>
                </div>
              )}

              <LeadTaskList
                leadId={selectedLeadDetail.id}
                leadDescription={selectedLeadDetail.description}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conversion Dialog */}
      {convertingLead && (
        <LeadConversionDialog
          lead={convertingLead}
          open={showConvertDialog}
          onOpenChange={setShowConvertDialog}
          onSuccess={async () => {
            await loadData();
            setConvertingLead(null);
          }}
        />
      )}
    </div>
  );
}