export async function fetchMasterAdminAccessToken(params: {
  baseUrl: string;
  clientId?: string;
  password: string;
  username: string;
}): Promise<string> {
  const clientId = params.clientId ?? "admin-cli";
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "password",
    password: params.password,
    username: params.username
  });
  const res = await fetch(`${params.baseUrl.replace(/\/$/u, "")}/realms/master/protocol/openid-connect/token`, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak admin token failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Keycloak admin token response missing access_token");
  }
  return json.access_token;
}

export async function createRealmUser(params: {
  adminToken: string;
  baseUrl: string;
  email: string;
  firstName?: string;
  password: string;
  realm: string;
  username: string;
}): Promise<{ userId: string } | { conflict: true }> {
  const base = params.baseUrl.replace(/\/$/u, "");
  const realm = encodeURIComponent(params.realm);
  const res = await fetch(`${base}/admin/realms/${realm}/users`, {
    body: JSON.stringify({
      credentials: [{ temporary: false, type: "password", value: params.password }],
      email: params.email,
      emailVerified: true,
      enabled: true,
      firstName: params.firstName ?? params.username,
      username: params.username
    }),
    headers: {
      Authorization: `Bearer ${params.adminToken}`,
      "content-type": "application/json"
    },
    method: "POST"
  });
  if (res.status === 409) {
    return { conflict: true };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`create_user:${res.status}:${text.slice(0, 240)}`);
  }
  const location = res.headers.get("Location");
  const userId = location?.split("/").pop() ?? "";
  if (!userId) {
    throw new Error("create_user:missing_location");
  }
  return { userId };
}

export async function assignRealmRole(params: {
  adminToken: string;
  baseUrl: string;
  realm: string;
  roleName: string;
  userId: string;
}): Promise<void> {
  const base = params.baseUrl.replace(/\/$/u, "");
  const realm = encodeURIComponent(params.realm);
  const roleName = encodeURIComponent(params.roleName);
  const roleRes = await fetch(`${base}/admin/realms/${realm}/roles/${roleName}`, {
    headers: { Authorization: `Bearer ${params.adminToken}` }
  });
  if (!roleRes.ok) {
    return;
  }
  const role = (await roleRes.json()) as { id: string; name: string };
  await fetch(`${base}/admin/realms/${realm}/users/${params.userId}/role-mappings/realm`, {
    body: JSON.stringify([{ id: role.id, name: role.name }]),
    headers: {
      Authorization: `Bearer ${params.adminToken}`,
      "content-type": "application/json"
    },
    method: "POST"
  });
}
