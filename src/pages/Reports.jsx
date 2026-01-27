import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Truck,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Target,
  Activity,
  Wrench
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  startOfYear,
  endOfYear,
  startOfWeek,
  endOfWeek,
  subMonths,
  addMonths,
  isWithinInterval
} from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const StatCard = ({ title, value, subtitle, icon: Icon, color, loading }) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
              )}
            </>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function Reports() {
  const [jobs, setJobs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [dateRange, setDateRange] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTechnician, setSelectedTechnician] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        jobsData,
        workOrdersData,
        tasksData,
        timeEntriesData,
        techniciansData,
        reservationsData,
        vehiclesData
      ] = await Promise.all([
        base44.entities.Job.list('-created_date', 1000),
        base44.entities.WorkOrder.list('-created_date', 1000),
        base44.entities.Task.list(),
        base44.entities.TimeEntry.list(),
        base44.entities.Technician.list(),
        base44.entities.InventoryReservation.list(),
        base44.entities.InventoryItem.filter({ item_type: 'VEHICLE' })
      ]);

      setJobs(jobsData);
      setWorkOrders(workOrdersData);
      setTasks(tasksData);
      setTimeEntries(timeEntriesData);
      setTechnicians(techniciansData);
      setReservations(reservationsData);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Error loading reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeBounds = () => {
    const now = new Date();
    switch (dateRange) {
      case 'this_week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case 'next_month':
        return { start: startOfMonth(addMonths(now, 1)), end: endOfMonth(addMonths(now, 1)) };
      case 'next_2_months':
        return { start: startOfMonth(addMonths(now, 1)), end: endOfMonth(addMonths(now, 2)) };
      case 'next_3_months':
        return { start: startOfMonth(addMonths(now, 1)), end: endOfMonth(addMonths(now, 3)) };
      case 'next_6_months':
        return { start: startOfMonth(addMonths(now, 1)), end: endOfMonth(addMonths(now, 6)) };
      case 'this_year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        if (startDate && endDate) {
          return { start: parseISO(startDate), end: parseISO(endDate) };
        }
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { start: rangeStart, end: rangeEnd } = getDateRangeBounds();

  const filterByDate = (item, dateField) => {
    if (!item[dateField]) return false;
    try {
      const itemDate = parseISO(item[dateField]);
      return isWithinInterval(itemDate, { start: rangeStart, end: rangeEnd });
    } catch {
      return false;
    }
  };

  const filteredJobs = jobs.filter(j => filterByDate(j, 'intake_date'));
  const filteredWorkOrders = workOrders.filter(wo => filterByDate(wo, 'scheduled_date'));
  const filteredTimeEntries = timeEntries.filter(te => filterByDate(te, 'entry_date'));
  const filteredReservations = reservations.filter(r => filterByDate(r, 'start_datetime'));

  // Job Completion Stats
  const completedJobs = filteredJobs.filter(j => j.status === 'Completed').length;
  const totalJobs = filteredJobs.length;
  const completionRate = totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : 0;

  const jobsByStatus = [
    { name: 'New', value: filteredJobs.filter(j => j.status === 'New').length },
    { name: 'In Progress', value: filteredJobs.filter(j => ['Approved', 'Scheduled', 'In Progress'].includes(j.status)).length },
    { name: 'Completed', value: completedJobs },
    { name: 'Cancelled', value: filteredJobs.filter(j => j.status === 'Cancelled').length }
  ].filter(item => item.value > 0);

  // Technician Performance
  const technicianStats = technicians.map(tech => {
    const techTimeEntries = filteredTimeEntries.filter(te => te.technician_id === tech.id);
    const totalHours = techTimeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0) / 60;
    const techWorkOrders = filteredWorkOrders.filter(wo => 
      wo.assigned_technicians?.includes(tech.id) || wo.lead_technician_id === tech.id
    );
    const completedWOs = techWorkOrders.filter(wo => wo.status === 'Completed').length;

    return {
      name: `${tech.first_name} ${tech.last_name}`,
      id: tech.id,
      hours: Math.round(totalHours * 10) / 10,
      workOrders: techWorkOrders.length,
      completed: completedWOs,
      completionRate: techWorkOrders.length > 0 ? ((completedWOs / techWorkOrders.length) * 100).toFixed(0) : 0
    };
  }).filter(stat => 
    selectedTechnician === 'all' || stat.id === selectedTechnician
  ).sort((a, b) => b.hours - a.hours);

  // Time Tracking
  const totalHoursLogged = filteredTimeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0) / 60;
  const billableHours = filteredTimeEntries.filter(te => te.is_billable).reduce((sum, te) => sum + (te.duration_minutes || 0), 0) / 60;
  const billableRate = totalHoursLogged > 0 ? ((billableHours / totalHoursLogged) * 100).toFixed(1) : 0;

  // Task Completion
  const filteredTasks = tasks.filter(task => {
    const wo = workOrders.find(w => w.id === task.work_order_id);
    return wo && filterByDate(wo, 'scheduled_date');
  });
  const completedTasks = filteredTasks.filter(t => t.status === 'Completed').length;
  const taskCompletionRate = filteredTasks.length > 0 ? ((completedTasks / filteredTasks.length) * 100).toFixed(1) : 0;

  // Equipment Usage
  const vehicleUsage = vehicles.map(vehicle => {
    const vehicleReservations = filteredReservations.filter(r => r.inventory_item_id === vehicle.id);
    return {
      name: vehicle.license_plate || vehicle.name,
      reservations: vehicleReservations.length,
      workOrders: [...new Set(vehicleReservations.map(r => r.work_order_id))].length
    };
  }).filter(v => v.reservations > 0).sort((a, b) => b.reservations - a.reservations);

  // Skills Capacity Analysis - Current Month
  const currentMonth = new Date();
  const currentMonthStart = startOfMonth(currentMonth);
  const currentMonthEnd = endOfMonth(currentMonth);
  
  const currentMonthWorkOrders = workOrders.filter(wo => {
    if (!wo.scheduled_date) return false;
    try {
      const woDate = parseISO(wo.scheduled_date);
      return isWithinInterval(woDate, { start: currentMonthStart, end: currentMonthEnd });
    } catch {
      return false;
    }
  });

  // All available skills from technicians
  const allSkills = [...new Set(technicians.flatMap(tech => tech.skills || []))].sort();

  const skillsCapacity = allSkills.map(skill => {
    // Find all technicians with this skill
    const techsWithSkill = technicians.filter(tech => tech.skills?.includes(skill));
    
    // Calculate planned hours for this skill in current month
    let plannedHours = 0;
    currentMonthWorkOrders.forEach(wo => {
      if (!wo.assigned_technicians || wo.assigned_technicians.length === 0) return;
      
      // Check if any assigned technician has this skill
      const hasSkill = wo.assigned_technicians.some(techId => 
        techsWithSkill.some(t => t.id === techId)
      );
      
      if (hasSkill) {
        plannedHours += wo.estimated_duration_hours || 0;
      }
    });

    // Count work orders requiring this skill
    const workOrdersCount = currentMonthWorkOrders.filter(wo => 
      wo.assigned_technicians?.some(techId => 
        techsWithSkill.some(t => t.id === techId)
      )
    ).length;

    return {
      skill,
      techniciansCount: techsWithSkill.length,
      technicians: techsWithSkill.map(t => `${t.first_name} ${t.last_name}`).join(', '),
      plannedHours: Math.round(plannedHours * 10) / 10,
      workOrdersCount
    };
  }).sort((a, b) => b.plannedHours - a.plannedHours);

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-slate-500 mt-1">Performance metrics and insights</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="next_month">Next Month</SelectItem>
                  <SelectItem value="next_2_months">Next 2 Months</SelectItem>
                  <SelectItem value="next_3_months">Next 3 Months</SelectItem>
                  <SelectItem value="next_6_months">Next 6 Months</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
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
          </div>

          <div className="flex items-center gap-2 mt-4 text-sm text-slate-600">
            <Calendar className="h-4 w-4" />
            <span>
              Showing data from {format(rangeStart, 'MMM d, yyyy')} to {format(rangeEnd, 'MMM d, yyyy')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Jobs"
          value={totalJobs}
          subtitle={`${completionRate}% completion rate`}
          icon={FileText}
          color="bg-blue-500"
          loading={loading}
        />
        <StatCard
          title="Hours Logged"
          value={`${Math.round(totalHoursLogged)}h`}
          subtitle={`${billableRate}% billable`}
          icon={Clock}
          color="bg-emerald-500"
          loading={loading}
        />
        <StatCard
          title="Active Technicians"
          value={technicianStats.filter(t => t.hours > 0).length}
          subtitle={`${technicians.length} total`}
          icon={Users}
          color="bg-violet-500"
          loading={loading}
        />
        <StatCard
          title="Tasks Completed"
          value={completedTasks}
          subtitle={`${taskCompletionRate}% completion rate`}
          icon={CheckCircle2}
          color="bg-amber-500"
          loading={loading}
        />
      </div>

      {/* Reports Tabs */}
      <Tabs defaultValue="skills" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="skills">Skills Capacity</TabsTrigger>
          <TabsTrigger value="jobs">Job Completion</TabsTrigger>
          <TabsTrigger value="technicians">Technician Performance</TabsTrigger>
          <TabsTrigger value="time">Time Tracking</TabsTrigger>
          <TabsTrigger value="equipment">Equipment Usage</TabsTrigger>
        </TabsList>

        {/* Skills Capacity Report */}
        <TabsContent value="skills" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Skills Capacity Overview</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Current Month: {format(currentMonthStart, 'MMMM yyyy')}
                </p>
              </div>
              <Button 
                onClick={() => exportToCSV(skillsCapacity, 'skills_capacity_report')}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {skillsCapacity.length > 0 ? (
                  <>
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-4">Planned Hours by Skill - Current Month</h3>
                      <div className="space-y-4">
                        {skillsCapacity.map((item) => {
                          const maxHours = Math.max(...skillsCapacity.map(s => s.plannedHours), 1);
                          const percentage = (item.plannedHours / maxHours) * 100;
                          
                          return (
                            <div key={item.skill} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-50 rounded-lg">
                                    <Wrench className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <h4 className="text-base font-semibold text-slate-900">{item.skill}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      {item.techniciansCount} technician{item.techniciansCount !== 1 ? 's' : ''} • {item.workOrdersCount} work order{item.workOrdersCount !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-slate-900">{item.plannedHours}h</div>
                                  <div className="text-xs text-slate-500">
                                    {item.workOrdersCount > 0 
                                      ? `${Math.round((item.plannedHours / item.workOrdersCount) * 10) / 10}h avg/WO`
                                      : 'No WOs'}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="relative w-full h-8 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    item.plannedHours >= 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                    item.plannedHours >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                                    item.plannedHours >= 20 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                                    'bg-gradient-to-r from-slate-400 to-slate-500'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                                <div className="absolute inset-0 flex items-center px-3 text-xs font-medium">
                                  <span className={percentage > 30 ? 'text-white' : 'text-slate-700'}>
                                    {item.technicians}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <Wrench className="h-5 w-5 text-blue-600" />
                          <p className="text-sm font-medium text-blue-900">Total Skills</p>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">{allSkills.length}</p>
                      </div>
                      
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <Clock className="h-5 w-5 text-emerald-600" />
                          <p className="text-sm font-medium text-emerald-900">Total Planned Hours</p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700">
                          {Math.round(skillsCapacity.reduce((sum, s) => sum + s.plannedHours, 0))}h
                        </p>
                      </div>
                      
                      <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <Activity className="h-5 w-5 text-violet-600" />
                          <p className="text-sm font-medium text-violet-900">Avg Hours per Skill</p>
                        </div>
                        <p className="text-2xl font-bold text-violet-700">
                          {skillsCapacity.length > 0 
                            ? Math.round((skillsCapacity.reduce((sum, s) => sum + s.plannedHours, 0) / skillsCapacity.length) * 10) / 10
                            : 0}h
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Wrench className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <p>No skills data available</p>
                    <p className="text-sm mt-1">Add skills to technicians to see capacity overview</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Job Completion Report */}
        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Job Completion Overview</CardTitle>
              <Button 
                onClick={() => exportToCSV(
                  filteredJobs.map(j => ({
                    job_number: j.job_number,
                    title: j.title,
                    status: j.status,
                    priority: j.priority,
                    intake_date: j.intake_date,
                    completion_date: j.completion_date || 'N/A'
                  })),
                  'job_completion_report'
                )}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Jobs by Status</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={jobsByStatus}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {jobsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Completion Metrics</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Total Jobs</span>
                        <span className="text-2xl font-bold text-slate-900">{totalJobs}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-emerald-600">Completed</span>
                        <span className="text-2xl font-bold text-emerald-700">{completedJobs}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-600">Completion Rate</span>
                        <span className="text-2xl font-bold text-blue-700">{completionRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technician Performance Report */}
        <TabsContent value="technicians" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Technician Performance</CardTitle>
              <Button 
                onClick={() => exportToCSV(technicianStats, 'technician_performance_report')}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Hours Logged by Technician</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={technicianStats.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="hours" fill="#3b82f6" name="Hours Logged" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Detailed Statistics</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Technician</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Hours</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Work Orders</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Completed</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {technicianStats.map((stat) => (
                          <tr key={stat.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{stat.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{stat.hours}h</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{stat.workOrders}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{stat.completed}</td>
                            <td className="px-4 py-3">
                              <Badge className={
                                stat.completionRate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                stat.completionRate >= 60 ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }>
                                {stat.completionRate}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Tracking Report */}
        <TabsContent value="time" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Time Tracking Analysis</CardTitle>
              <Button 
                onClick={() => exportToCSV(
                  filteredTimeEntries.map(te => {
                    const tech = technicians.find(t => t.id === te.technician_id);
                    const wo = workOrders.find(w => w.id === te.work_order_id);
                    return {
                      date: te.entry_date,
                      technician: tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown',
                      work_order: wo?.work_order_number || wo?.id,
                      duration_hours: (te.duration_minutes / 60).toFixed(2),
                      billable: te.is_billable ? 'Yes' : 'No'
                    };
                  }),
                  'time_tracking_report'
                )}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Billable vs Non-Billable</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Billable', value: Math.round(billableHours) },
                          { name: 'Non-Billable', value: Math.round(totalHoursLogged - billableHours) }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}h`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#94a3b8" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Summary</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Total Hours</span>
                        <span className="text-2xl font-bold text-slate-900">{Math.round(totalHoursLogged)}h</span>
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-emerald-600">Billable Hours</span>
                        <span className="text-2xl font-bold text-emerald-700">{Math.round(billableHours)}h</span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Non-Billable</span>
                        <span className="text-2xl font-bold text-slate-700">{Math.round(totalHoursLogged - billableHours)}h</span>
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-600">Billable Rate</span>
                        <span className="text-2xl font-bold text-blue-700">{billableRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-700 mb-4">Time Entries Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Total Entries</p>
                    <p className="text-xl font-bold text-slate-900">{filteredTimeEntries.length}</p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Avg per Entry</p>
                    <p className="text-xl font-bold text-slate-900">
                      {filteredTimeEntries.length > 0 
                        ? Math.round((totalHoursLogged / filteredTimeEntries.length) * 10) / 10
                        : 0}h
                    </p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Work Orders</p>
                    <p className="text-xl font-bold text-slate-900">
                      {[...new Set(filteredTimeEntries.map(te => te.work_order_id))].length}
                    </p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Avg per WO</p>
                    <p className="text-xl font-bold text-slate-900">
                      {filteredWorkOrders.length > 0
                        ? Math.round((totalHoursLogged / filteredWorkOrders.length) * 10) / 10
                        : 0}h
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Equipment Usage Report */}
        <TabsContent value="equipment" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Equipment Usage</CardTitle>
              <Button 
                onClick={() => exportToCSV(vehicleUsage, 'equipment_usage_report')}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {vehicleUsage.length > 0 ? (
                  <>
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-4">Vehicle Reservations</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={vehicleUsage}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="reservations" fill="#10b981" name="Reservations" />
                          <Bar dataKey="workOrders" fill="#3b82f6" name="Work Orders" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-4">Detailed Usage</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Vehicle</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Reservations</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Work Orders</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Utilization</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {vehicleUsage.map((vehicle, index) => (
                              <tr key={index} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm font-medium text-slate-900">{vehicle.name}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{vehicle.reservations}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{vehicle.workOrders}</td>
                                <td className="px-4 py-3">
                                  <Badge className={
                                    vehicle.reservations >= 10 ? 'bg-emerald-100 text-emerald-700' :
                                    vehicle.reservations >= 5 ? 'bg-blue-100 text-blue-700' :
                                    'bg-slate-100 text-slate-700'
                                  }>
                                    {vehicle.reservations >= 10 ? 'High' : vehicle.reservations >= 5 ? 'Medium' : 'Low'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Truck className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <p>No equipment usage data for selected period</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}