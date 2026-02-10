// Simple test function to verify Pages Functions are working
export const onRequest: PagesFunction = async (context) => {
  return new Response(JSON.stringify({ message: "Test function works!", path: context.functionPath }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

type PagesFunction = (context: {
  request: Request;
  env: any;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  params: Record<string, string>;
}) => Promise<Response>;
