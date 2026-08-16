import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getContaboToken() {
  const { data: settingsData } = await supabaseAdmin
      .from("system_settings")
      .select("*");
  
  const settings: Record<string, string> = {};
  settingsData?.forEach(s => {
    settings[s.key] = typeof s.value === 'string' ? s.value.trim() : String(s.value ?? '').trim();
  });
  
  const clientId = settings['contabo_client_id'] || process.env['CONTABO_CLIENT_ID'];
  const clientSecret = settings['contabo_client_secret'] || process.env['CONTABO_CLIENT_SECRET'];
  const apiUser = settings['contabo_api_user'] || process.env['CONTABO_API_USER'];
  const apiPass = settings['contabo_api_password'] || process.env['CONTABO_API_PASSWORD'];

  if (!clientId || !clientSecret || !apiUser || !apiPass) {
    throw new Error("Credenciais da API Contabo não configuradas em Admin > Financeiro.");
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('username', apiUser);
  params.append('password', apiPass);

  console.log("[Contabo] Tentando obter token para o usuário:", apiUser);

  const res = await fetch('https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token', {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!res.ok) {
    let detail = '';
    let errorBody: any = null;
    try {
      errorBody = await res.json();
      detail = errorBody.error_description || errorBody.error || '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    
    console.error(`[Contabo] Erro na autenticação (${res.status}):`, detail);
    
    if (detail.toLowerCase().includes('invalid user credentials') || (errorBody && errorBody.error === 'invalid_grant')) {
      throw new Error(
        "Contabo recusou as credenciais (usuário/senha da API inválidos). No Painel do Cliente Contabo, em 'API', use o E-mail da API e a Senha da API (não a senha da sua conta), e confira o Client ID/Secret."
      );
    }
    throw new Error(`Falha ao autenticar na Contabo (${res.status})${detail ? `: ${detail}` : ''}`);
  }
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
  
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    console.error(`[Contabo] Erro ao buscar instâncias (${res.status}):`, errorText);
    throw new Error(`Falha ao buscar instâncias na Contabo (${res.status})`);
  }
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

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    console.error(`[Contabo] Erro na ação ${action} (${res.status}):`, errorText);
    throw new Error(`Falha ao executar ${action} na Contabo (${res.status})`);
  }
  return { success: true };
}

export async function getContaboProductTypes() {
  try {
    const token = await getContaboToken();
    console.log("[Contabo] Buscando catálogo de produtos...");
    
    // API Contabo requer paginação ou limite alto para retornar todos
    const res = await fetch('https://api.contabo.com/v1/compute/instances/products?size=100', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'x-request-id': crypto.randomUUID()
      }
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error(`[Contabo] Erro ao buscar produtos (${res.status}):`, errorText);
      
      // Se for 400, pode ser que o parâmetro size não seja suportado ou algo na query
      if (res.status === 400) {
        console.log("[Contabo] Tentando busca sem parâmetros...");
        const retryRes = await fetch('https://api.contabo.com/v1/compute/instances/products', {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'x-request-id': crypto.randomUUID()
          }
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          return retryData.data || [];
        }
      }
      
      throw new Error(`Falha ao buscar tipos de produtos na Contabo (${res.status}): ${errorText}`);
    }
    const response = await res.json();
    console.log(`[Contabo] ${response.data?.length || 0} produtos encontrados.`);
    return response.data || [];
  } catch (err: any) {
    console.error("[Contabo] Exceção em getContaboProductTypes:", err.message);
    throw err;
  }
}

export async function provisionContaboVPS(serviceId: string, config: any) {
  console.log("Provisioning Contabo VPS for service:", serviceId);
}
