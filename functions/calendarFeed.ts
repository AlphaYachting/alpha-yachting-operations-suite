import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ICS escape helper - escape special chars per RFC 5545
function escapeICS(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// Line folding at 75 octets per RFC 5545
function foldLine(line) {
  if (line.length <= 75) return line;
  const folded = [];
  let current = line;
  while (current.length > 75) {
    folded.push(current.substring(0, 75));
    current = ' ' + current.substring(75); // Continuation with space
  }
  folded.push(current);
  return folded.join('\r\n');
}

// Format date-time for ICS (YYYYMMDDTHHMMSS)
function formatICSDateTime(date, time) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const timeStr = time || '080000'; // Default 08:00:00
  const [hours, minutes] = timeStr.split(':');
  return `${year}${month}${day}T${hours}${minutes}00`;
}

// Format date only for ICS (YYYYMMDD)
function formatICSDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Calculate end time from start + duration
function calculateEndTime(startDate, startTime, durationHours) {
  const [hours, minutes] = (startTime || '08:00').split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + Math.round((durationHours || 2) * 60);
  const endHours = Math.floor(endMinutes / 60) % 24;
  const endMins = endMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  let queryCount = 0;

  try {
    // Initialize base44 with service role (public endpoint)
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    
    // Parse query params
    const token = url.searchParams.get('token');
    const techId = url.searchParams.get('tech');
    const daysParam = parseInt(url.searchParams.get('days') || '90');
    const days = Math.min(Math.max(daysParam, 7), 180); // Clamp between 7-180
    const includeUnassigned = url.searchParams.get('include_unassigned') === 'true';
    
    // Token validation - REQUIRED
    if (!token) {
      return Response.json({
        error: 'Missing token',
        message: 'Feed access requires a valid token parameter. Generate one in Settings > Calendar Feeds.'
      }, { status: 401 });
    }
    
    // Validate token and get config
    const feedConfigs = await base44.asServiceRole.entities.CalendarFeedConfig.filter({ 
      feed_token: token,
      enabled: true
    });
    queryCount++;
    
    if (feedConfigs.length === 0) {
      return Response.json({
        error: 'Invalid or disabled token',
        message: 'This feed token is not valid or has been disabled.'
      }, { status: 403 });
    }
    
    const feedConfig = feedConfigs[0];
    
    // Update access tracking
    await base44.asServiceRole.entities.CalendarFeedConfig.update(feedConfig.id, {
      last_accessed: new Date().toISOString(),
      access_count: (feedConfig.access_count || 0) + 1
    });
    
    // Use config settings if not overridden by query params
    const effectiveTechId = techId || feedConfig.technician_id;
    const effectiveDays = url.searchParams.has('days') ? days : (feedConfig.time_window_days || 90);
    const effectiveIncludeUnassigned = url.searchParams.has('include_unassigned') ? includeUnassigned : (feedConfig.include_unassigned || false);
    
    // Calculate date window
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 7);
    const toDate = new Date(today);
    toDate.setDate(today.getDate() + (effectiveDays - 7));
    
    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];
    
    // Query WorkOrders with date range and status filter
    const woQuery = {
      scheduled_date: { $gte: fromDateStr, $lte: toDateStr },
      status: { $nin: ['Completed', 'Cancelled'] }
    };
    
    const workOrders = await base44.asServiceRole.entities.WorkOrder.filter(woQuery);
    queryCount++;
    
    // Filter by technician if specified
    let filteredWOs = workOrders;
    if (effectiveTechId) {
      filteredWOs = workOrders.filter(wo => {
        const assignedTechs = wo.assigned_technicians || [];
        return assignedTechs.includes(effectiveTechId) || wo.lead_technician_id === effectiveTechId;
      });
    } else if (!effectiveIncludeUnassigned) {
      // Exclude unassigned if not explicitly requested
      filteredWOs = workOrders.filter(wo => {
        const assignedTechs = wo.assigned_technicians || [];
        return assignedTechs.length > 0 || wo.lead_technician_id;
      });
    }
    
    // Fetch related data (Jobs, then Boats/Customers/Locations)
    const jobIds = [...new Set(filteredWOs.map(wo => wo.job_id).filter(Boolean))];
    let jobs = [];
    let boats = [];
    let customers = [];
    let locations = [];
    
    if (jobIds.length > 0) {
      jobs = await base44.asServiceRole.entities.Job.filter({ id: { $in: jobIds } });
      queryCount++;
      
      const boatIds = [...new Set(jobs.map(j => j.boat_id).filter(Boolean))];
      const customerIds = [...new Set(jobs.map(j => j.customer_id).filter(Boolean))];
      const locationIds = [...new Set(jobs.map(j => j.location_id).filter(Boolean))];
      
      [boats, customers, locations] = await Promise.all([
        boatIds.length > 0 ? base44.asServiceRole.entities.Boat.filter({ id: { $in: boatIds } }) : Promise.resolve([]),
        customerIds.length > 0 ? base44.asServiceRole.entities.Customer.filter({ id: { $in: customerIds } }) : Promise.resolve([]),
        locationIds.length > 0 ? base44.asServiceRole.entities.Location.filter({ id: { $in: locationIds } }) : Promise.resolve([])
      ]);
      queryCount += 3;
    }
    
    // Helper to get related entities
    const getJobData = (jobId) => {
      const job = jobs.find(j => j.id === jobId);
      if (!job) return { customer: '', boat: '', location: '', locationAddr: '' };
      
      const customer = customers.find(c => c.id === job.customer_id);
      const boat = boats.find(b => b.id === job.boat_id);
      const location = locations.find(l => l.id === job.location_id);
      
      return {
        customer: customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown Customer',
        boat: boat?.vessel_name || '',
        location: location?.name || '',
        locationAddr: location?.address || ''
      };
    };
    
    // Get APP_DOMAIN from environment
    const appDomain = Deno.env.get('APP_DOMAIN') || 'app.base44.com';
    
    // Build ICS file
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Alpha Yachting//Schedule Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Alpha Yachting Schedule',
      'X-WR-TIMEZONE:Europe/Zagreb'
    ];
    
    // Generate VEVENT for each WorkOrder
    for (const wo of filteredWOs) {
      const jobData = getJobData(wo.job_id);
      
      // Build SUMMARY
      const woNumber = wo.work_order_number || 'WO';
      const boatSuffix = jobData.boat ? ` — ${jobData.boat}` : '';
      const summary = escapeICS(`${woNumber} — ${wo.title}${boatSuffix}`);
      
      // Build DESCRIPTION with deep link
      const deepLink = `https://${appDomain}/WorkOrderDetail?id=${wo.id}`;
      const descParts = [
        `Customer: ${jobData.customer}`,
        jobData.boat ? `Boat: ${jobData.boat}` : null,
        jobData.location ? `Location: ${jobData.location}` : null,
        '',
        wo.description ? escapeICS(wo.description) : null,
        '',
        `View Details: ${deepLink}`
      ].filter(Boolean);
      const description = descParts.join('\\n');
      
      // Calculate DTSTART
      const startDate = wo.scheduled_date;
      const startTime = wo.scheduled_start_time || '08:00';
      const dtstart = formatICSDateTime(startDate, startTime);
      
      // Calculate DTEND
      let dtend;
      if (wo.scheduled_end_date && wo.scheduled_end_time) {
        dtend = formatICSDateTime(wo.scheduled_end_date, wo.scheduled_end_time);
      } else if (wo.scheduled_end_time) {
        dtend = formatICSDateTime(startDate, wo.scheduled_end_time);
      } else {
        const endTime = calculateEndTime(startDate, startTime, wo.estimated_duration_hours || 2);
        dtend = formatICSDateTime(startDate, endTime);
      }
      
      // Map status
      const statusMap = {
        'Draft': 'TENTATIVE',
        'Scheduled': 'TENTATIVE',
        'Dispatched': 'TENTATIVE',
        'In Transit': 'TENTATIVE',
        'In Progress': 'CONFIRMED',
        'Paused': 'TENTATIVE',
        'Waiting for Parts': 'TENTATIVE',
        'Waiting for Approval': 'TENTATIVE'
      };
      const status = statusMap[wo.status] || 'TENTATIVE';
      
      // Build location string
      const locationStr = [jobData.location, jobData.locationAddr].filter(Boolean).join(', ');
      
      // Generate VEVENT
      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:${wo.id}@${appDomain}`);
      icsLines.push(`DTSTAMP:${formatICSDateTime(new Date().toISOString().split('T')[0], '00:00')}`);
      icsLines.push(`DTSTART:${dtstart}`);
      icsLines.push(`DTEND:${dtend}`);
      icsLines.push(foldLine(`SUMMARY:${summary}`));
      icsLines.push(foldLine(`DESCRIPTION:${description}`));
      if (locationStr) {
        icsLines.push(foldLine(`LOCATION:${escapeICS(locationStr)}`));
      }
      if (wo.service_area) {
        icsLines.push(`CATEGORIES:${escapeICS(wo.service_area)}`);
      }
      icsLines.push(`STATUS:${status}`);
      icsLines.push('CLASS:PUBLIC');
      icsLines.push('END:VEVENT');
    }
    
    icsLines.push('END:VCALENDAR');
    
    const icsContent = icsLines.join('\r\n');
    const elapsedMs = Date.now() - startTime;
    
    // Add performance headers
    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="alpha-yachting-schedule.ics"',
        'X-Event-Count': String(filteredWOs.length),
        'X-Query-Count': String(queryCount),
        'X-Generation-Time-Ms': String(elapsedMs),
        'Cache-Control': 'no-cache, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Calendar feed error:', error);
    return Response.json({
      error: 'Failed to generate calendar feed',
      message: error.message
    }, { status: 500 });
  }
});