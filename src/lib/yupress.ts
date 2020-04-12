import * as express from "express";
import * as yup from "yup";
import { BAD_REQUEST, OK } from "http-status-codes";
import { get, forOwn, memoize, pick } from "lodash";

export type HttpArgs = {
  req: express.Request;
  res: express.Response;
};

type ServiceFactory<P> = (httpArgs: HttpArgs) => P;

type ServiceFactoryArgs<T> = {
  [P in keyof T]: ServiceFactory<T[P]>;
};

type SchemaArgs<P, Q, B> = {
  params: P;
  query: Q;
  body: B;
};

type EndpointArgs<T, P, Q, B> = T & HttpArgs & SchemaArgs<P, Q, B>;

type Schemata<P, Q, B> = Partial<{
  params: yup.Schema<P>;
  query: yup.Schema<Q>;
  body: yup.Schema<B>;
}>;

type YxpError = {
  type: "YxpError";
  statusCode: number;
  body: string;
};

type YxpSuccessOptions = Partial<{
  mimeType: string;
  headers: { [key: string]: string };
  cookies: { [key: string]: string };
}>;

export type YxpSuccess = {
  type: "YxpSuccess";
  statusCode: number;
  body: string;
  options: YxpSuccessOptions;
};

type YxpResults = YxpError | YxpSuccess;
const ResultTypes = new Set(["YxpSuccess", "YxpError"]);

export function yxpError(statusCode: number, body = ""): YxpError {
  return {
    type: "YxpError",
    statusCode,
    body,
  };
}

export function yxpSuccess(
  body: string,
  statusCode = OK,
  options: YxpSuccessOptions = {}
): YxpSuccess {
  return {
    type: "YxpSuccess",
    body,
    statusCode,
    options,
  };
}

export function paramError(message: string): YxpError {
  return yxpError(BAD_REQUEST, message);
}

export function text(
  results: string,
  mimeType: string,
  options: YxpSuccessOptions = {}
): YxpSuccess {
  return yxpSuccess(results, OK, { mimeType, ...options });
}

export function html(
  results: string,
  options: YxpSuccessOptions = {}
): YxpSuccess {
  return text(results, "text/html", options);
}

export function json(
  results: unknown,
  options: YxpSuccessOptions = {}
): YxpSuccess {
  return text(JSON.stringify(results), "application/json", options);
}

function isYxpResults(results: unknown): results is YxpResults {
  return ResultTypes.has(get(results, "type"));
}

function isYxpSuccess(results: YxpResults): results is YxpSuccess {
  return results.type === "YxpSuccess";
}

function sendResults(res: express.Response, results: YxpResults) {
  if (isYxpSuccess(results)) {
    forOwn(results.options.cookies || {}, (value, name) => {
      res.cookie(name, value);
    });
    forOwn(results.options.headers || {}, (value, name) => {
      res.header(name, value);
    });
  }
  res.status(results.statusCode).send(results.body);
}

function sendUnknownResponse(
  res: express.Response,
  results: unknown,
  formatter: yup.Schema<unknown>
) {
  sendResults(
    res,
    isYxpResults(results)
      ? results
      : json(
          formatter.cast(results, {
            strict: true,
            stripUnknown: true,
          })
        )
  );
}

const BlankReturn = yup.object({});

export class Yupress<S extends Object> {
  constructor(private readonly serviceFactoryArgs: ServiceFactoryArgs<S>) {}

  private async getSchemataArgs<P, Q, B>(
    req: express.Request,
    schemata: Schemata<P, Q, B>
  ): Promise<YxpError | SchemaArgs<P, Q, B>> {
    try {
      const params = (await schemata.params?.validate(req.params)) || ({} as P);
      const query = (await schemata.query?.validate(req.query)) || ({} as Q);
      const body = (await schemata.body?.validate(req.body)) || ({} as B);
      return { params, query, body };
    } catch (e) {
      return paramError(e.message);
    }
  }

  /*
   * Because the services are lazily invoked, they must be added to an
   * existing object, rather than a service object being created de novo.
   * This of course mutates the object, but it's a huge savings of time
   * in practice.
   */
  private addServices<T extends HttpArgs>(services: T): S & T {
    const httpArgs = pick(services, "req", "res");
    forOwn(this.serviceFactoryArgs, (factory, name) => {
      Object.defineProperty(services, name, {
        get: memoize(() => factory(httpArgs)),
      });
    });
    return services as S & T;
  }
  endpoint(
    action: (args: EndpointArgs<S, {}, {}, {}>) => YxpResults | void
  ): (req: express.Request, res: express.Response) => Promise<void>;
  endpoint<P, Q, B>(
    action: (args: EndpointArgs<S, P, Q, B>) => YxpResults | void,
    schemata: Schemata<P, Q, B>
  ): (req: express.Request, res: express.Response) => Promise<void>;
  endpoint<P, Q, B, R extends yup.Schema<unknown>>(
    action: (args: EndpointArgs<S, P, Q, B>) => yup.InferType<R>,
    schemata: Schemata<P, Q, B>,
    formatter: R
  ): (req: express.Request, res: express.Response) => Promise<void>;
  endpoint<P, Q, B, R extends yup.Schema<unknown>>(
    action: (
      args: EndpointArgs<S, P, Q, B>
    ) => yup.InferType<R> | YxpResults | void,
    schemata: Schemata<P, Q, B> = {},
    formatter = BlankReturn
  ): (req: express.Request, res: express.Response) => Promise<void> {
    return async (
      req: express.Request,
      res: express.Response
    ): Promise<void> => {
      const schemataArgs = await this.getSchemataArgs(req, schemata);
      if (isYxpResults(schemataArgs)) {
        sendResults(res, schemataArgs);
        return;
      }
      try {
        const services = this.addServices({ ...schemataArgs, req, res });
        sendUnknownResponse(res, action(services), formatter);
      } catch (e) {
        if (isYxpResults(e)) {
          sendResults(res, e);
        } else {
          throw e;
        }
      }
    };
  }
}
