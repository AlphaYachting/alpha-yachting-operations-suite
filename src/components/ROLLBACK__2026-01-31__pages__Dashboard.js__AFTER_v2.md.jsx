
import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Assuming axios is used for API calls
import { format, startOfWeek, addWeeks, subWeeks, endOfWeek } from 'date-fns';

// Added direct imports for existing components
import DragDropCalendar from '@/components/schedule/DragDropCalendar';
import DispatchTimeline from '@/components/schedule/DispatchTimeline';

// --- Placeholder for other Dashboard-specific imports ---
// These are included to make the file runnable and demonstrate context.
// In a real application, these would be actual components.
const DashboardCard = ({ title, value, onClick }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
    </div>
);
const RecentActivity = ({ activities }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
        <ul className="space-y-2">
            {activities.length > 0 ? (
                activities.map((activity, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                        {activity.description || `Activity ${index + 1}`}
                    </li>
                ))
            ) : (
                <li className="text-sm text-gray-500">No recent activity.</li>
            )}
        </ul>
    </div>
);
const SalesChart = () => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow h-64 flex items-center justify-center">
        <p className="text-gray-700 dark:text-gray-300">Sales Chart Placeholder</p>
    </div>
);

// Dummy resources often needed by scheduling components
const dummyResources = [
    { id: 'tech-1', name: 'Technician A' },
    { id: 'tech-2', name: 'Technician B' },
    { id: 'tech-3', name: 'Technician C' },
];
// --- End of placeholder imports ---

function Dashboard() {
    // --- Existing Dashboard-specific state variables ---
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Existing showDispatchModal state
    const [showDispatchModal, setShowDispatchModal] = useState(false);

    // --- Added dispatch modal state ---
    const [dispatchMode, setDispatchMode] = useState('calendar'); // 'calendar' or 'day'
    // weekStartsOn: 1 for Monday, 0 for Sunday
    const [dispatchWeekStart, setDispatchWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [dispatchSelectedDate, setDispatchSelectedDate] = useState(new Date());
    const [dispatchGridSize, setDispatchGridSize] = useState(60); // In minutes, e.g., 60 for hourly slots
    const [dispatchInventoryReservations, setDispatchInventoryReservations] = useState([]);
    const [dispatchResources, setDispatchResources] = useState(dummyResources); // Assuming resources are loaded or static

    // --- Existing Dashboard-specific useEffects ---
    useEffect(() => {
        // Fetch main dashboard data
        const fetchDashboardData = async () => {
            try {
                // Placeholder for actual API call
                // const response = await axios.get('/api/dashboard');
                // setDashboardData(response.data);
                setDashboardData({ sales: 10000, activities: [] }); // Mock data
                setIsLoading(false);
            } catch (err) {
                console.error("Error loading dashboard:", err);
                setError(err);
                setIsLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    // --- Added loadDispatchData() function ---
    const loadDispatchData = async (startDate, endDate) => {
        console.log("Loading dispatch inventory reservations from:", format(startDate, 'yyyy-MM-dd'), "to", format(endDate, 'yyyy-MM-dd'));
        try {
            // Placeholder for actual API call to fetch inventory reservations within a date range
            // const response = await axios.get(`/api/dispatch/inventory-reservations?start=${format(startDate, 'yyyy-MM-dd')}&end=${format(endDate, 'yyyy-MM-dd')}`);
            // setDispatchInventoryReservations(response.data);

            // Mock data for demonstration
            const mockEvents = [
                // Example event for the current selected date/week
                {
                    id: 'inv-res-1',
                    resourceId: 'tech-1',
                    start: new Date(dispatchSelectedDate.getFullYear(), dispatchSelectedDate.getMonth(), dispatchSelectedDate.getDate(), 9, 0),
                    end: new Date(dispatchSelectedDate.getFullYear(), dispatchSelectedDate.getMonth(), dispatchSelectedDate.getDate(), 10, 0),
                    title: 'Service Call #101',
                    color: '#4F46E5', // Example color
                },
                {
                    id: 'inv-res-2',
                    resourceId: 'tech-2',
                    start: new Date(dispatchSelectedDate.getFullYear(), dispatchSelectedDate.getMonth(), dispatchSelectedDate.getDate(), 11, 0),
                    end: new Date(dispatchSelectedDate.getFullYear(), dispatchSelectedDate.getMonth(), dispatchSelectedDate.getDate(), 12, 30),
                    title: 'Installation #205',
                    color: '#059669',
                },
                {
                    id: 'inv-res-3',
                    resourceId: 'tech-1',
                    start: addWeeks(new Date(dispatchWeekStart.getFullYear(), dispatchWeekStart.getMonth(), dispatchWeekStart.getDate(), 14, 0), 0),
                    end: addWeeks(new Date(dispatchWeekStart.getFullYear(), dispatchWeekStart.getMonth(), dispatchWeekStart.getDate(), 15, 0), 0),
                    title: 'Maintenance #300',
                    color: '#DC2626',
                },
            ];
            setDispatchInventoryReservations(mockEvents);
        } catch (error) {
            console.error("Failed to load inventory reservations:", error);
            setDispatchInventoryReservations([]);
        }
    };

    // Effect to load dispatch data when the modal opens or its date/mode changes
    useEffect(() => {
        if (showDispatchModal) {
            let startFetchDate = dispatchSelectedDate;
            let endFetchDate = dispatchSelectedDate;

            if (dispatchMode === 'calendar') {
                startFetchDate = dispatchWeekStart;
                endFetchDate = endOfWeek(dispatchWeekStart, { weekStartsOn: 1 });
            }
            // For day mode, startFetchDate and endFetchDate are already dispatchSelectedDate
            loadDispatchData(startFetchDate, endFetchDate);
        }
    }, [showDispatchModal, dispatchMode, dispatchWeekStart, dispatchSelectedDate]);


    // --- Other Dashboard specific functions ---
    const handleWidgetClick = (widgetId) => {
        console.log(`Dashboard widget ${widgetId} clicked`);
    };

    const handleDispatchEventDrop = ({ event, start, end, resourceId }) => {
        console.log(`Event ${event.id} dropped to ${format(start, 'PPPp')} - ${format(end, 'PPPp')} for resource ${resourceId}`);
        // In a real app, you would send an API request to update the event
        setDispatchInventoryReservations(prevEvents =>
            prevEvents.map(ev =>
                ev.id === event.id ? { ...ev, start, end, resourceId } : ev
            )
        );
    };

    const handleDispatchEventResize = ({ event, start, end }) => {
        console.log(`Event ${event.id} resized to ${format(start, 'PPPp')} - ${format(end, 'PPPp')}`);
        // In a real app, you would send an API request to update the event
        setDispatchInventoryReservations(prevEvents =>
            prevEvents.map(ev =>
                ev.id === event.id ? { ...ev, start, end } : ev
            )
        );
    };

    if (isLoading) return <div className="p-4 text-center text-gray-700 dark:text-gray-300">Loading dashboard...</div>;
    if (error) return <div className="p-4 text-center text-red-500">Error loading dashboard: {error.message}</div>;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Dashboard Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <DashboardCard title="Total Sales" value={`$${dashboardData?.sales.toLocaleString() || '0'}`} onClick={() => handleWidgetClick('sales')} />
                <DashboardCard title="New Customers" value="25" onClick={() => handleWidgetClick('customers')} />
                <DashboardCard title="Active Projects" value="12" onClick={() => handleWidgetClick('projects')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <SalesChart />
                </div>
                <div>
                    <RecentActivity activities={dashboardData?.activities || []} />
                </div>
            </div>

            <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="flex flex-wrap gap-4">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add New Order</button>
                    <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">View Reports</button>
                    {/* Existing Dispatch button */}
                    <button
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        onClick={() => {
                            setDispatchMode('calendar'); // Default to calendar when opening
                            setDispatchWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
                            setDispatchSelectedDate(new Date());
                            setShowDispatchModal(true);
                        }}
                    >
                        Open Dispatch Board
                    </button>
                    <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Manage Inventory</button>
                </div>
            </div>

            {/* Replaced DispatchFullscreenModal component with inline fullscreen div */}
            {showDispatchModal && (
                <div className="fixed inset-0 z-[1000] bg-gray-50 dark:bg-gray-950 flex flex-col p-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-center pb-4 mb-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-0">Dispatch Board</h2>
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Mode Switch */}
                            <div className="inline-flex rounded-md shadow-sm">
                                <button
                                    type="button"
                                    className={`px-4 py-2 text-sm font-medium rounded-l-md ${dispatchMode === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    onClick={() => setDispatchMode('calendar')}
                                >
                                    Calendar View
                                </button>
                                <button
                                    type="button"
                                    className={`px-4 py-2 text-sm font-medium rounded-r-md ${dispatchMode === 'day' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    onClick={() => setDispatchMode('day')}
                                >
                                    Day View
                                </button>
                            </div>

                            {/* Navigation for Calendar View */}
                            {dispatchMode === 'calendar' && (
                                <div className="flex items-center space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => setDispatchWeekStart(subWeeks(dispatchWeekStart, 1))}
                                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        &lt;
                                    </button>
                                    <span className="text-lg font-medium text-gray-900 dark:text-white">
                                        {format(dispatchWeekStart, 'MMM dd, yyyy')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setDispatchWeekStart(addWeeks(dispatchWeekStart, 1))}
                                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        &gt;
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDispatchWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                                        className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        Today
                                    </button>
                                </div>
                            )}
                            {/* Navigation for Day View */}
                            {dispatchMode === 'day' && (
                                <div className="flex items-center space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => setDispatchSelectedDate(addWeeks(dispatchSelectedDate, -1))}
                                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        &lt;
                                    </button>
                                    <span className="text-lg font-medium text-gray-900 dark:text-white">
                                        {format(dispatchSelectedDate, 'MMM dd, yyyy')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setDispatchSelectedDate(addWeeks(dispatchSelectedDate, 1))}
                                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        &gt;
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDispatchSelectedDate(new Date())}
                                        className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        Today
                                    </button>
                                </div>
                            )}

                            {/* Close button */}
                            <button
                                onClick={() => setShowDispatchModal(false)}
                                className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                aria-label="Close Dispatch Board"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-grow overflow-hidden relative">
                        {dispatchMode === 'calendar' ? (
                            <DragDropCalendar
                                startDate={dispatchWeekStart}
                                events={dispatchInventoryReservations} // inventoryReservations are the events
                                resources={dispatchResources}
                                onSelectDay={(date) => {
                                    setDispatchSelectedDate(date);
                                    setDispatchMode('day'); // Switch to day view when a day is selected
                                }}
                                onEventDrop={handleDispatchEventDrop}
                                onEventResize={handleDispatchEventResize}
                                // Additional props like onEventClick, eventRender, etc., can be added
                                // Depending on DragDropCalendar's API
                            />
                        ) : (
                            <DispatchTimeline
                                selectedDate={dispatchSelectedDate}
                                gridSize={dispatchGridSize}
                                events={dispatchInventoryReservations} // inventoryReservations are the events
                                resources={dispatchResources}
                                onDateChange={setDispatchSelectedDate}
                                onGridSizeChange={setDispatchGridSize}
                                onEventDrop={handleDispatchEventDrop}
                                onEventResize={handleDispatchEventResize}
                                // Additional props like onEventClick, eventRender, etc., can be added
                                // Depending on DispatchTimeline's API
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
