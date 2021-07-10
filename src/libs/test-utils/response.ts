export const notFoundResponse = new Response(null, { status: 404 });

export const okResponse = (body: Blob): Response =>
  new Response(body, { status: 200, headers: { "content-type": body.type } });

export const jsonResponse = (
  data: unknown,
  type = "application/json"
): Response =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": type },
  });
