import type { TrpcContext } from "../../server/_core/context";
import { hydrateNetlifyEnv } from "./_shared/netlifyEnv";

type ServerModules = {
  fetchRequestHandler: typeof import("@trpc/server/adapters/fetch").fetchRequestHandler;
  appRouter: typeof import("../../server/routers").appRouter;
  sdk: typeof import("../../server/_core/sdk").sdk;
};

let serverModulesPromise: Promise<ServerModules> | null = null;

function loadServerModules() {
  hydrateNetlifyEnv();

  serverModulesPromise ??= Promise.all([
    import("@trpc/server/adapters/fetch"),
    import("../../server/routers"),
    import("../../server/_core/sdk"),
  ]).then(([fetchAdapter, routerModule, sdkModule]) => ({
    fetchRequestHandler: fetchAdapter.fetchRequestHandler,
    appRouter: routerModule.appRouter,
    sdk: sdkModule.sdk,
  }));

  return serverModulesPromise;
}

type CookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
};

function headersObject(headers: Headers) {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function cookieOptions(options: CookieOptions = {}) {
  const maxAge = typeof options.maxAge === "number" ? options.maxAge : undefined;
  return {
    domain: options.domain,
    expires: maxAge !== undefined && maxAge < 0 ? new Date(0) : options.expires,
    httpOnly: options.httpOnly,
    maxAge: maxAge !== undefined && maxAge >= 0 ? Math.floor(maxAge / 1000) : undefined,
    path: options.path,
    sameSite: options.sameSite,
    secure: options.secure,
  };
}

function serializeCookie(name: string, value: string, options: ReturnType<typeof cookieOptions>) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) {
    const sameSite = options.sameSite === true ? "Strict" : String(options.sameSite);
    parts.push(`SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1).toLowerCase()}`);
  }
  return parts.join("; ");
}

function createCookieResponse(resHeaders: Headers) {
  const response = {
    cookie(name: string, value: string, options?: CookieOptions) {
      resHeaders.append("set-cookie", serializeCookie(name, value, cookieOptions(options)));
      return response;
    },
    clearCookie(name: string, options?: CookieOptions) {
      resHeaders.append(
        "set-cookie",
        serializeCookie(name, "", {
          ...cookieOptions(options),
          expires: new Date(0),
          maxAge: 0,
        }),
      );
      return response;
    },
  };
  return response;
}

export default async (req: Request) => {
  const { fetchRequestHandler, appRouter, sdk } = await loadServerModules();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async ({ req, resHeaders }): Promise<TrpcContext> => {
      const url = new URL(req.url);
      const headers = headersObject(req.headers);
      const protocol = headers["x-forwarded-proto"]?.split(",")[0]?.trim() || url.protocol.replace(":", "");
      const expressLikeReq = {
        protocol,
        hostname: url.hostname,
        headers,
        ip: headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"]?.split(",")[0]?.trim(),
        socket: {
          remoteAddress: headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"]?.split(",")[0]?.trim(),
        },
      } as TrpcContext["req"];
      let user: TrpcContext["user"] = null;

      try {
        user = await sdk.authenticateRequest(expressLikeReq);
      } catch {
        user = null;
      }

      return {
        req: expressLikeReq,
        res: createCookieResponse(resHeaders) as TrpcContext["res"],
        user,
      };
    },
  });
};

export const config = {
  path: "/api/trpc/:procedure",
};
