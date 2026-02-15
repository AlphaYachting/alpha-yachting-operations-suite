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
import AccessLogs from './pages/AccessLogs';
import BoatDetail from './pages/BoatDetail';
import Boats from './pages/Boats';
import CustomerBoatDetail from './pages/CustomerBoatDetail';
import CustomerBoatDetailSimulate from './pages/CustomerBoatDetailSimulate';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerDetail from './pages/CustomerDetail';
import CustomerJobDetail from './pages/CustomerJobDetail';
import CustomerPortal from './pages/CustomerPortal';
import CustomerPortalSimulate from './pages/CustomerPortalSimulate';
import CustomerPortalTest from './pages/CustomerPortalTest';
import CustomerProjectDetail from './pages/CustomerProjectDetail';
import CustomerProjectDetailSimulate from './pages/CustomerProjectDetailSimulate';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import DatabaseBackup from './pages/DatabaseBackup';
import Inventory from './pages/Inventory';
import InventoryDashboard from './pages/InventoryDashboard';
import InventoryExportSchema from './pages/InventoryExportSchema';
import InventoryImport from './pages/InventoryImport';
import InvoiceDetail from './pages/InvoiceDetail';
import Invoices from './pages/Invoices';
import JobDetail from './pages/JobDetail';
import Jobs from './pages/Jobs';
import LeadDetail from './pages/LeadDetail';
import Leads from './pages/Leads';
import LeadsV2 from './pages/LeadsV2';
import Locations from './pages/Locations';
import MobileHeaderEditor from './pages/MobileHeaderEditor';
import NewCaseWizard from './pages/NewCaseWizard';
import NotificationPreferences from './pages/NotificationPreferences';
import NotificationSimulator from './pages/NotificationSimulator';
import OfferDetail from './pages/OfferDetail';
import OfferTemplateDetail from './pages/OfferTemplateDetail';
import OfferTemplates from './pages/OfferTemplates';
import Offers from './pages/Offers';
import PDFExportDebugger from './pages/PDFExportDebugger';
import PDFLayoutEditor from './pages/PDFLayoutEditor';
import PDFTemplateManager from './pages/PDFTemplateManager';
import PDFTemplateSettings from './pages/PDFTemplateSettings';
import PrintDocument from './pages/PrintDocument';
import ProjectIntelligence from './pages/ProjectIntelligence';
import Reports from './pages/Reports';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import StandardizeWorkOrders from './pages/StandardizeWorkOrders';
import TaskTemplates from './pages/TaskTemplates';
import TasklistImport from './pages/TasklistImport';
import TeamCalendar from './pages/TeamCalendar';
import TeamMobileHome from './pages/TeamMobileHome';
import TeamOrderDetail from './pages/TeamOrderDetail';
import TeamOrders from './pages/TeamOrders';
import TeamTaskDetail from './pages/TeamTaskDetail';
import TeamWorkOrderDetail from './pages/TeamWorkOrderDetail';
import Technicians from './pages/Technicians';
import TemplateDetail from './pages/TemplateDetail';
import UnitSettingsPage from './pages/UnitSettingsPage';
import VehicleDetail from './pages/VehicleDetail';
import Vehicles from './pages/Vehicles';
import WorkOrderDetail from './pages/WorkOrderDetail';
import WorkOrders from './pages/WorkOrders';
import WorkshopDisplay from './pages/WorkshopDisplay';
import InviteAccept from './pages/InviteAccept';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccessLogs": AccessLogs,
    "BoatDetail": BoatDetail,
    "Boats": Boats,
    "CustomerBoatDetail": CustomerBoatDetail,
    "CustomerBoatDetailSimulate": CustomerBoatDetailSimulate,
    "CustomerDashboard": CustomerDashboard,
    "CustomerDetail": CustomerDetail,
    "CustomerJobDetail": CustomerJobDetail,
    "CustomerPortal": CustomerPortal,
    "CustomerPortalSimulate": CustomerPortalSimulate,
    "CustomerPortalTest": CustomerPortalTest,
    "CustomerProjectDetail": CustomerProjectDetail,
    "CustomerProjectDetailSimulate": CustomerProjectDetailSimulate,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "DatabaseBackup": DatabaseBackup,
    "Inventory": Inventory,
    "InventoryDashboard": InventoryDashboard,
    "InventoryExportSchema": InventoryExportSchema,
    "InventoryImport": InventoryImport,
    "InvoiceDetail": InvoiceDetail,
    "Invoices": Invoices,
    "JobDetail": JobDetail,
    "Jobs": Jobs,
    "LeadDetail": LeadDetail,
    "Leads": Leads,
    "LeadsV2": LeadsV2,
    "Locations": Locations,
    "MobileHeaderEditor": MobileHeaderEditor,
    "NewCaseWizard": NewCaseWizard,
    "NotificationPreferences": NotificationPreferences,
    "NotificationSimulator": NotificationSimulator,
    "OfferDetail": OfferDetail,
    "OfferTemplateDetail": OfferTemplateDetail,
    "OfferTemplates": OfferTemplates,
    "Offers": Offers,
    "PDFExportDebugger": PDFExportDebugger,
    "PDFLayoutEditor": PDFLayoutEditor,
    "PDFTemplateManager": PDFTemplateManager,
    "PDFTemplateSettings": PDFTemplateSettings,
    "PrintDocument": PrintDocument,
    "ProjectIntelligence": ProjectIntelligence,
    "Reports": Reports,
    "Schedule": Schedule,
    "Settings": Settings,
    "StandardizeWorkOrders": StandardizeWorkOrders,
    "TaskTemplates": TaskTemplates,
    "TasklistImport": TasklistImport,
    "TeamCalendar": TeamCalendar,
    "TeamMobileHome": TeamMobileHome,
    "TeamOrderDetail": TeamOrderDetail,
    "TeamOrders": TeamOrders,
    "TeamTaskDetail": TeamTaskDetail,
    "TeamWorkOrderDetail": TeamWorkOrderDetail,
    "Technicians": Technicians,
    "TemplateDetail": TemplateDetail,
    "UnitSettingsPage": UnitSettingsPage,
    "VehicleDetail": VehicleDetail,
    "Vehicles": Vehicles,
    "WorkOrderDetail": WorkOrderDetail,
    "WorkOrders": WorkOrders,
    "WorkshopDisplay": WorkshopDisplay,
    "InviteAccept": InviteAccept,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};