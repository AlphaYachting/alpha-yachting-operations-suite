import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Mail, 
  Search, 
  RefreshCw, 
  Ban, 
  Filter,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const statusColors = {
  CREATED: 'bg-slate-100 text-slate-800',
  SENT: 'bg-blue-100 text-blue-800',
  OPENED: 'bg-purple-100 text-purple-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-orange-100 text-orange-800',
  REVOKED: 'bg-red-100 text-red-800'
};

const roleColors = {
  CUSTOMER: 'bg-cyan-100 text-cyan-800',
  TECHNICIAN: 'bg-indigo-100 text-indigo-800'
};

export default function AppInvites() {
  const [invites, setInvites] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invitesData, customersData, techniciansData] = await Promise.all([
        base44.entities.AppInvite.list('-created_date'),
        base44.entities.Customer.list(),
        base44.entities.Technician.list()
      ]);
      
      setInvites(invitesData);
      setCustomers(customersData);
      setTechnicians(techniciansData);
    } catch (error) {
      console.error('Error loading invites:', error);
      toast.error('Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (inviteId) => {
    setProcessingId(inviteId);
    try {
      const response = await base44.functions.invoke('resendAppInvite', { invite_id: inviteId });
      if (response.data.success) {
        toast.success('Invite resent successfully');
        await loadData();
      } else {
        toast.error(response.data.error || 'Failed to resend invite');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to resend invite');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async (inviteId) => {
    if (!confirm('Are you sure you want to revoke this invite?')) return;
    
    setProcessingId(inviteId);
    try {
      const response = await base44.functions.invoke('revokeAppInvite', { invite_id: inviteId });
      if (response.data.success) {
        toast.success('Invite revoked');
        await loadData();
      } else {
        toast.error(response.data.error || 'Failed to revoke invite');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to revoke invite');
    } finally {
      setProcessingId(null);
    }
  };

  const getLinkedName = (invite) => {
    if (invite.customer_id) {
      const customer = customers.find(c => c.id === invite.customer_id);
      if (customer) {
        return customer.company_name || `${customer.first_name} ${customer.last_name}`;
      }
    }
    if (invite.technician_id) {
      const tech = technicians.find(t => t.id === invite.technician_id);
      if (tech) {
        return `${tech.first_name} ${tech.last_name}`;
      }
    }
    return null;
  };

  const filteredInvites = invites.filter(invite => {
    const matchesSearch = invite.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getLinkedName(invite)?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invite.status === statusFilter;
    const matchesRole = roleFilter === 'all' || invite.role === roleFilter;
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  const stats = {
    total: invites.length,
    sent: invites.filter(i => i.status === 'SENT').length,
    accepted: invites.filter(i => i.status === 'ACCEPTED').length,
    pending: invites.filter(i => ['CREATED', 'SENT', 'OPENED'].includes(i.status)).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">App Invitations</h1>
        <p className="text-slate-500 mt-1">Manage customer and technician app invites</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Invites</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <Mail className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Pending</p>
                <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Sent</p>
                <p className="text-2xl font-bold text-slate-900">{stats.sent}</p>
              </div>
              <Eye className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Accepted</p>
                <p className="text-2xl font-bold text-slate-900">{stats.accepted}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="CREATED">Created</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="OPENED">Opened</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="REVOKED">Revoked</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
                <SelectItem value="TECHNICIAN">Technician</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invites List */}
      <Card>
        <CardHeader>
          <CardTitle>Invitations ({filteredInvites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : filteredInvites.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No invites found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvites.map((invite) => {
                const linkedName = getLinkedName(invite);
                const canResend = !['ACCEPTED', 'REVOKED'].includes(invite.status);
                const canRevoke = !['ACCEPTED', 'REVOKED'].includes(invite.status);
                
                return (
                  <div 
                    key={invite.id}
                    className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Email and Name */}
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-slate-900">{invite.email}</span>
                          {linkedName && (
                            <span className="text-sm text-slate-500">({linkedName})</span>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge className={roleColors[invite.role]}>
                            {invite.role}
                          </Badge>
                          <Badge className={statusColors[invite.status]}>
                            {invite.status}
                          </Badge>
                        </div>

                        {/* Dates */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created: {format(new Date(invite.created_date), 'MMM d, yyyy HH:mm')}
                          </span>
                          {invite.last_sent_at && (
                            <span>
                              Last sent: {format(new Date(invite.last_sent_at), 'MMM d, yyyy HH:mm')}
                            </span>
                          )}
                          {invite.send_count > 0 && (
                            <span>
                              Sent {invite.send_count}x
                            </span>
                          )}
                          {invite.accepted_at && (
                            <span className="text-green-600">
                              Accepted: {format(new Date(invite.accepted_at), 'MMM d, yyyy HH:mm')}
                            </span>
                          )}
                          {invite.expires_at && !['ACCEPTED', 'EXPIRED', 'REVOKED'].includes(invite.status) && (
                            <span>
                              Expires: {format(new Date(invite.expires_at), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {canResend && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResend(invite.id)}
                            disabled={processingId === invite.id}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${processingId === invite.id ? 'animate-spin' : ''}`} />
                            Resend
                          </Button>
                        )}
                        {canRevoke && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRevoke(invite.id)}
                            disabled={processingId === invite.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Revoke
                          </Button>
                        )}
                      </div>
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