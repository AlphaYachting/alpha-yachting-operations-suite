import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  BarChart3, 
  TrendingUp,
  Clock,
  Users,
  Briefcase,
  Package,
  AlertTriangle,
  CheckCircle2,
  Download,
  Filter,
  Calendar as CalendarIcon,
  Truck,
  Award,
  Target,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { format, subDays, isAfter, parseISO, startOfMonth, endOfMonth, startOfYear, isWithinInterval } from 'date-fns';

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Reports() {
  const [jobs, setJobs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState('30days');
  const [selectedTechnician, setSelectedTechnician] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [jobsData, woData, techData, invData, custData, tasksData, timeData, resData] = await Promise.all([
        base44.entities.Job.list('-created_date', 500),
        base44.entities.WorkOrder.list('-created_date', 500),
        base44.entities.Technician.list(),
        base44.entities.InventoryItem.list(),
        base44.entities.Customer.list(),
        base44.entities.Task.list(),
        base44.entities.TimeEntry.list(),
        base44.entities.InventoryReservation.list()
      ]);
      setJobs(jobsData);
      setWorkOrders(woData);
      setTechnicians(techData);
      setInventory(invData);
      setCustomers(custData);
      setTasks(tasksData);
      setTimeEntries(timeData);
      setReservations(resData);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Date filtering
  const getDateRange = () => {
    const now = new Date();
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return { start: parseISO(customStartDate), end: parseISO(customEndDate) };
    }
    switch (dateRange) {
      case '7days':
        return { start: subDays(now, 7), end: now };
      case '30days':
        return { start: subDays(now, 30), end: now };
      case '90days':
        return { start: subDays(now, 90), end: now };
      case 'thisMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'thisYear':
        return { start: startOfYear(now), end: now };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const { start: filterStartDate, end: filterEndDate } = getDateRange();

  // Filtered data based on date range and filters
  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      if (!j.created_date) return false;
      const inDateRange = isWithinInterval(parseISO(j.created_date), { start: filterStartDate, end: filterEndDate });
      const statusMatch = selectedStatus === 'all' || j.status === selectedStatus;
      return inDateRange && statusMatch;
    });
  }, [jobs, filterStartDate, filterEndDate, selectedStatus]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      if (!wo.created_date) return false;
      const inDateRange = isWithinInterval(parseISO(wo.created_date), { start: filterStartDate, end: filterEndDate });
      const techMatch = selectedTechnician === 'all' || wo.assigned_technicians?.includes(selectedTechnician) || wo.lead_technician_id === selectedTechnician;
      return inDateRange && techMatch;
    });
  }, [workOrders, filterStartDate, filterEndDate, selectedTechnician]);

  const filteredTimeEntries = useMemo(() => {
    return timeEntries.filter(te => {
      if (!te.entry_date) return false;
      const inDateRange = isWithinInterval(parseISO(te.entry_date), { start: filterStartDate, end: filterEndDate });
      const techMatch = selectedTechnician === 'all' || te.technician_id === selectedTechnician;
      return inDateRange && techMatch;
    });
  }, [timeEntries, filterStartDate, filterEndDate, selectedTechnician]);

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

  // Job Completion Rate
  const totalFilteredJobs = filteredJobs.length;
  const completedFilteredJobs = filteredJobs.filter(j => j.status === 'Completed' || j.status === 'Invoiced').length;
  const completionRate = totalFilteredJobs > 0 ? ((completedFilteredJobs / totalFilteredJobs) * 100).toFixed(1) : 0;

  // Technician Performance
  const technicianPerformance = technicians.map(tech => {
    const techWorkOrders = filteredWorkOrders.filter(wo => 
      wo.assigned_technicians?.includes(tech.id) || wo.lead_technician_id === tech.id
    );
    const techTimeEntries = filteredTimeEntries.filter(te => te.technician_id === tech.id);
    const totalMinutes = techTimeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const completedWOs = techWorkOrders.filter(wo => wo.status === 'Completed').length;
    const avgTimePerWO = techWorkOrders.length > 0 ? (totalMinutes / techWorkOrders.length / 60).toFixed(1) : 0;
    
    return {
      id: tech.id,
      name: `${tech.first_name} ${tech.last_name}`,
      workOrdersAssigned: techWorkOrders.length,
      workOrdersCompleted: completedWOs,
      totalHours: parseFloat(totalHours),
      avgTimePerWO: parseFloat(avgTimePerWO),
      completionRate: techWorkOrders.length > 0 ? ((completedWOs / techWorkOrders.length) * 100).toFixed(1) : 0
    };
  }).filter(t => t.workOrdersAssigned > 0).sort((a, b) => b.totalHours - a.totalHours);

  // Time Spent on Tasks
  const taskTimeData = tasks.map(task => {
    const taskTimeEntries = filteredTimeEntries.filter(te => te.task_id === task.id);
    const totalMinutes = taskTimeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0);
    return {
      taskId: task.id,
      taskTitle: task.title,
      estimatedMinutes: task.estimated_minutes || 0,
      actualMinutes: totalMinutes,
      variance: totalMinutes - (task.estimated_minutes || 0)
    };
  }).filter(t => t.actualMinutes > 0);

  const totalEstimatedHours = taskTimeData.reduce((sum, t) => sum + t.estimatedMinutes, 0) / 60;
  const totalActualHours = taskTimeData.reduce((sum, t) => sum + t.actualMinutes, 0) / 60;
  const timeAccuracy = totalEstimatedHours > 0 ? ((totalActualHours / totalEstimatedHours) * 100).toFixed(1) : 0;

  // Equipment Usage
  const vehicleUsage = inventory.filter(i => i.item_type === 'VEHICLE').map(vehicle => {
    const vehicleReservations = reservations.filter(r => {
      if (r.inventory_item_id !== vehicle.id) return false;
      if (!r.start_datetime) return false;
      return isWithinInterval(parseISO(r.start_datetime), { start: filterStartDate, end: filterEndDate });
    });
    
    return {
      id: vehicle.id,
      name: vehicle.name,
      licensePlate: vehicle.license_plate,
      reservations: vehicleReservations.length,
      status: vehicle.status
    };
  }).filter(v => v.reservations > 0).sort((a, b) => b.reservations - a.reservations);

  // Export functions
  const exportToCSV = (data, filename) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportJobCompletion = () => {
    const data = filteredJobs.map(j => ({
      JobNumber: j.job_number || '',
      Title: j.title,
      Status: j.status,
      Priority: j.priority,
      CreatedDate: j.created_date ? format(parseISO(j.created_date), 'yyyy-MM-dd') : '',
      CompletedDate: j.completion_date ? format(parseISO(j.completion_date), 'yyyy-MM-dd') : ''
    }));
    exportToCSV(data, 'job_completion_report');
  };

  const handleExportTechnicianPerformance = () => {
    exportToCSV(technicianPerformance, 'technician_performance_report');
  };

  const handleExportTimeTracking = () => {
    const data = filteredTimeEntries.map(te => ({
      Date: te.entry_date ? format(parseISO(te.entry_date), 'yyyy-MM-dd') : '',
      TechnicianID: te.technician_id,
      WorkOrderID: te.work_order_id,
      TaskID: te.task_id || '',
      DurationMinutes: te.duration_minutes,
      DurationHours: (te.duration_minutes / 60).toFixed(2),
      Billable: te.is_billable ? 'Yes' : 'No',
      Notes: te.notes || ''
    }));
    exportToCSV(data, 'time_tracking_report');
  };

  const handleExportEquipmentUsage = () => {
    exportToCSV(vehicleUsage, 'equipment_usage_report');
  };

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
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-slate-500 mt-1">Comprehensive insights into operations and performance</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input 
                    type="date" 
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Technician</Label>
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.first_name} {tech.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Job Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Invoiced">Invoiced</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics - Filtered */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Job Completion Rate</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{completionRate}%</p>
                <p className="text-xs text-slate-500 mt-1">{completedFilteredJobs} of {totalFilteredJobs} jobs</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Hours Logged</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalActualHours.toFixed(0)}h</p>
                <p className="text-xs text-slate-500 mt-1">{filteredTimeEntries.length} time entries</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Time Estimation</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{timeAccuracy}%</p>
                <p className="text-xs text-slate-500 mt-1">accuracy vs estimates</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-100">
                <Activity className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Top Performer</p>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {technicianPerformance[0]?.name.split(' ')[0] || 'N/A'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {technicianPerformance[0]?.totalHours || 0}h logged
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-100">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Job Completion Analysis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Job Completion Analysis</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Performance over selected period ({format(filterStartDate, 'MMM d')} - {format(filterEndDate, 'MMM d, yyyy')})
            </p>
          </div>
          <Button onClick={handleExportJobCompletion} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-3xl font-bold text-slate-900">{totalFilteredJobs}</p>
              <p className="text-sm text-slate-500">Total Jobs</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-600">{completedFilteredJobs}</p>
              <p className="text-sm text-slate-500">Completed</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-600">
                {filteredJobs.filter(j => j.status === 'In Progress').length}
              </p>
              <p className="text-sm text-slate-500">In Progress</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">
                {filteredJobs.filter(j => j.status === 'Scheduled').length}
              </p>
              <p className="text-sm text-slate-500">Scheduled</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technician Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Technician Performance</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Work orders and hours by technician</p>
          </div>
          <Button onClick={handleExportTechnicianPerformance} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {technicianPerformance.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No data available for selected filters</p>
          ) : (
            <div className="space-y-4">
              {technicianPerformance.map((tech) => (
                <div key={tech.id} className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{tech.name}</p>
                      <p className="text-sm text-slate-500">
                        {tech.workOrdersCompleted}/{tech.workOrdersAssigned} completed • {tech.totalHours}h total
                      </p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700">
                      {tech.completionRate}% rate
                    </Badge>
                  </div>
                  <Progress value={parseFloat(tech.completionRate)} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Tracking Analysis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Time Tracking Analysis</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Estimated vs actual time spent</p>
          </div>
          <Button onClick={handleExportTimeTracking} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-3xl font-bold text-slate-900">{totalEstimatedHours.toFixed(0)}h</p>
              <p className="text-sm text-slate-500">Estimated Time</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">{totalActualHours.toFixed(0)}h</p>
              <p className="text-sm text-slate-500">Actual Time</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-600">
                {(totalActualHours - totalEstimatedHours).toFixed(0)}h
              </p>
              <p className="text-sm text-slate-500">Variance</p>
            </div>
          </div>
          {taskTimeData.length > 0 && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskTimeData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="taskTitle" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="estimatedMinutes" name="Estimated" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actualMinutes" name="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equipment Usage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Equipment Usage</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Vehicle reservations and utilization</p>
          </div>
          <Button onClick={handleExportEquipmentUsage} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {vehicleUsage.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No equipment usage data for selected period</p>
          ) : (
            <div className="space-y-3">
              {vehicleUsage.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-100">
                      <Truck className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{vehicle.name}</p>
                      <p className="text-sm text-slate-500">{vehicle.licensePlate || 'No plate'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{vehicle.reservations}</p>
                    <p className="text-xs text-slate-500">reservations</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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