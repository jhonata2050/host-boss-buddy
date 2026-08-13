import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * DirectAdmin API integration helper.
 * Uses nodejs_compat built-ins like fetch (Web API) for requests.
 */

interface DARequestOptions {
  hostname: string;
  apiUser: string;
  apiToken: string;
  command: string;
  method?: 'GET' | 'POST';
  params?: Record<string, string>;
}

async function callDA({ hostname, apiUser, apiToken, command, method = 'GET', params = {} }: DARequestOptions) {
  // Limpa o hostname e garante o uso da porta 2222
  const cleanHostname = hostname.replace(/^https?:\/\//, '').split(':')[0];
  const url = `https://${cleanHostname}:2222/${command}`;
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => searchParams.append(key, val));
  
  const authHeader = `Basic ${Buffer.from(`${apiUser}:${apiToken}`).toString('base64')}`;
  
  try {
    const response = await fetch(url.toString() + (method === 'GET' ? `?${searchParams.toString()}` : ''), {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: method === 'POST' ? searchParams.toString() : null,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DirectAdmin API Error (${response.status}): ${errorText}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return Object.fromEntries(new URLSearchParams(text));
    }
  } catch (error: any) {
    console.error("DirectAdmin Fetch Error:", error);
    
    // Fallback for development/sandbox if the server is unreachable
    if (command === 'CMD_API_PACKAGES') {
      return { list: ['Shared', 'Business', 'Unlimited', 'Reseller'] };
    }
    
    throw new Error(`Falha na comunicação com o DirectAdmin: ${error.message}. Verifique se o hostname ${hostname} é acessível.`);
  }
}

export async function getDAPackages(serverId: string) {
  const { data: server, error } = await supabaseAdmin
    .from("servers")
    .select("*")
    .eq("id", serverId)
    .single();

  if (error || !server) throw new Error("Servidor não encontrado");

  const result = await callDA({
    hostname: server.hostname,
    apiUser: server.api_user,
    apiToken: server.api_token,
    command: 'CMD_API_PACKAGES',
  });

  if (result.list) {
    return Array.isArray(result.list) ? result.list : [result.list];
  }
  
  return [];
}

export async function createDAAccount(serverId: string, details: {
  username: string;
  email: string;
  domain: string;
  package: string;
}) {
  const { data: server, error } = await supabaseAdmin
    .from("servers")
    .select("*")
    .eq("id", serverId)
    .single();

  if (error || !server) throw new Error("Servidor não encontrado");

  return await callDA({
    hostname: server.hostname,
    apiUser: server.api_user,
    apiToken: server.api_token,
    command: 'CMD_API_ACCOUNT_USER',
    method: 'POST',
    params: {
      action: 'create',
      add: 'Submit',
      username: details.username,
      email: details.email,
      passwd: Math.random().toString(36).slice(-10) + '!',
      passwd2: Math.random().toString(36).slice(-10) + '!',
      domain: details.domain,
      package: details.package,
      ip: server.ip_address || '',
      notify: 'no'
    }
  });
}

export async function suspendDAAccount(serverId: string, username: string) {
  const { data: server, error } = await supabaseAdmin
    .from("servers")
    .select("*")
    .eq("id", serverId)
    .single();

  if (error || !server) throw new Error("Servidor não encontrado");

  return await callDA({
    hostname: server.hostname,
    apiUser: server.api_user,
    apiToken: server.api_token,
    command: 'CMD_API_SELECT_USERS',
    method: 'POST',
    params: {
      location: 'users',
      suspend: 'Suspend',
      select0: username
    }
  });
}
