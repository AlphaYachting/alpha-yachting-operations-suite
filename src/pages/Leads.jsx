import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
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
  SelectValue } from
'@/components/ui/select';
import { Phone, Mail, Anchor, MapPin, Plus, Edit, Trash2, CheckCircle2, Eye, Clock, XCircle } from 'lucide-react';
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

const inquiryTypeColors = {
  'Service Inquiry': 'bg-blue-100 text-blue-700 border-blue-200',
  'Parts Request': 'bg-purple-100 text-purple-700 border-purple-200',
  'Maintenance': 'bg-teal-100 text-teal-700 border-teal-200',
  'Emergency': 'bg-red-100 text-red-700 border-red-200',
  'Other': 'bg-slate-100 text-slate-700 border-slate-200'
};

const statusIconMap = {
  'Pending': { icon: Clock, bg: 'bg-amber-100', color: 'text-amber-600' },
  'Contacted': { icon: Phone, bg: 'bg-blue-100', color: 'text-blue-600' },
  'Converted': { icon: CheckCircle2, bg: 'bg-emerald-100', color: 'text-emerald-600' },
  'Lost': { icon: XCircle, bg: 'bg-slate-100', color: 'text-slate-500' }
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Apply filter from dashboard
  useEffect(() => {
    const filterParam = new URLSearchParams(window.location.search).get('filter');
    if (filterParam === 'open') {
      setStatusFilter('Open');
    }
  }, []);
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
      const [allLeads, allLocations, allCustomers, allBoats] = await Promise.all([
      base44.entities.Lead.list('-created_date'),
      base44.entities.Location.list(),
      base44.entities.Customer.list(),
      base44.entities.Boat.list()]
      );
      setLeads(allLeads);
      setLocations(allLocations);
      setCustomers(allCustomers);
      setBoats(allBoats);
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
        setLeads(leads.filter((l) => l.id !== leadId));
      } catch (error) {
        console.error('Error deleting lead:', error);
      }
    }
  };

  const filteredLeads = leads.filter((lead) => {
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 mt-1">Manage customer inquiries and opportunities</p>
        </div>
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
        {[
          { status: 'Pending', icon: Clock, color: 'text-amber-500' },
          { status: 'Contacted', icon: Phone, color: 'text-blue-500' },
          { status: 'Converted', icon: CheckCircle2, color: 'text-emerald-500' },
          { status: 'Lost', icon: XCircle, color: 'text-slate-400' }
        ].map(({ status, icon: Icon, color }) => {
          const count = leads.filter((l) => l.status === status).length;
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">{status}</p>
                    <p className="text-2xl font-bold text-slate-900">{count}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${color}`} />
                </div>
              </CardContent>
            </Card>);

        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search leads..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 max-w-md" />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Contacted">Contacted</SelectItem>
            <SelectItem value="Converted">Converted</SelectItem>
            <SelectItem value="Lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {filteredLeads.length === 0 ?
        <Card>
            <CardContent className="p-6 text-center">
              <p className="text-slate-500 text-sm">No leads found</p>
            </CardContent>
          </Card> :

        filteredLeads.map((lead) => {
          const statusInfo = statusIconMap[lead.status] || statusIconMap['Pending'];
          const StatusIcon = statusInfo.icon;

          return (
        <Card key={lead.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    <div className={`h-10 w-10 rounded-full ${statusInfo.bg} flex items-center justify-center`}>
                      <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                    </div>
                  </div>

                  {/* Lead Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Row 1: Name and Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-slate-900">{lead.name}</h3>
                      {lead.status && (
                        <Badge className={`${statusColors[lead.status]} text-xs`}>
                          {lead.status}
                        </Badge>
                      )}
                      {lead.priority && (
                        <Badge className={`${priorityColors[lead.priority]} text-xs`}>
                          {lead.priority}
                        </Badge>
                      )}
                      {lead.inquiry_type && (
                        <Badge variant="outline" className={`text-xs ${inquiryTypeColors[lead.inquiry_type]}`}>
                          {lead.inquiry_type}
                        </Badge>
                      )}
                    </div>

                    {/* Row 2: Contact Info */}
                    <div className="flex items-center gap-2 text-sm text-slate-600 flex-wrap">
                      {lead.phone && (
                        <>
                          <Phone className="h-3.5 w-3.5" />
                          <span>{lead.phone}</span>
                        </>
                      )}
                      {lead.email && (
                        <>
                          <span>•</span>
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{lead.email}</span>
                        </>
                      )}
                      {lead.boat_name && (
                        <>
                          <span>•</span>
                          <Anchor className="h-3.5 w-3.5" />
                          <span>{lead.boat_name}</span>
                        </>
                      )}
                      {lead.location && (
                        <>
                          <span>•</span>
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{lead.location}</span>
                        </>
                      )}
                    </div>

                    {/* Row 3: Description */}
                    {lead.description && (
                      <p className="text-sm text-slate-600 line-clamp-1">
                        {lead.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0 hover:bg-slate-100" 
                      asChild
                    >
                      <Link to={createPageUrl('LeadDetail') + `?id=${lead.id}`}>
                        <Eye className="h-4 w-4 text-slate-600" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setConvertingLead(lead);
                        setShowConvertDialog(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3 text-xs font-medium"
                    >
                      Convert
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-slate-100"
                      onClick={() => {
                        setEditingLead(lead);
                        setShowForm(true);
                      }}
                    >
                      <Edit className="h-4 w-4 text-slate-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteLead(lead.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
        }
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
            customers={customers}
            boats={boats}
            onSave={handleSaveLead}
            onCancel={() => {
              setShowForm(false);
              setEditingLead(null);
            }} />

        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog (with tasks) */}
      <Dialog open={!!selectedLeadDetail} onOpenChange={(open) => !open && setSelectedLeadDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedLeadDetail?.name}</DialogTitle>
          </DialogHeader>
          {selectedLeadDetail &&
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

              {selectedLeadDetail.description &&
            <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600 mb-2 font-medium">Description/Inquiry</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedLeadDetail.description}</p>
                </div>
            }

              <LeadTaskList
              leadId={selectedLeadDetail.id}
              leadDescription={selectedLeadDetail.description} />

            </div>
          }
        </DialogContent>
      </Dialog>

      {/* Conversion Dialog */}
      {convertingLead &&
      <LeadConversionDialog
        lead={convertingLead}
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        onSuccess={async () => {
          await loadData();
          setConvertingLead(null);
        }} />

      }
    </div>);

}