import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  CalendarDays,
  LayoutGrid,
  Search,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, addDays, startOfWeek, isSameDay, parseISO, startOfDay } from 'date-fns';
import DispatchTimeline from '@/components/schedule/DispatchTimeline';
import FutureOverview from '@/components/schedule/FutureOverview';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  Dispatched: 'bg-violet-100 text-violet-700 border-violet-200',
  'In Transit': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200',
  Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-700 border-slate-200'
};

export default function Schedule() {
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // Dispatch view state
  const [viewMode, setViewMode] = useState('calendar');
  const [dispatchViewMode, setDispatchViewMode] = useState('day');
  const [dispatchDate, setDispatchDate] = useState(new Date());
  const [gridSize, setGridSize] = useState('1h');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [technicianFilter, setTechnicianFilter] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Future overview state
  const [rangeWeeks, setRangeWeeks] = useState(8);
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [focusBlockedDays, setFocusBlockedDays] = useState(false);
  const [overviewStartDate, setOverviewStartDate] = useState(startOfDay(new Date()));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [woData, jobsData, techData, custData, boatsData, locData] = await Promise.all([
        base44.entities.WorkOrder.list('-scheduled_date'),
        base44.entities.Job.list(),
        base44.entities.Technician.list(),
        base44.entities.Customer.list(),
        base44.entities.Boat.list(),
        base44.entities.Location.list()
      ]);
      setWorkOrders(woData);
      setJobs(jobsData);
      setTechnicians(techData);
      setCustomers(custData);
      setBoats(boatsData);
      setLocations(locData);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const getWorkOrdersForDay = (date) => {
    return workOrders.filter(wo => {
      if (!wo.scheduled_date) return false;
      return isSameDay(parseISO(wo.scheduled_date), date);
    });
  };

  const getJobInfo = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { customer: '', boat: '', location: '' };
    
    const customer = customers.find(c => c.id === job.customer_id);
    const boat = boats.find(b => b.id === job.boat_id);
    const location = locations.find(l => l.id === job.location_id);
    
    return {
      customer: customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || '',
      boat: boat?.vessel_name || '',
      location: location?.name || ''
    };
  };

  const getTechnicianInitials = (techIds) => {
    if (!techIds || techIds.length === 0) return [];
    return techIds.map(id => {
      const tech = technicians.find(t => t.id === id);
      return tech ? { name: `${tech.first_name} ${tech.last_name}`, initials: `${tech.first_name?.[0]}${tech.last_name?.[0]}` } : null;
    }).filter(Boolean);
  };

  const prevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const nextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // Dispatch navigation
  const prevDay = () => setDispatchDate(addDays(dispatchDate, -1));
  const nextDay = () => setDispatchDate(addDays(dispatchDate, 1));
  const goToDispatchToday = () => setDispatchDate(new Date());
  
  // Future overview navigation
  const prevRange = () => setOverviewStartDate(addDays(overviewStartDate, -rangeWeeks * 7));
  const nextRange = () => setOverviewStartDate(addDays(overviewStartDate, rangeWeeks * 7));
  const goToOverviewToday = () => setOverviewStartDate(startOfDay(new Date()));
  
  // Handle drill-down from overview to day view
  const handleOverviewDateClick = (date, technicianId) => {
    setDispatchDate(date);
    setDispatchViewMode('day');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="text-slate-500 mt-1">
            {viewMode === 'calendar' 
              ? `${format(currentWeekStart, 'MMM d')} - ${format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}`
              : format(dispatchDate, 'EEEE, MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              if (viewMode === 'calendar') goToToday();
              else if (dispatchViewMode === 'day') goToDispatchToday();
              else goToOverviewToday();
            }}
          >
            Today
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => {
              if (viewMode === 'calendar') prevWeek();
              else if (dispatchViewMode === 'day') prevDay();
              else prevRange();
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => {
              if (viewMode === 'calendar') nextWeek();
              else if (dispatchViewMode === 'day') nextDay();
              else nextRange();
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to={createPageUrl('WorkOrders') + '?new=true'}>
              <Plus className="h-4 w-4 mr-2" />
              New Work Order
            </Link>
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Dispatch
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-6 mt-6">

        {/* Calendar Grid */}
        {loading ? (
        <div className="grid grid-cols-7 gap-4">
            {[1,2,3,4,5,6,7].map(i => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayWorkOrders = getWorkOrdersForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <Card 
                key={day.toISOString()} 
                className={`min-h-[300px] ${isToday ? 'ring-2 ring-blue-500' : ''}`}
              >
                <CardHeader className={`py-3 px-4 ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}>
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-500 uppercase">
                      {format(day, 'EEE')}
                    </p>
                    <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                      {format(day, 'd')}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-2 space-y-2">
                    {dayWorkOrders.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No work orders</p>
                    ) : (
                      dayWorkOrders.map((wo) => {
                        const jobInfo = getJobInfo(wo.job_id);
                        const techs = getTechnicianInitials(wo.assigned_technicians);
                        
                        return (
                          <Link
                            key={wo.id}
                            to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                            className={`block p-2 rounded-lg border text-xs hover:shadow-md transition-shadow ${statusColors[wo.status]}`}
                          >
                            <p className="font-medium truncate">{wo.title}</p>
                            {wo.scheduled_start_time && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] opacity-80">
                                <Clock className="h-3 w-3" />
                                {wo.scheduled_start_time}
                              </div>
                            )}
                            {jobInfo.boat && (
                              <p className="truncate mt-1 opacity-80">{jobInfo.boat}</p>
                            )}
                            {techs.length > 0 && (
                              <div className="flex -space-x-1 mt-2">
                                {techs.slice(0, 2).map((tech, idx) => (
                                  <Avatar key={idx} className="h-5 w-5 border border-white">
                                    <AvatarFallback className="text-[8px] bg-white">
                                      {tech.initials}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {techs.length > 2 && (
                                  <div className="h-5 w-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px]">
                                    +{techs.length - 2}
                                  </div>
                                )}
                              </div>
                            )}
                          </Link>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Unscheduled Work Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Unscheduled Work Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="space-y-2">
                {workOrders.filter(wo => !wo.scheduled_date && wo.status !== 'Completed' && wo.status !== 'Cancelled').length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">All work orders are scheduled</p>
                ) : (
                  workOrders.filter(wo => !wo.scheduled_date && wo.status !== 'Completed' && wo.status !== 'Cancelled').map(wo => {
                    const jobInfo = getJobInfo(wo.job_id);
                    return (
                      <Link
                        key={wo.id}
                        to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{wo.title}</p>
                          <p className="text-sm text-slate-500">
                            {jobInfo.customer} • {jobInfo.boat}
                          </p>
                        </div>
                        <Badge className={statusColors[wo.status]}>{wo.status}</Badge>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        {/* Dispatch View */}
        <TabsContent value="dispatch" className="space-y-6 mt-6">
          {/* Dispatch Mode Toggle */}
          <div className="flex items-center gap-4">
            <Tabs value={dispatchViewMode} onValueChange={setDispatchViewMode} className="w-full max-w-md">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="day">Day Timeline</TabsTrigger>
                <TabsTrigger value="future">Future Overview</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Day View Filters */}
          {dispatchViewMode === 'day' && (
            <>
          <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by job, boat, or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Select value={gridSize} onValueChange={setGridSize}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Grid size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30m">30 minutes</SelectItem>
                    <SelectItem value="1h">1 hour</SelectItem>
                    <SelectItem value="2h">2 hours</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Dispatched">Dispatched</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Timeline */}
            {loading ? (
              <Skeleton className="h-96" />
            ) : (
              <DispatchTimeline
                technicians={technicians}
                workOrders={workOrders}
                jobs={jobs}
                customers={customers}
                boats={boats}
                locations={locations}
                selectedDate={dispatchDate}
                viewMode={dispatchViewMode}
                gridSize={gridSize}
                locationFilter={locationFilter}
                statusFilter={statusFilter}
                technicianFilter={technicianFilter}
                searchTerm={searchTerm}
              />
            )}
            </>
          )}

          {/* Future Overview Filters */}
          {dispatchViewMode === 'future' && (
            <>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by job, boat, or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Select value={rangeWeeks.toString()} onValueChange={(val) => setRangeWeeks(Number(val))}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 weeks</SelectItem>
                    <SelectItem value="8">8 weeks</SelectItem>
                    <SelectItem value="12">12 weeks</SelectItem>
                    <SelectItem value="26">6 months</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Dispatched">Dispatched</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-4 items-center flex-wrap">
              <Button
                variant={showBlockedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBlockedOnly(!showBlockedOnly)}
                className={showBlockedOnly ? "bg-blue-600" : ""}
              >
                <Filter className="h-4 w-4 mr-2" />
                Blocked only
              </Button>
              
              <Button
                variant={focusBlockedDays ? "default" : "outline"}
                size="sm"
                onClick={() => setFocusBlockedDays(!focusBlockedDays)}
                className={focusBlockedDays ? "bg-green-600" : ""}
              >
                Focus blocked days
              </Button>
            </div>

            {/* Future Overview */}
            {loading ? (
              <Skeleton className="h-96" />
            ) : (
              <FutureOverview
                technicians={technicians}
                workOrders={workOrders}
                jobs={jobs}
                customers={customers}
                boats={boats}
                locations={locations}
                startDate={overviewStartDate}
                rangeWeeks={rangeWeeks}
                locationFilter={locationFilter}
                statusFilter={statusFilter}
                technicianFilter={technicianFilter}
                searchTerm={searchTerm}
                showBlockedOnly={showBlockedOnly}
                focusBlockedDays={focusBlockedDays}
                onDateClick={handleOverviewDateClick}
              />
            )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}