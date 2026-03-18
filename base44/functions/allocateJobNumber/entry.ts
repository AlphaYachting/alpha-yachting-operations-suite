import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch recent jobs to find max existing canonical number
    const recentJobs = await base44.entities.Job.list('-created_date', 100);

    // Extract and validate numbers matching canonical format J00001
    const validNumbers = recentJobs
      .map(j => j.job_number)
      .filter(num => num && /^J\d{5}$/.test(num))
      .map(num => parseInt(num.substring(1), 10))
      .filter(num => !isNaN(num));

    const maxNumber = validNumbers.length > 0 ? Math.max(...validNumbers) : 0;
    let nextNumber = maxNumber + 1;

    // Collision check loop
    const MAX_RETRIES = 5;
    let attempt = 0;
    let candidate = '';

    while (attempt < MAX_RETRIES) {
      candidate = `J${String(nextNumber).padStart(5, '0')}`;

      const collision = await base44.entities.Job.filter({ job_number: candidate });

      if (collision.length === 0) {
        return Response.json({
          job_number: candidate,
          allocated_number: nextNumber,
          max_existing: maxNumber,
          retries: attempt,
          timestamp: new Date().toISOString()
        });
      }

      console.warn(`Collision detected for ${candidate}, retrying...`);
      nextNumber++;
      attempt++;
    }

    return Response.json({
      error: `Unable to allocate unique Job number after ${MAX_RETRIES} retries`,
      last_attempt: candidate
    }, { status: 500 });

  } catch (error) {
    console.error('Error allocating job number:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});