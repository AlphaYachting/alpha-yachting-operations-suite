/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import BoatDetail from './pages/BoatDetail';
import Boats from './pages/Boats';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import ExcelImport from './pages/ExcelImport';
import ImportDiagnostics from './pages/ImportDiagnostics';
import Inventory from './pages/Inventory';
import InvoiceDetail from './pages/InvoiceDetail';
import Invoices from './pages/Invoices';
import JobDetail from './pages/JobDetail';
import Jobs from './pages/Jobs';
import Locations from './pages/Locations';
import MobileHeaderEditor from './pages/MobileHeaderEditor';
import NotificationPreferences from './pages/NotificationPreferences';
import OfferDetail from './pages/OfferDetail';
import Offers from './pages/Offers';
import PDFExportDebugger from './pages/PDFExportDebugger';
import PDFLayoutEditor from './pages/PDFLayoutEditor';
import PDFTemplateManager from './pages/PDFTemplateManager';
import PDFTemplateSettings from './pages/PDFTemplateSettings';
import PrintDocument from './pages/PrintDocument';
import Reports from './pages/Reports';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import TaskTemplates from './pages/TaskTemplates';
import TasklistImport from './pages/TasklistImport';
import TeamMobileHome from './pages/TeamMobileHome';
import TeamOrderDetail from './pages/TeamOrderDetail';
import TeamOrders from './pages/TeamOrders';
import TeamTaskDetail from './pages/TeamTaskDetail';
import TeamWorkOrderDetail from './pages/TeamWorkOrderDetail';
import Technicians from './pages/Technicians';
import TemplateDetail from './pages/TemplateDetail';
import VehicleDetail from './pages/VehicleDetail';
import Vehicles from './pages/Vehicles';
import WorkOrderDetail from './pages/WorkOrderDetail';
import WorkOrders from './pages/WorkOrders';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BoatDetail": BoatDetail,
    "Boats": Boats,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "ExcelImport": ExcelImport,
    "ImportDiagnostics": ImportDiagnostics,
    "Inventory": Inventory,
    "InvoiceDetail": InvoiceDetail,
    "Invoices": Invoices,
    "JobDetail": JobDetail,
    "Jobs": Jobs,
    "Locations": Locations,
    "MobileHeaderEditor": MobileHeaderEditor,
    "NotificationPreferences": NotificationPreferences,
    "OfferDetail": OfferDetail,
    "Offers": Offers,
    "PDFExportDebugger": PDFExportDebugger,
    "PDFLayoutEditor": PDFLayoutEditor,
    "PDFTemplateManager": PDFTemplateManager,
    "PDFTemplateSettings": PDFTemplateSettings,
    "PrintDocument": PrintDocument,
    "Reports": Reports,
    "Schedule": Schedule,
    "Settings": Settings,
    "TaskTemplates": TaskTemplates,
    "TasklistImport": TasklistImport,
    "TeamMobileHome": TeamMobileHome,
    "TeamOrderDetail": TeamOrderDetail,
    "TeamOrders": TeamOrders,
    "TeamTaskDetail": TeamTaskDetail,
    "TeamWorkOrderDetail": TeamWorkOrderDetail,
    "Technicians": Technicians,
    "TemplateDetail": TemplateDetail,
    "VehicleDetail": VehicleDetail,
    "Vehicles": Vehicles,
    "WorkOrderDetail": WorkOrderDetail,
    "WorkOrders": WorkOrders,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};