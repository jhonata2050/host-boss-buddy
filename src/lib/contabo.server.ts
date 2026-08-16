import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getContaboToken() {
  const { getSystemSettings } = await import("./support.functions");
  const settings = await getSystemSettings({ data: undefined });
  
  const clientId = (settings as any)['contabo_client_id'] || process.env['CONTABO_CLIENT_ID'];
  const clientSecret = (settings as any)['contabo_client_secret'] || process.env['CONTABO_CLIENT_SECRET'];
  const apiUser = (settings as any)['contabo_api_user'] || process.env['CONTABO_API_USER'];
  const apiPass = (settings as any)['contabo_api_password'] || process.env['CONTABO_API_PASSWORD'];

  if (!clientId || !clientSecret || !apiUser || !apiPass) {
    throw new Error("Contabo API credentials not configured in Finance Settings");
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('username', apiUser);
  params.append('password', apiPass);

  const res = await fetch('https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token', {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!res.ok) throw new Error("Failed to authenticate with Contabo");
  const data = await res.json();
  return data.access_token;
}

export async function getContaboInstances() {
  const token = await getContaboToken();
  const res = await fetch('https://api.contabo.com/v1/compute/instances', {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'x-request-id': crypto.randomUUID()
    }
  });
  
  if (!res.ok) throw new Error("Failed to fetch Contabo instances");
  return res.json();
}

export async function performContaboAction(instanceId: string, action: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('vps_instances')
    .select('external_id, service:services(user_id)')
    .eq('id', instanceId)
    .single();

  if (error || !data) {
    throw new Error("Instance not found or unauthorized");
  }

  const vps = data as any;
  if (vps.service.user_id !== userId) {
    throw new Error("Unauthorized access to instance");
  }

  const token = await getContaboToken();
  const contaboAction = action === 'restart' ? 'reboot' : action;
  
  const res = await fetch(`https://api.contabo.com/v1/compute/instances/${vps.external_id}/actions/${contaboAction}`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'x-request-id': crypto.randomUUID()
    }
  });

  if (!res.ok) throw new Error(`Failed to perform ${action} on Contabo`);
  return { success: true };
}

export async function provisionContaboVPS(serviceId: string, config: any) {
  console.log("Provisioning Contabo VPS for service:", serviceId);
}
