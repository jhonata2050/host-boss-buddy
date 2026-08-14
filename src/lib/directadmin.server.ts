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

  // O targetUser deve ser admin|user para permitir que o admin gere a chave para o usuário
  const targetUser = `${server.api_user}|${username}`;

  console.log(`Iniciando geração de SSO (One-Time Login URL) para ${targetUser} no servidor ${server.hostname}`);

  // Preparar parâmetros para CMD_API_LOGIN_KEYS com type=one_time_url
  const params: Record<string, string> = {
    action: 'create',
    type: 'one_time_url',
    user: targetUser,
    expiry: '5m', // Expiração curta para segurança, conforme documentação
    login_keys_notify_on_creation: '0'
  };

  // DirectAdmin aceita redirect-url para one_time_url
  if (redirectUrl && redirectUrl !== '/') {
    params['redirect-url'] = redirectUrl.startsWith('/') ? redirectUrl : `/${redirectUrl}`;
  }

  const result = await callDA({
    hostname: server.hostname,
    apiUser: server.api_user,
    apiToken: server.api_token,
    command: 'CMD_API_LOGIN_KEYS',
    method: 'POST',
    params
  });

  console.log("DirectAdmin SSO API Response:", result);

  /**
   * Conforme a documentação e observações:
   * O DirectAdmin retorna result.error === '0' e result.details contendo a URL se bem sucedido.
   * Se retornar campos como "key" ou "hash" no corpo da resposta (mesmo via POST), tratamos como sucesso.
   */
  if (result.error === '0' && result.details && (result.details.startsWith('http') || result.details.includes('hash='))) {
    return result.details;
  }

  // Se o DirectAdmin retornar o hash/key diretamente no objeto
  const token = result.key || result.hash || result.details;
  if (token && typeof token === 'string') {
    const cleanHostname = server.hostname.replace(/^https?:\/\//, '').split(':')[0];
    
    // Se o token for apenas o hash
    if (!token.includes('http') && token.length > 20) {
      return `https://${cleanHostname}:2222/CMD_LOGIN_URL?hash=${token}`;
    }
    
    // Se for uma URL completa ou relativa
    if (token.includes('CMD_LOGIN_URL') || token.includes('api/login/url')) {
      if (token.startsWith('http')) return token;
      return `https://${cleanHostname}:2222${token.startsWith('/') ? '' : '/'}${token}`;
    }
  }

  // Se chegarmos aqui, a API falhou ou retornou algo inesperado
  const errorMsg = result.result || result.text || result.details || JSON.stringify(result);
  throw new Error(`Erro ao gerar One-Time Login URL: ${errorMsg}`);
}



