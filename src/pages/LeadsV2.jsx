import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Clock, PhoneCall, CheckCircle2, XCircle, Search, Mail, Truck, Zap, StickyNote } from 'lucide-react';
import DispatchFullscreenModal from '@/components/dispatch/DispatchFullscreenModal';
import QuickCaptureModal from '@/components/quickcapture/QuickCaptureModal';
import { base44 } from '@/api/base44Client';
import { useLeadData, getAgingLevel } from '@/components/leadsV2/useLeadData';
import LeadsList from '@/components/leadsV2/LeadsList';
import LeadForm from '@/components/leadsV2/LeadForm';
import EmailToLeadParser from '@/components/leadsV2/EmailToLeadParser';

export default function LeadsV2() {
  const { leads, customers, locations, users, boats, isLoading, updateLeadStatus, saveLead, deleteLead, refetchAll } = useLeadData();

  const urlParams = new URLSearchParams(window.location.search);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [showEmailParser, setShowEmailParser] = useState(urlParams.get('emailParser') === 'true');
  const [showDispatch, setShowDispatch] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await base44.entities.Note.create({ content: noteText.trim(), context: 'leads' });
      setNoteText('');
      setShowNoteDialog(false);
    } catch (e) {
      console.error('Error saving note:', e);
    } finally {
      setSavingNote(false);
    }
  };

  const handleEditLead = (lead) => {
    setEditingLead(lead);
    setShowForm(true);
  };

  const handleSaveLead = async (formData) => {
    try {
      await saveLead(formData);
      setShowForm(false);
      setEditingLead(null);
    } catch (err) {
      console.error('Error saving lead:', err);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (window.confirm('Delete this lead?')) {
      try {
        await deleteLead(leadId);
      } catch (err) {
        console.error('Error deleting lead:', err);
      }
    }
  };

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await updateLeadStatus(leadId, newStatus);
    } catch (err) {
      console.error('Error changing status:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
          <p className="text-slate-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  // Stats
  const stats = {
    newIncoming: leads.filter((l) => l.status === 'New Incoming').length,
    needsClarification: leads.filter((l) => l.status === 'Needs Clarification').length,
    offered: leads.filter((l) => l.status === 'Offered').length,
    confirmed: leads.filter((l) => l.status === 'Ordered / Confirmed').length,
    rejected: leads.filter((l) => l.status === 'Rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 text-sm mt-1">Manage customer inquiries and opportunities</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowDispatch(true)}>
            <Truck className="h-4 w-4 mr-2" />
            Dispatch
          </Button>
          <Button variant="outline" onClick={() => setShowEmailParser(true)} className="border-purple-300 text-purple-700 hover:bg-purple-50">
            <Mail className="h-4 w-4 mr-2" />
            E-Mail to Lead
          </Button>
          <Button variant="outline" onClick={() => setShowQuickCapture(true)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
            <Zap className="h-4 w-4 mr-2" />
            Quick Capture
          </Button>
          <Button variant="outline" onClick={() => setShowNoteDialog(true)}>
            <StickyNote className="h-4 w-4 mr-2" />
            Note
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {
          [
            { label: 'New Incoming', value: stats.newIncoming, icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
            { label: 'Needs Clarification', value: stats.needsClarification, icon: PhoneCall, iconBg: 'bg-orange-50', iconColor: 'text-orange-600' },
            { label: 'Offered', value: stats.offered, icon: CheckCircle2, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
            { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-700' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, iconBg: 'bg-red-50', iconColor: 'text-red-400' },
          ].map((stat) => (
            <Card key={stat.label} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.iconBg} rounded-full p-3`}>
                    <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        }
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
                <SelectItem value="New Incoming">New Incoming</SelectItem>
                <SelectItem value="Needs Clarification">Needs Clarification</SelectItem>
                <SelectItem value="Ready to Offer">Ready to Offer</SelectItem>
                <SelectItem value="Offered">Offered</SelectItem>
                <SelectItem value="Ordered / Confirmed">Ordered / Confirmed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads List */}
      <LeadsList
        leads={leads}
        customers={customers}
        users={users}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        onEdit={handleEditLead}
        onDelete={handleDeleteLead}
        onStatusChange={handleStatusChange}
        onViewDetail={() => {}}
        getAgingLevel={getAgingLevel}
      />

      {/* Dispatch Modal */}
      <DispatchFullscreenModal open={showDispatch} onOpenChange={setShowDispatch} />

      {/* Quick Capture Modal */}
      <QuickCaptureModal open={showQuickCapture} onOpenChange={setShowQuickCapture} onClose={() => setShowQuickCapture(false)} />

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <textarea
              className="w-full border rounded-md p-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Write your note..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveNote} disabled={savingNote || !noteText.trim()}>
                {savingNote ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email to Lead Parser Dialog */}
      <Dialog open={showEmailParser} onOpenChange={setShowEmailParser}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail → Lead</DialogTitle>
          </DialogHeader>
          <EmailToLeadParser
            onLeadParsed={(leadData) => {
              setShowEmailParser(false);
              setEditingLead(leadData);
              setShowForm(true);
            }}
            onCancel={() => setShowEmailParser(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Lead Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'New Lead'}</DialogTitle>
          </DialogHeader>
          <LeadForm
            lead={editingLead}
            customers={customers}
            locations={locations}
            users={users}
            boats={boats}
            onSave={handleSaveLead}
            onCancel={() => {
              setShowForm(false);
              setEditingLead(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}