import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  BarChart3, 
  TrendingUp,
  Clock,
  Users,
  Briefcase,
  Package,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, subDays, isAfter, parseISO } from 'date-fns';

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Reports() {
  const [jobs, setJobs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [jobsData, woData, techData, invData, custData] = await Promise.all([
        base44.entities.Job.list(),
        base44.entities.WorkOrder.list(),
        base44.entities.Technician.list(),
        base44.entities.InventoryItem.list(),
        base44.entities.Customer.list()
      ]);
      setJobs(jobsData);
      setWorkOrders(woData);
      setTechnicians(techData);
      setInventory(invData);
      setCustomers(custData);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const last30Days = subDays(new Date(), 30);
  const recentJobs = jobs.filter(j => j.created_date && isAfter(parseISO(j.created_date), last30Days));
  
  const jobsByStatus = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  const jobsByType = jobs.reduce((acc, job) => {
    acc[job.job_type] = (acc[job.job_type] || 0) + 1;
    return acc;
  }, {});

  const jobsByPriority = jobs.reduce((acc, job) => {
    acc[job.priority] = (acc[job.priority] || 0) + 1;
    return acc;
  }, {});

  const completedJobs = jobs.filter(j => j.status === 'Completed' || j.status === 'Invoiced').length;
  const activeJobs = jobs.filter(j => !['Completed', 'Invoiced', 'Cancelled'].includes(j.status)).length;
  const urgentJobs = jobs.filter(j => ['Urgent', 'Express'].includes(j.priority) && !['Completed', 'Invoiced', 'Cancelled'].includes(j.status)).length;

  const completedWorkOrders = workOrders.filter(wo => wo.status === 'Completed').length;
  const scheduledWorkOrders = workOrders.filter(wo => ['Scheduled', 'Dispatched'].includes(wo.status)).length;

  const activeTechnicians = technicians.filter(t => t.status === 'Active').length;
  const availableTechnicians = technicians.filter(t => t.availability_status === 'Available').length;

  const lowStockItems = inventory.filter(item => {
    const total = (item.stock_novigrad || 0) + (item.stock_van_1 || 0) + (item.stock_van_2 || 0);
    return total <= (item.min_stock_level || 1);
  }).length;

  const statusChartData = Object.entries(jobsByStatus).map(([name, value]) => ({ name, value }));
  const typeChartData = Object.entries(jobsByType).map(([name, value]) => ({ name: name.replace(' ', '\n'), value }));
  const priorityChartData = Object.entries(jobsByPriority).map(([name, value]) => ({ name, value }));

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2].map(i => <Skeleton key={i} className="h-80" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 mt-1">Overview of operations and performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Active Jobs</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{activeJobs}</p>
                <p className="text-xs text-slate-500 mt-1">{recentJobs.length} new this month</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100">
                <Briefcase className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Scheduled Work Orders</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{scheduledWorkOrders}</p>
                <p className="text-xs text-slate-500 mt-1">{completedWorkOrders} completed</p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-100">
                <Clock className="h-5 w-5 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Team Availability</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{availableTechnicians}/{activeTechnicians}</p>
                <p className="text-xs text-slate-500 mt-1">technicians available</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Low Stock Items</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{lowStockItems}</p>
                <p className="text-xs text-slate-500 mt-1">need reordering</p>
              </div>
              <div className={`p-3 rounded-xl ${lowStockItems > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                {lowStockItems > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jobs by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Jobs by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jobs by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10 }} 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Priority Distribution & Technician Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jobs by Priority</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {['Low', 'Normal', 'High', 'Urgent', 'Express'].map((priority) => {
              const count = jobsByPriority[priority] || 0;
              const percentage = jobs.length > 0 ? (count / jobs.length) * 100 : 0;
              const colors = {
                Low: 'bg-slate-500',
                Normal: 'bg-blue-500',
                High: 'bg-amber-500',
                Urgent: 'bg-red-500',
                Express: 'bg-purple-500'
              };
              
              return (
                <div key={priority} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{priority}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <Progress value={percentage} className={colors[priority]} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Team Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Team Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {technicians.filter(t => t.status === 'Active').slice(0, 6).map((tech) => (
                <div key={tech.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium">
                      {tech.first_name?.[0]}{tech.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{tech.first_name} {tech.last_name}</p>
                      <p className="text-xs text-slate-500">{tech.role}</p>
                    </div>
                  </div>
                  <Badge 
                    className={
                      tech.availability_status === 'Available' ? 'bg-emerald-100 text-emerald-700' :
                      tech.availability_status === 'On Job' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }
                  >
                    {tech.availability_status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">{customers.length}</p>
              <p className="text-sm text-slate-500">Total Customers</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">
                {customers.filter(c => c.status === 'Active').length}
              </p>
              <p className="text-sm text-slate-500">Active</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">
                {customers.filter(c => c.status === 'VIP').length}
              </p>
              <p className="text-sm text-slate-500">VIP</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">
                {customers.filter(c => c.customer_type === 'Business').length}
              </p>
              <p className="text-sm text-slate-500">Business</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}