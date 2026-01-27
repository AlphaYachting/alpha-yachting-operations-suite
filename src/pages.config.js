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