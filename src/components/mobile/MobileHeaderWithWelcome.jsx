import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import MobileSearchBar from './MobileSearchBar';

export default function MobileHeaderWithWelcome({ user, taskCount, onSettingsClick, showSettings, onNavigate, workOrders, jobs, boats, locations, customers, tasks }) {
  const [config, setConfig] = React.useState(null);

  React.useEffect(() => {
    base44.entities.MobileHeaderConfig.list().then(configs => {
      if (configs.length > 0) setConfig(configs[0]);
    }).catch(() => {});
  }, []);

  const now = new Date();
  const timeString = format(now, 'HH:mm');
  const dateString = format(now, 'EEE, MMM d');

  const layout = config?.layout || {
    logoPosition: 'left',
    logoHeight: 58,
    timePosition: 'center',
    tasksPosition: 'right',
    flexDirection: 'row',
    padding: { x: 16, y: 16 },
    gap: 16,
    elementsOrder: ['logo', 'time', 'tasks']
  };

  const styling = config?.styling || {
    backgroundColor: 'from-blue-600 via-blue-500 to-cyan-500',
    welcomeBackground: 'bg-white/15',
    borderRadius: 'rounded-lg',
    headerHeight: 140
  };

  const elements = {
    logo:
    <img
      key="logo"
      src="https://media.base44.com/images/public/6972766f1bd9af32693610c1/c3c933943_alpha-yachting-logo-weiss-ohnepremiumsolutions.png"
      alt="Alpha Yachting" className="mr-1 mb-1 ml-4 object-contain flex-shrink-0"
      style={{ height: layout.logoHeight }} />,
    time:
    <div key="time" className="flex-1">
        <p className="text-2xl md:text-3xl font-bold font-mono leading-none">{timeString}</p>
        <p className="text-xs text-blue-100">{dateString}</p>
      </div>,
    tasks:
    <div key="tasks" className="bg-white/20 px-4 py-1 rounded-full">
        <p className="text-white px-1 text-2xl font-bold md:text-3xl">{taskCount}</p>
        <p className="text-xs text-blue-100">tasks</p>
      </div>
  };

  const orderedElements = layout.elementsOrder.map((key) => elements[key]);

  return (
    <div className={`bg-gradient-to-br ${config?.styling?.backgroundColor || 'from-blue-600 via-blue-500 to-cyan-500'} text-white shadow-xl`}>
      {/* Header Top Row - Logo, Time, Tasks Count */}
      <div
        className="relative"
        style={{
          height: `${styling.headerHeight}px`,
          display: 'flex',
          flexDirection: layout.flexDirection,
          padding: `${layout.padding.y}px ${layout.padding.x}px`,
          gap: layout.gap,
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>

        <div
         style={{
           display: 'flex',
           flexDirection: layout.flexDirection,
           gap: layout.gap,
           alignItems: 'center',
           justifyContent: 'flex-start',
           width: '100%'
         }}>

         {orderedElements}
        </div>
        {user?.role === 'admin' &&
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          className="absolute top-2 right-2 h-7 w-7 hover:bg-white/20 flex-shrink-0">

            <Settings className="h-4 w-4" />
          </Button>
        }
      </div>

      {/* Search Bar */}
      <MobileSearchBar onNavigate={onNavigate} workOrders={workOrders} jobs={jobs} boats={boats} locations={locations} customers={customers} tasks={tasks} />
    </div>);

}