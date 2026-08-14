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

interface DAConnectionResult {
  success: true;
  hostname: string;
  apiUser: string;
  packageCount: number;
  packages: string[];
}

function generateStrongPassword(length = 32): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'; // Expanded symbols set
  const allCharacters = `${uppercase}${lowercase}${numbers}${symbols}`;
  
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  const password = [
    uppercase.charAt((randomValues[0] ?? 0) % uppercase.length),
    lowercase.charAt((randomValues[1] ?? 0) % lowercase.length),
    numbers.charAt((randomValues[2] ?? 0) % numbers.length),
    symbols.charAt((randomValues[3] ?? 0) % symbols.length),
  ];

  // Fill the rest with truly random characters
  for (let i = 4; i < length; i++) {
    password.push(allCharacters.charAt((randomValues[i] ?? 0) % allCharacters.length));
  }

  // Cryptographically secure shuffle
  for (let i = password.length - 1; i > 0; i--) {
    const j = (randomValues[i] ?? 0) % (i + 1);
    [password[i], password[j]] = [password[j]!, password[i]!];
  }

  return password.join('');
}


async function callDA({ hostname, apiUser, apiToken, command, method = 'GET', params = {} }: DARequestOptions) {
  // Limpa o hostname e garante o uso da porta 2222
  const cleanHostname = hostname.replace(/^https?:\/\//, '').split(':')[0];
  const url = `https://${cleanHostname}:2222/${command}`;
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => searchParams.append(key, val));
  
  const authHeader = `Basic ${Buffer.from(`${apiUser}:${apiToken}`).toString('base64')}`;
  
  try {
    if (method === 'GET') searchParams.set('json', 'yes');

    const response = await fetch(url + (method === 'GET' ? `?${searchParams.toString()}` : ''), {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/plain',
      },
      body: method === 'POST' ? searchParams.toString() : null,
      signal: AbortSignal.timeout(15_000),
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error(`A API redirecionou para ${response.headers.get('location') ?? 'a tela de login'}. Verifique o comando e as permissões da chave.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DirectAdmin API Error (${response.status}): ${errorText}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      if (text.trimStart().startsWith('<!DOCTYPE html') || text.includes('<html')) {
        throw new Error('O DirectAdmin retornou a tela de login em vez dos dados da API. Verifique as permissões da chave de acesso.');
      }
      return Object.fromEntries(new URLSearchParams(text));
    }
  } catch (error: unknown) {
    console.error("DirectAdmin Fetch Error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    throw new Error(`Falha na comunicação com o DirectAdmin: ${message}. Verifique o hostname e as permissões da chave no servidor ${hostname}.`);
  }
}

function normalizePackageList(result: unknown): string[] {
  if (Array.isArray(result)) return result.filter((item): item is string => typeof item === 'string');
  if (!result || typeof result !== 'object' || !('list' in result)) return [];
  const list = result.list;
  if (Array.isArray(list)) return list.filter((item): item is string => typeof item === 'string');
  return typeof list === 'string' ? [list] : [];
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
    command: 'CMD_API_PACKAGES_USER',
  });

  const packages = normalizePackageList(result);
  if (packages.length === 0) throw new Error('A conexão foi aceita, mas nenhum pacote de usuário foi retornado pelo DirectAdmin.');
  return packages;
}

export async function testDAConnectionDetails(serverId: string): Promise<DAConnectionResult> {
  const { data: server, error } = await supabaseAdmin
    .from('servers')
    .select('hostname, api_user')
    .eq('id', serverId)
    .single();

  if (error || !server) throw new Error('Servidor não encontrado');
  const packages = await getDAPackages(serverId);
  return {
    success: true,
    hostname: server.hostname,
    apiUser: server.api_user,
    packageCount: packages.length,
    packages,
  };
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

  const password = generateStrongPassword(128);

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
      passwd: password,
      passwd2: password,
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
export async function deleteDAAccount(serverId: string, username: string) {
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
      delete: 'Delete',
      select0: username
    }
  });
}

export async function getDASession(serverId: string, username: string, redirectUrl?: string) {
  const { data: server, error } = await supabaseAdmin
    .from("servers")
    .select("*")
    .eq("id", serverId)
    .single();

  if (error || !server) throw new Error("Servidor não encontrado");

  // Single Sign-On via CMD_API_LOGIN_KEYS
  const targetUser = `${server.api_user}|${username}`;

  // Tentativa 1: one_time_url (Método recomendado, sem senha exposta)
  try {
    const result = await callDA({
      hostname: server.hostname,
      apiUser: server.api_user,
      apiToken: server.api_token,
      command: 'CMD_API_LOGIN_KEYS',
      method: 'POST',
      params: {
        action: 'create',
        type: 'one_time_url',
        user: targetUser,
        // passwd: server.api_token, // Removido: o DA às vezes rejeita se enviado no corpo para one_time_url
        'redirect-url': redirectUrl || '/',
        expiry: '30m',
        login_keys_notify_on_creation: '0'
      }
    });

    if (result.error === '0' && result.details && typeof result.details === 'string') {
      return result.details;
    }
  } catch (e) {
    console.error("Erro na tentativa de one_time_url, tentando fallback...", e);
  }

  // Fallback (Tentativa 2): one_time_key com senha ULTRA forte (128 caracteres)
  const keyId = `sso${Date.now().toString(36)}`;
  // Aumentado para 128 caracteres e garantindo símbolos complexos para satisfazer o servidor br01-da
  const keyPass = generateStrongPassword(128);
  
  const fallbackResult = await callDA({
    hostname: server.hostname,
    apiUser: server.api_user,
    apiToken: server.api_token,
    command: 'CMD_API_LOGIN_KEYS',
    method: 'POST',
    params: {
      action: 'create',
      user: username,
      keyname: keyId,
      id: keyId,
      passwd: keyPass,
      passwd2: keyPass,
      expiry: '3600',
      ips: '0.0.0.0/0',
      type: 'one_time_key',
      // Permissões mínimas para a chave ser aceita mais facilmente
      'CMD_API_LOGIN_KEYS': 'yes',
      'CMD_LOGIN': 'yes'
    }
  });

  if (fallbackResult.error === '1') {
    throw new Error(`DirectAdmin Recusou a Chave: ${fallbackResult.details || fallbackResult.text || "Senha fraca ou permissão negada"}`);
  }

  const cleanHostname = server.hostname.replace(/^https?:\/\//, '').split(':')[0];
  const keyValue = fallbackResult.key || fallbackResult.value;
  
  if (keyValue) {
    return `https://${cleanHostname}:2222/login?user=${username}&passwd=${keyValue}`;
  }

  throw new Error(`O servidor não retornou uma chave válida. Resposta: ${JSON.stringify(fallbackResult)}`);
}



