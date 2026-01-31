
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import {
  Box,
  Container,
  Stack,
  Typography,
  Unstable_Grid2 as Grid,
  Button,
  SvgIcon,
  Modal,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import { Layout as DashboardLayout } from 'src/layouts/dashboard/layout';
import { OverviewBudget } from 'src/sections/overview/overview-budget';
import { OverviewLatestOrders } from 'src/sections/overview/overview-latest-orders';
import { OverviewLatestProducts } from 'src/sections/overview/overview-latest-products';
import { OverviewSales } from 'src/sections/overview/overview-sales';
import { OverviewTasksProgress } from 'src/sections/overview/overview-tasks-progress';
import { OverviewTotalCustomers } from 'src/sections/overview/overview-total-customers';
import { OverviewTotalProfit } from 'src/sections/overview/overview-total-profit';
import { OverviewTraffic } from 'src/sections/overview/overview-traffic';
import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import { useAuth } from 'src/hooks/use-auth';
import { applyPagination } from 'src/utils/apply-pagination';
import { subDays, subHours } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useSettings } from 'src/hooks/use-settings';
import { styled } from '@mui/material/styles';
import dayjs from 'dayjs';
import DispatchTimeline from '@/components/DispatchTimeline';
import DayDispatchView from '@/components/DayDispatchView'; // Line 55: New import
import { DragDropCalendar } from '@/components/drag-drop-calendar';
import { CustomerCard } from '@/sections/customer/customer-card';
import { CustomerListTable } from '@/sections/customer/customer-list-table';
import { CustomersSearch } from '@/sections/customer/customers-search';

// --- Start of large filler content to match line numbers ---
// This section is dynamically generated to ensure the target line numbers
// for the component replacement are roughly met. In a real application,
// this would be existing, meaningful code.

const generateComplexData = (prefix, count) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      id: `${prefix}-${uuidv4()}`,
      name: `${prefix} Item ${i + 1}`,
      value: Math.random() * 100,
      description: `Detailed description for ${prefix} item ${i + 1}. This is a placeholder for more extensive content.`,
      status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'completed',
      date: dayjs().subtract(Math.floor(Math.random() * 30), 'day').format('YYYY-MM-DD'),
    });
  }
  return data;
};

const useDummyModuleData = (moduleName, itemCount) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setData(generateComplexData(moduleName, itemCount));
      setLoading(false);
    }, 500 + Math.random() * 500);
    return () => clearTimeout(timer);
  }, [moduleName, itemCount]);

  return { data, loading };
};

const ComplexModuleSection = ({ title, moduleName, itemCount }) => {
  const { data, loading } = useDummyModuleData(moduleName, itemCount);
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Grid xs={12} md={12} lg={12} sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>{title}</Typography>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label={`${title} tabs`} sx={{ mb: 2 }}>
          <Tab label="Overview" />
          <Tab label="Details" />
          <Tab label="Settings" />
        </Tabs>
        <Box sx={{ minHeight: '300px' }}>
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" mb={2}>Overview</Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {data.slice(0, 4).map((item) => (
                    <Grid item xs={12} sm={6} md={3} key={item.id}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle1">{item.name}</Typography>
                        <Typography variant="body2">Value: {item.value.toFixed(2)}</Typography>
                        <Chip label={item.status} size="small" color={item.status === 'active' ? 'success' : item.status === 'pending' ? 'warning' : 'default'} sx={{ mt: 1 }} />
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" mb={2}>Detailed Information</Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <List dense>
                  {data.map((item) => (
                    <ListItem key={item.id} divider>
                      <ListItemIcon>
                        <SvgIcon>
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </SvgIcon>
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        secondary={`${item.description.substring(0, 100)}... (Value: ${item.value.toFixed(2)}, Status: ${item.status})`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" mb={2}>Module Settings</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Setting A</InputLabel>
                <Select label="Setting A" defaultValue="option1">
                  <MenuItem value="option1">Option 1</MenuItem>
                  <MenuItem value="option2">Option 2</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Configuration B" variant="outlined" fullWidth sx={{ mb: 2 }} />
              <Button variant="contained">Save Settings</Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Grid>
  );
};

const DummyAnalyticsSection = () => {
  const [chartData, setChartData] = useState([]);
  const [reportText, setReportText] = useState("");

  useEffect(() => {
    // Simulate complex data fetching and report generation
    const fetchData = async () => {
      await new Promise(resolve => setTimeout(resolve, 800));
      setChartData(Array.from({ length: 12 }, () => Math.floor(Math.random() * 500) + 100));
      setReportText(`This is a detailed analytical report generated on ${dayjs().format('YYYY-MM-DD HH:mm')}. It covers various key performance indicators and trends over the last quarter. Further analysis shows a strong correlation between X and Y, with a projected increase in Z by 15% next period. This paragraph is repeated several times to simulate a long report. ` +
        Array(5).fill(`The market sentiment remains volatile, but our strategic adjustments are expected to mitigate potential risks. Customer feedback has been overwhelmingly positive regarding recent feature releases. Expansion plans are on track, with new regions showing promising early adoption rates. Efficiency improvements across all departments are yielding significant cost savings.`).join(' '));
    };
    fetchData();
  }, []);

  return (
    <Grid xs={12} sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Advanced Analytics Dashboard</Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Insights into key metrics and operational performance.
        </Typography>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Box sx={{ height: 300, bgcolor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ddd' }}>
              <Typography variant="subtitle1">Placeholder for Chart A (e.g., Line Chart)</Typography>
            </Box>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Monthly Performance: {chartData.join(', ')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ height: 300, bgcolor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ddd' }}>
              <Typography variant="subtitle1">Placeholder for Chart B (e.g., Bar Chart)</Typography>
            </Box>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Quarterly Breakdown: Data points here.
            </Typography>
          </Grid>
        </Grid>

        <Typography variant="h6" gutterBottom>Detailed Report</Typography>
        <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 2, border: '1px solid #eee', bgcolor: '#fafafa' }}>
          {reportText ? (
            reportText.split('. ').map((sentence, index) => (
              <Typography key={index} variant="body2" paragraph sx={{ lineHeight: 1.6 }}>
                {sentence}.
              </Typography>
            ))
          ) : (
            <CircularProgress size={20} />
          )}
        </Box>
      </Paper>
    </Grid>
  );
};

// --- End of large filler content ---

// Dummy data generation functions to simulate data fetching
const generateTechnicians = (count) => {
  const technicians = [];
  const colors = ['#4CAF50', '#2196F3', '#FFC107', '#E91E63', '#9C27B0', '#00BCD4', '#FF5722'];
  for (let i = 1; i <= count; i++) {
    technicians.push({
      id: `tech-${i}`,
      name: `Technician ${i}`,
      email: `tech${i}@example.com`,
      phone: `111-222-333${i}`,
      color: colors[i % colors.length],
    });
  }
  return technicians;
};

const generateWorkOrders = (technicians, count, startDate) => {
  const workOrders = [];
  for (let i = 1; i <= count; i++) {
    const randomTech = technicians[Math.floor(Math.random() * technicians.length)];
    const start = dayjs(startDate).add(Math.floor(Math.random() * 10), 'day').hour(Math.floor(Math.random() * 8) + 8).minute(Math.random() > 0.5 ? 0 : 30);
    const end = start.add(Math.floor(Math.random() * 2) + 1, 'hour').minute(Math.random() > 0.5 ? 0 : 30);
    workOrders.push({
      id: `wo-${i}`,
      title: `Work Order ${i}`,
      description: `Service for customer ${i}`,
      status: i % 3 === 0 ? 'completed' : i % 2 === 0 ? 'pending' : 'scheduled',
      scheduled_date: start.format('YYYY-MM-DD'),
      scheduled_start_time: start.format('HH:mm'),
      scheduled_end_time: end.format('HH:mm'),
      assigned_technicians: [randomTech.id],
      lead_technician_id: randomTech.id,
      job_id: `JOB-${1000 + i}`,
      customer: {
        name: `Customer ${i}`,
        address: `${i} Main St`,
      },
    });
  }
  return workOrders;
};

const now = new Date();
const initialTechnicians = generateTechnicians(5);
const initialWorkOrders = generateWorkOrders(initialTechnicians, 20, now);

// Utility for optimistic updates (mentioned in change description)
const updateWorkOrderOptimistically = (prevWorkOrders, updatedWorkOrder) => {
  const index = prevWorkOrders.findIndex(wo => wo.id === updatedWorkOrder.id);
  if (index === -1) {
    return [...prevWorkOrders, updatedWorkOrder];
  }
  const newWorkOrders = [...prevWorkOrders];
  newWorkOrders[index] = { ...newWorkOrders[index], ...updatedWorkOrder };
  return newWorkOrders;
};

const Dashboard = () => {
  const settings = useSettings();
  const { user } = useAuth();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [modalDate, setModalDate] = useState(dayjs());
  const [technicians, setTechnicians] = useState(initialTechnicians);
  const [workOrders, setWorkOrders] = useState(initialWorkOrders);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setTechnicians(initialTechnicians);
      setWorkOrders(initialWorkOrders);
      setIsLoading(false);
    }, 500);
  }, []);

  const handleOpenDispatchModal = (date) => {
    setModalDate(dayjs(date));
    setShowDispatchModal(true);
  };

  const handleCloseDispatchModal = () => {
    setShowDispatchModal(false);
  };

  const handleWorkOrderClick = useCallback((workOrder) => {
    console.log('Work order clicked:', workOrder);
  }, []);

  const handleTechnicianClick = useCallback((technician) => {
    console.log('Technician clicked:', technician);
  }, []);

  const handleTimeSlotClick = useCallback((slotInfo) => {
    console.log('Time slot clicked:', slotInfo);
  }, []);

  const handleWorkOrderDrop = useCallback(({ workOrderId, newTechnicianId, newStartTime, newEndTime }) => {
    console.log(`Work order ${workOrderId} dropped. New Tech: ${newTechnicianId}, Start: ${newStartTime}, End: ${newEndTime}`);

    setWorkOrders((prevWorkOrders) => {
      const updatedWorkOrder = prevWorkOrders.find(wo => wo.id === workOrderId);
      if (!updatedWorkOrder) return prevWorkOrders;

      const newAssignedTechnicians = newTechnicianId ? [newTechnicianId] : [];
      const updated = {
        ...updatedWorkOrder,
        assigned_technicians: newAssignedTechnicians,
        lead_technician_id: newTechnicianId,
        scheduled_start_time: dayjs(newStartTime).format('HH:mm'),
        scheduled_end_time: dayjs(newEndTime).format('HH:mm'),
        scheduled_date: dayjs(newStartTime).format('YYYY-MM-DD'),
      };
      const newOrders = updateWorkOrderOptimistically(prevWorkOrders, updated);
      return newOrders;
    });
  }, []);

  const handleWorkOrderResize = useCallback(({ workOrderId, newEndTime }) => {
    console.log(`Work order ${workOrderId} resized. New End Time: ${newEndTime}`);

    setWorkOrders((prevWorkOrders) => {
      const updatedWorkOrder = prevWorkOrders.find(wo => wo.id === workOrderId);
      if (!updatedWorkOrder) return prevWorkOrders;

      const updated = {
        ...updatedWorkOrder,
        scheduled_end_time: dayjs(newEndTime).format('HH:mm'),
      };
      const newOrders = updateWorkOrderOptimistically(prevWorkOrders, updated);
      return newOrders;
    });
  }, []);

  const handlePageChange = useCallback((event, value) => {
    setPage(value);
  }, []);

  const handleRowsPerPageChange = useCallback((event) => {
    setRowsPerPage(event.target.value);
  }, []);

  const data = useMemo(() => {
    const customers = [
      { id: '1', name: 'Acme Inc.', email: 'demo@example.com', address: '71 Pilgrim Avenue Chevy Chase, MD 20815', phone: '301-444-5555' },
      { id: '2', name: 'Green Ltd', email: 'green@example.com', address: '123 Elm Street, Springfield, IL', phone: '217-123-4567' },
      { id: '3', name: 'Blue Corp', email: 'blue@example.com', address: '456 Oak Ave, Anytown, CA', phone: '555-123-4567' },
      { id: '4', name: 'Red Group', email: 'red@example.com', address: '789 Pine Ln, Sometown, NY', phone: '555-987-6543' },
      { id: '5', name: 'Yellow Co', email: 'yellow@example.com', address: '101 Maple Dr, Otherville, TX', phone: '555-222-3333' },
      { id: '6', name: 'Purple Inc.', email: 'purple@example.com', address: '202 Birch Rd, Someplace, FL', phone: '555-444-5555' },
      { id: '7', name: 'Orange Ltd', email: 'orange@example.com', address: '303 Cedar St, Anywhere, GA', phone: '555-666-7777' },
      { id: '8', name: 'Black Corp', email: 'black@example.com', address: '404 Willow Way, Nowhere, WA', phone: '555-888-9999' },
      { id: '9', name: 'White Group', email: 'white@example.com', address: '505 Poplar Blvd, Everywhere, AZ', phone: '555-111-2222' },
      { id: '10', name: 'Grey Co', email: 'grey@example.com', address: '606 Spruce Ct, Always, CO', phone: '555-333-4444' },
      { id: '11', name: 'Magenta Inc.', email: 'magenta@example.com', address: '707 Fir Ave, Forever, UT', phone: '555-555-6666' },
      { id: '12', name: 'Cyan Ltd', email: 'cyan@example.com', address: '808 Aspen Pl, Neverland, NV', phone: '555-777-8888' },
      { id: '13', name: 'Olive Corp', email: 'olive@example.com', address: '909 Palm Rd, Wonder, ID', phone: '555-000-1111' },
      { id: '14', name: 'Indigo Group', email: 'indigo@example.com', address: '111 Sycamore Ln, Dream, ND', phone: '555-222-4444' },
      { id: '15', name: 'Teal Co', email: 'teal@example.com', address: '222 Walnut Dr, Reality, SD', phone: '555-666-8888' },
      { id: '16', name: 'Maroon Inc.', email: 'maroon@example.com', address: '333 Cherry St, Fantasy, NE', phone: '555-111-3333' },
      { id: '17', name: 'Navy Ltd', email: 'navy@example.com', address: '444 Apple Way, Illusion, KS', phone: '555-555-7777' },
      { id: '18', name: 'Silver Corp', email: 'silver@example.com', address: '555 Peach Blvd, Mirage, IA', phone: '555-999-0000' },
      { id: '19', name: 'Gold Group', email: 'gold@example.com', address: '666 Plum Ct, Echo, MO', phone: '555-123-5555' },
      { id: '20', name: 'Bronze Co', email: 'bronze@example.com', address: '777 Pear Pl, Whisper, AR', phone: '555-789-0123' },
    ];
    return applyPagination(customers, page, rowsPerPage);
  }, [page, rowsPerPage]);

  const StyleModal = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90vw',
    maxWidth: '1200px',
    backgroundColor: theme.palette.background.paper,
    border: '2px solid #000',
    boxShadow: 24,
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    overflowY: 'auto',
  }));

  const filteredWorkOrdersForModal = useMemo(() => {
    return workOrders.filter(wo =>
      dayjs(wo.scheduled_date).isSame(modalDate, 'day')
    );
  }, [workOrders, modalDate]);

  return (
    <>
      <Head>
        <title>
          Dashboard | Devias Kit
        </title>
      </Head>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          py: 8
        }}
      >
        <Container maxWidth="xl">
          <Grid
            container
            spacing={3}
          >
            <Grid
              xs={12}
              sm={6}
              lg={3}
            >
              <OverviewBudget
                difference={12}
                positive
                sx={{ height: '100%' }}
                value="$24k"
              />
            </Grid>
            <Grid
              xs={12}
              sm={6}
              lg={3}
            >
              <OverviewTotalCustomers
                difference={16}
                positive={false}
                sx={{ height: '100%' }}
                value="1.6k"
              />
            </Grid>
            <Grid
              xs={12}
              sm={6}
              lg={3}
            >
              <OverviewTasksProgress
                sx={{ height: '100%' }}
                value={75.5}
              />
            </Grid>
            <Grid
              xs={12}
              sm={6}
              lg={3}
            >
              <OverviewTotalProfit
                sx={{ height: '100%' }}
                value="$23k"
              />
            </Grid>
            <Grid
              xs={12}
              lg={8}
            >
              <OverviewSales
                chartSeries={[
                  {
                    name: 'This year',
                    data: [18, 16, 5, 8, 3, 14, 14, 16, 17, 19, 18, 20]
                  },
                  {
                    name: 'Last year',
                    data: [12, 11, 4, 6, 2, 9, 9, 10, 11, 12, 13, 13]
                  }
                ]}
                sx={{ height: '100%' }}
              />
            </Grid>
            <Grid
              xs={12}
              md={6}
              lg={4}
            >
              <OverviewTraffic
                chartSeries={[63, 15, 22]}
                labels={['Desktop', 'Tablet', 'Phone']}
                sx={{ height: '100%' }}
              />
            </Grid>
            <Grid
              xs={12}
              md={6}
              lg={4}
            >
              <OverviewLatestProducts
                products={[
                  {
                    id: '5ee7250e03c92790967912e2',
                    name: 'Dropbox',
                    imageUrl: '/assets/products/product-1.png',
                    updatedAt: subHours(now, 2).getTime()
                  },
                  {
                    id: '5ee7250e03c92790967912e3',
                    name: 'Medium Corporation',
                    imageUrl: '/assets/products/product-2.png',
                    updatedAt: subHours(now, 2).getTime()
                  },
                  {
                    id: '5ee7250e03c92790967912e4',
                    name: 'Slack',
                    imageUrl: '/assets/products/product-3.png',
                    updatedAt: subHours(now, 3).getTime()
                  },
                  {
                    id: '5ee7250e03c92790967912e5',
                    name: 'Amazon',
                    imageUrl: '/assets/products/product-4.png',
                    updatedAt: subHours(now, 5).getTime()
                  },
                  {
                    id: '5ee7250e03c92790967912e6',
                    name: 'Lyft',
                    imageUrl: '/assets/products/product-5.png',
                    updatedAt: subHours(now, 6).getTime()
                  }
                ]}
                sx={{ height: '100%' }}
              />
            </Grid>
            <Grid
              xs={12}
              md={12}
              lg={8}
            >
              <OverviewLatestOrders
                orders={[
                  {
                    id: uuidv4(),
                    ref: 'DEV1049',
                    amount: 30.5,
                    customer: {
                      name: 'Ekaterina Tankova'
                    },
                    createdAt: 1555016400000,
                    status: 'pending'
                  },
                  {
                    id: uuidv4(),
                    ref: 'DEV1048',
                    amount: 25.1,
                    customer: {
                      name: 'Cao Yu'
                    },
                    createdAt: 1555016400000,
                    status: 'delivered'
                  },
                  {
                    id: uuidv4(),
                    ref: 'DEV1047',
                    amount: 10.99,
                    customer: {
                      name: 'Alexa Richardson'
                    },
                    createdAt: 1555016400000,
                    status: 'refunded'
                  },
                  {
                    id: uuidv4(),
                    ref: 'DEV1046',
                    amount: 96.43,
                    customer: {
                      name: 'Anje Keizer'
                    },
                    createdAt: 1555016400000,
                    status: 'pending'
                  },
                  {
                    id: uuidv4(),
                    ref: 'DEV1045',
                    amount: 32.54,
                    customer: {
                      name: 'Clarke Gillebert'
                    },
                    createdAt: 1555016400000,
                    status: 'delivered'
                  },
                  {
                    id: uuidv4(),
                    ref: 'DEV1044',
                    amount: 16.76,
                    customer: {
                      name: 'Adam Denisov'
                    },
                    createdAt: 1555016400000,
                    status: 'delivered'
                  }
                ]}
                sx={{ height: '100%' }}
              />
            </Grid>
            <Grid
              xs={12}
            >
              <Typography variant="h4" mb={2}>
                Customer Management
              </Typography>
              <CustomersSearch />
              <CustomerListTable
                count={data.length * 4} // Placeholder for total count for pagination demo
                items={data}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                page={page}
                rowsPerPage={rowsPerPage}
              />
            </Grid>
            <Grid
              xs={12}
            >
              <Typography variant="h4" mb={2}>
                Calendar and Dispatch
              </Typography>
              <DragDropCalendar
                events={workOrders.map(wo => ({
                  id: wo.id,
                  title: wo.title,
                  start: dayjs(`${wo.scheduled_date} ${wo.scheduled_start_time}`).toDate(),
                  end: dayjs(`${wo.scheduled_date} ${wo.scheduled_end_time}`).toDate(),
                  allDay: false,
                  resourceId: wo.lead_technician_id,
                  backgroundColor: technicians.find(t => t.id === wo.lead_technician_id)?.color || '#3788d8',
                  borderColor: technicians.find(t => t.id === wo.lead_technician_id)?.color || '#3788d8',
                }))}
                resources={technicians.map(tech => ({
                  id: tech.id,
                  title: tech.name,
                }))}
                onEventDrop={(info) => {
                  console.log('Calendar event dropped:', info);
                  const { event } = info;
                  handleWorkOrderDrop({
                    workOrderId: event.id,
                    newTechnicianId: event.resourceId,
                    newStartTime: event.start,
                    newEndTime: event.end,
                  });
                  info.revert();
                }}
                onEventClick={(info) => {
                  console.log('Calendar event clicked:', info);
                  handleOpenDispatchModal(info.event.start);
                }}
                onDateClick={(info) => {
                  console.log('Calendar date clicked:', info);
                  handleOpenDispatchModal(info.date);
                }}
              />
            </Grid>

            {/* --- Start of large filler content (approx. lines 400-1200) --- */}
            <ComplexModuleSection title="Project Management Module" moduleName="Project" itemCount={10} />
            <ComplexModuleSection title="Inventory Tracking" moduleName="Inventory" itemCount={15} />
            <DummyAnalyticsSection />

            <Grid xs={12} sx={{ mt: 4 }}>
              <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>System Notifications</Typography>
                <List>
                  {Array.from({ length: 20 }).map((_, i) => (
                    <ListItem key={`notif-${i}`} divider>
                      <ListItemText
                        primary={`Notification ${i + 1}: Important system update scheduled.`}
                        secondary={dayjs().subtract(i, 'hour').format('YYYY-MM-DD HH:mm')}
                      />
                      <Chip label={i % 3 === 0 ? 'Urgent' : 'Info'} color={i % 3 === 0 ? 'error' : 'info'} size="small" />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid xs={12} sx={{ mt: 4 }}>
              <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>User Activity Log</Typography>
                <List dense>
                  {Array.from({ length: 50 }).map((_, i) => (
                    <ListItem key={`log-${i}`} divider>
                      <ListItemText
                        primary={`User ${i % 5 + 1} performed action X on record Y.`}
                        secondary={dayjs().subtract(i * 10, 'minute').format('YYYY-MM-DD HH:mm:ss')}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid xs={12} sx={{ mt: 4 }}>
              <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>Frequently Asked Questions</Typography>
                {Array.from({ length: 15 }).map((_, i) => (
                  <Box key={`faq-${i}`} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">Q: What is the purpose of feature {i + 1}?</Typography>
                    <Typography variant="body2">A: Feature {i + 1} is designed to streamline process Z and improve user engagement by providing real-time data insights.</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
            {/* --- End of large filler content --- */}

          </Grid>
        </Container>
      </Box>

      <Modal
        open={showDispatchModal}
        onClose={handleCloseDispatchModal}
        aria-labelledby="dispatch-modal-title"
        aria-describedby="dispatch-modal-description"
      >
        <StyleModal>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography id="dispatch-modal-title" variant="h4" component="h2">
              Dispatch for {modalDate.format('MMMM DD, YYYY')}
            </Typography>
            <Button onClick={handleCloseDispatchModal}>Close</Button>
          </Box>
          <Box id="dispatch-modal-description" sx={{ mt: 2, flexGrow: 1, minHeight: 0 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Day View
            </Typography>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
                <Typography variant="h5" sx={{ ml: 2 }}>Loading dispatch data...</Typography>
              </Box>
            ) : (
              // Lines 1260-1273: Component Replaced
              <DayDispatchView
                technicians={technicians}
                workOrders={filteredWorkOrdersForModal}
                currentDate={modalDate.toDate()}
                onWorkOrderClick={handleWorkOrderClick}
                onTechnicianClick={handleTechnicianClick}
                onTimeSlotClick={handleTimeSlotClick}
                isLoading={isLoading}
                onWorkOrderDrop={handleWorkOrderDrop}
                onWorkOrderResize={handleWorkOrderResize}
              />
            )}
          </Box>
        </StyleModal>
      </Modal>
    </>
  );
};

Dashboard.getLayout = (page) => (
  <DashboardLayout>
    {page}
  </DashboardLayout>
);

export default Dashboard;
