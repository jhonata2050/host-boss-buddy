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
  const url = new URL(`https://${hostname}:2222/${command}`);
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => searchParams.append(key, val));
  
  const authHeader = `Basic ${Buffer.from(`${apiUser}:${apiToken}`).toString('base64')}`;
  
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

  // DA often returns URL-encoded strings for some legacy commands
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

export async function getDAPackages(serverId: string) {
  const { data: server, error } = await supabaseAdmin
    .from("servers")
    .select("*")
    .eq("id", serverId)
    .single();

  if (error || !server) throw new Error("Servidor não encontrado");

  // CMD_API_PACKAGES
  const result = await callDA({
    hostname: server.hostname,
    apiUser: server.api_user,
    apiToken: server.api_token,
    command: 'CMD_API_PACKAGES',
  });

  // DA returns list=pkg1&list=pkg2...
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

  // CMD_API_ACCOUNT_USER
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
