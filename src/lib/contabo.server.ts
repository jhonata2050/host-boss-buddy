import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getContaboToken() {
  const { data: settingsData } = await supabaseAdmin
      .from("system_settings")
      .select("*");
  
  const settings: Record<string, any> = {};
  settingsData?.forEach(s => {
    settings[s.key] = s.value;
  });
  
  const clientId = settings['contabo_client_id'] || process.env['CONTABO_CLIENT_ID'];
  const clientSecret = settings['contabo_client_secret'] || process.env['CONTABO_CLIENT_SECRET'];
  const apiUser = settings['contabo_api_user'] || process.env['CONTABO_API_USER'];
  const apiPass = settings['contabo_api_password'] || process.env['CONTABO_API_PASSWORD'];

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
  const authResponse = await res.json() as { access_token: string };
  return authResponse.access_token;
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
  const { data: vpsData, error } = await supabaseAdmin
    .from('vps_instances')
    .select('external_id, service:services(user_id)')
    .eq('id', instanceId)
    .single();

  if (error || !vpsData) {
    throw new Error("Instance not found or unauthorized");
  }

  const vps = vpsData as any;
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
