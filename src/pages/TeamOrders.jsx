import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Plus, 
  Search, 
  Euro, 
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const statusConfig = {
  'Draft': { color: 'bg-slate-100 text-slate-700', icon: Clock },
  'Sent': { color: 'bg-blue-100 text-blue-700', icon: Clock },
  'Accepted': { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'In Progress': { color: 'bg-cyan-100 text-cyan-700', icon: Clock },
  'Completed': { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'Closed': { color: 'bg-slate-100 text-slate-700', icon: CheckCircle2 },
  'Cancelled': { color: 'bg-red-100 text-red-700', icon: XCircle }
};

export default function TeamOrders() {
  const [teamOrders, setTeamOrders] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [orders, workOrderList, techList] = await Promise.all([
        base44.entities.TeamOrder.list('-created_date'),
        base44.entities.WorkOrder.list(),
        base44.entities.Technician.list()
      ]);
      setTeamOrders(orders);
      setWorkOrders(workOrderList);
      setTechnicians(techList);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWorkOrder = (workOrderId) => {
    return workOrders.find(wo => wo.id === workOrderId);
  };

  const getPartnerName = (order) => {
    if (order.partner_name) return order.partner_name;
    if (order.external_partner_id) {
      const tech = technicians.find(t => t.id === order.external_partner_id);
      return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
    }
    return 'Not assigned';
  };

  const filteredOrders = teamOrders.filter(order => {
    const workOrder = getWorkOrder(order.work_order_id);
    const partnerName = getPartnerName(order);
    const searchLower = searchTerm.toLowerCase();
    
    return (
      partnerName.toLowerCase().includes(searchLower) ||
      order.status?.toLowerCase().includes(searchLower) ||
      workOrder?.title?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: teamOrders.length,
    draft: teamOrders.filter(o => o.status === 'Draft').length,
    active: teamOrders.filter(o => ['Sent', 'Accepted', 'In Progress'].includes(o.status)).length,
    completed: teamOrders.filter(o => o.status === 'Completed').length,
    totalBudget: teamOrders.reduce((sum, o) => sum + (o.approved_budget_total || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Clock className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Team Orders</h1>
          <p className="text-slate-600 mt-1">Manage external partner assignments</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Total Orders</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Draft</p>
            <p className="text-2xl font-bold text-slate-700">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Active</p>
            <p className="text-2xl font-bold text-cyan-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Total Budget</p>
            <p className="text-2xl font-bold text-purple-600">€{stats.totalBudget.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by partner, status, or work order..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Team Orders List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {searchTerm ? 'No team orders found' : 'No team orders yet'}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Create team orders from work orders to assign to external partners'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map(order => {
            const workOrder = getWorkOrder(order.work_order_id);
            const config = statusConfig[order.status] || statusConfig['Draft'];
            const StatusIcon = config.icon;

            return (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {workOrder?.title || 'Unknown Work Order'}
                          </CardTitle>
                          <p className="text-sm text-slate-600">
                            Partner: {getPartnerName(order)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Badge className={config.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Budget</p>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-green-600" />
                        <span className="font-semibold text-green-600">
                          €{(order.approved_budget_total || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {workOrder?.scheduled_date && (
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Scheduled</p>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span className="text-sm font-medium">
                            {format(parseISO(workOrder.scheduled_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Cost Coverage</p>
                      <div className="flex flex-wrap gap-1">
                        {order.accommodation_paid && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Hotel
                          </Badge>
                        )}
                        {order.meals_per_diem_paid && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Per Diem
                          </Badge>
                        )}
                        {order.mileage_paid && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            KM
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Link to={createPageUrl('TeamOrderDetail') + `?id=${order.id}`}>
                        Edit Order
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Link to={createPageUrl('WorkOrderDetail') + `?id=${order.work_order_id}`}>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        View Work Order
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}