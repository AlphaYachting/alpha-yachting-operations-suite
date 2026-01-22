import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Jobs from './pages/Jobs';
import Boats from './pages/Boats';
import Locations from './pages/Locations';
import WorkOrders from './pages/WorkOrders';
import Technicians from './pages/Technicians';
import Inventory from './pages/Inventory';
import Schedule from './pages/Schedule';
import Reports from './pages/Reports';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Customers": Customers,
    "Jobs": Jobs,
    "Boats": Boats,
    "Locations": Locations,
    "WorkOrders": WorkOrders,
    "Technicians": Technicians,
    "Inventory": Inventory,
    "Schedule": Schedule,
    "Reports": Reports,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};