interface Env {
  API_ORIGIN: string;
}

interface EventContext<E extends Env = Env> {
  request: Request;
  env: E;
  params: Record<string, string>;
}

export const onRequest = async (context: EventContext): Promise<Response> => {
  const { params, request, env } = context;
  const origin = env.API_ORIGIN;
  const url = new URL(request.url);
  const targetUrl = `${origin}/c/${params.slug}${url.search}`;

  return fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
  });
};
