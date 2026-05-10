interface Env {
  API_ORIGIN: string;
}

interface EventContext<E extends Env = Env> {
  request: Request;
  env: E;
  params: Record<string, string | string[]>;
}

export const onRequest = async (context: EventContext): Promise<Response> => {
  const { params, request, env } = context;
  const origin = env.API_ORIGIN;
  const url = new URL(request.url);
  const pathSegment = Array.isArray(params.path) ? params.path.join("/") : (params.path ?? "");
  const targetUrl = `${origin}/api/${pathSegment}${url.search}`;

  const body = ["GET", "HEAD"].includes(request.method) ? undefined : request.body;

  return fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
    body,
  });
};
