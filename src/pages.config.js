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
import ExcelImport from './pages/ExcelImport';
import Settings from './pages/Settings';
import ImportDiagnostics from './pages/ImportDiagnostics';
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
    "ExcelImport": ExcelImport,
    "Settings": Settings,
    "ImportDiagnostics": ImportDiagnostics,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};