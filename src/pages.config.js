import BoatDetail from './pages/BoatDetail';
import Boats from './pages/Boats';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import ExcelImport from './pages/ExcelImport';
import ImportDiagnostics from './pages/ImportDiagnostics';
import Inventory from './pages/Inventory';
import JobDetail from './pages/JobDetail';
import Jobs from './pages/Jobs';
import Locations from './pages/Locations';
import Reports from './pages/Reports';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import TasklistImport from './pages/TasklistImport';
import Technicians from './pages/Technicians';
import WorkOrders from './pages/WorkOrders';
import Offers from './pages/Offers';
import Invoices from './pages/Invoices';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BoatDetail": BoatDetail,
    "Boats": Boats,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "ExcelImport": ExcelImport,
    "ImportDiagnostics": ImportDiagnostics,
    "Inventory": Inventory,
    "JobDetail": JobDetail,
    "Jobs": Jobs,
    "Locations": Locations,
    "Reports": Reports,
    "Schedule": Schedule,
    "Settings": Settings,
    "TasklistImport": TasklistImport,
    "Technicians": Technicians,
    "WorkOrders": WorkOrders,
    "Offers": Offers,
    "Invoices": Invoices,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};