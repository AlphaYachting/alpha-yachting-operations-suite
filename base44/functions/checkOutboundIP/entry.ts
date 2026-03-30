import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const res = await fetch('https://api.ipify.org?format=json');
  const data = await res.json();
  return Response.json({ outbound_ip: data.ip });
});