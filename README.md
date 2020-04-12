# yupress

The `yupress` library harnesses the power of Yup to make writing Express-based
applications in Typescript simpler, more reliable, and more secure.

When you create an endpoint with Yupress, you can give Yup schemata to specify what can be legally
passed into the endpoint as parameters, query-parameters, and body, and what can be legally returned.

# Introduction

Express recognizes three significant categories of input to each endpoint:

- `params` : the data that can be extracted from the URL, expressed as `Record<string, string>`. For example, if the path is given as `/users/:id` and the actual URL is `/users/25`, then `params` is `{"id":"25"}`.
- `query` : the data that can be extracted from the query parameters, expressed as `Record<string, string | string[]>`. For example, if the URL is `/users?age=18`, then `query` is `{"age":"18"}`.
- `body` : the data that is the body of a POST where the data-type is JSON.

When you create a Yupress endpoint, you can specify a Yup schema for any or all of these, and for the return value of endpoint.

# Creating a Yupress instance

You create a Yupress instance like this:

```typescript
const yupress = new Yupress(services);
```

The meaning of the `services` is discussed below.

# Creating a Yupress endpoint

There are several ways to create a Yupress endpoint; the simplest, least powerful is

```typescript
app.get('/info', yupress.endpoint(action));`
```

The `action` performs all the actual work, and must be a function of the following type (ignoring services, which are discussed further down):

```typescript
action: async (args: { req: express.Request, res: express.Response, })
    => Promise<YxpResults | void>
```

Using `YxpResults` might be a little easier than creating a response directly, but beyond that, little value is created by using this style. A far more powerful form is

```typescript
app.get("/info", yupress.endpoint(action, { params, query, body }));
```

The fields `params`, `query`, `body` are each option and each of the type `yup.Schema`. The function has the type:

```typescript
action: async (args: { req: express.Request, res: express.Response, params: P, query: Q, body: B})
    => Promise<YxpResults | void>
```

where `params`, `query`, and `body` in this call are `yup.InferType<>` of the matching values in the call to `endpoint`. And example might help:

```typescript
const DivisionArgs = {
  dividend: yup.number().required(),
  divisor: yup.number().required(),
};

app.get(
  "/divide",
  yupress.endpoint(async ({ dividend, divisor }) => json(dividend / divisor), {
    query: DivisionArgs,
  })
);
```

If you hit this endpoint with `/divide/dividend=3&divisor=4`, it will return a JSON response with the value of `0.75`. If you use an erroneous URL like `/divide/dividend=3&divisor=four`, you'll get a `400 Bad Request` error. Try this snippen in VSCode, you will see that `dividend` and `divisor` are even properly typed as numbers.

Incidentally, the `json()` function is provided by Yupress as an easy way to create `YxpResults`. There are also `text()` and `html()`.

The most powerful form of `endpoint()` is as follows:

```typescript
app.get("/info", yupress.endpoint(action, { params, query, body }, result));
```

Here the action function is of type:

```typescript
action: async (args: { req: express.Request, res: express.Response, params: P, query: Q, body: B})
    => Promise<R>
```

Where `R` is `yup.InferType<typeof result>`.

For example:

```typescript
const IDivisionResult = {
  quotient: yup.number().required(),
  remainder: yup.number().required(),
};

app.get(
  "/idivide",
  yupress.endpoint(
    async ({ dividend, divisor }) => ({
      quotient: Math.floor(dividend / divisor),
      remainder: dividend % divisor,
    }),
    { query: DivisionArgs },
    IDivisionResult
  )
);
```

So `/idivide/dividend=5&divisor=3` would return `{"quotient":1,"remainder":2}`.

This complete form offers several significant advantages:

1. it allows the compiler to guarantee that the action returns something that can be cast to the agreed upon type.
2. it allows the API of the endpoint to be fully specified as Yup schemata.
3. it keeps non-specified data fields from "leaking" out of the endpoint.

# Services

As a useful addition to the Yupress functionality, you can add middleware in the form of services when you construct a Yupress instance. A service is of the form:

```typescript
type HttpArgs = { req: express.Request; res: express.Response};

function service<T>({req, res}: HttpArgs): T {
  ...
}
```

A key aspect of the use of services is that the service function is only invoked _if_ the action asks for it. Consider this example:

```typescript
function findUser({req}: HttpArgs):User {
    // if the request's cookie points to a valid user, create it
    ...
    // (actual code omitted)
    if (!user) {
        throw yxpError(UNAUTHORIZED, 'you must be logged in to use this function');
    }
    return user;
}
const yupress = new Yupress({user: findUser});
app.get('/public-info', yupress.endpoint(() => html('anybody can have this data')));
app.get('/private-info', yupress.endpoint(({user}) =>
    html(`only logged-in people like you, ${user.name}, can have this data')));`
```

# Results handling

In the following situation, you do _not_ have to worry about results handling:

- the HTTP status is `200 OK`
- the mime-type is is `application/json`
- the type of response body is specified, either with a Yum schema or because it's void

That is usually the case, but if you need to give a different status or mime-type, or a body that cannot be properly specified in Yup, you use a `YxpResults` object. You can return a `YxpSuccess` or throw a `YxpError`. There are many functions to create `YxpResults` objects:

```typescript
type YxpSuccessOptions = Partial<{
  mimeType: string;
  headers: { [key: string]: string };
  cookies: { [key: string]: string };
}>;
function json(results: unknown, options: YxpSuccessOptions = {}): YxpSuccess;
function html(results: unknown, options: YxpSuccessOptions = {}): YxpSuccess;
function text(
  results: unknown,
  mimeType: string,
  options: YxpSuccessOptions = {}
): YxpSuccess;
function yxpError(statusCode: number, body = ""): YxpError;
```

# To Do

I am mulling over the following issues:

- should Yupress also support the direct validation of headers and cookies?
- should there be some way to "exit" services, to automatically clean up the services created when an endpoint is called?
- should there be some way to process non-JSON bodies (e.g. multipart/form-data)?
