import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import * as yup from "yup";
import * as sinon from "sinon";
import * as assert from "assert";
import { BAD_REQUEST, OK } from "http-status-codes";

import { Yupress, HttpArgs } from "../lib";

export const IdRequired = yup.object({
  id: yup.number().integer().required(),
});

describe("Yupress", () => {
  const sandbox = sinon.createSandbox();
  const status = sandbox.stub();
  const send = sandbox.stub();
  const unused = sandbox.stub();
  const used = sandbox.stub();

  const yupress = new Yupress({
    baz: () => 5,
    bar: () => "a" as const,
    foo: () => true,
    used,
    unused,
  });
  const res = ({ send, status } as unknown) as Response;
  const paramsReq = {
    params: { id: "3" } as ParamsDictionary,
  } as Request;
  const queryReq = {
    query: { id: "3" } as ParamsDictionary,
  } as Request;
  const bodyReq = {
    body: { id: "3" } as ParamsDictionary,
  } as Request;

  beforeEach(() => {
    sandbox.reset();
    status.returnsThis();
    send.returnsThis();
  });

  describe("basic validation", () => {
    it("processes an id in the query", async () => {
      let idFound = 0;
      const endpoint = yupress.endpoint(
        ({ query: { id } }) => {
          idFound = id;
        },
        { query: IdRequired }
      );
      await endpoint(queryReq, res);
      assert.equal(3, idFound);
    });
    it("fails if no id in the query", async () => {
      const endpoint = yupress.endpoint(() => {}, { query: IdRequired });

      await endpoint(paramsReq, res);
      assert(status.calledOnceWith(BAD_REQUEST));
    });

    it("processes an id in the params", async () => {
      let idFound = 0;
      const endpoint = yupress.endpoint(
        ({ params: { id } }) => {
          idFound = id;
        },
        { params: IdRequired }
      );

      await endpoint(paramsReq, res);
      assert.equal(3, idFound);
    });

    it("fails if no id in the params", async () => {
      const endpoint = yupress.endpoint(() => {}, { params: IdRequired });

      await endpoint(queryReq, res);
      assert(status.calledOnceWith(BAD_REQUEST));
    });
    it("processes an id in the body", async () => {
      let idFound = 0;
      const endpoint = yupress.endpoint(
        ({ body: { id } }) => {
          idFound = id;
        },
        { body: IdRequired }
      );

      await endpoint(bodyReq, res);
      assert.equal(3, idFound);
    });

    it("fails if no id in the body", async () => {
      const endpoint = yupress.endpoint(() => {}, { body: IdRequired });

      await endpoint(queryReq, res);
      assert(status.calledOnceWith(BAD_REQUEST));
    });
  });
  describe("return processing", () => {
    const sandbox = sinon.createSandbox();
    const status = sandbox.stub();
    const send = sandbox.stub();
    const res = ({ send, status } as unknown) as Response;

    beforeEach(() => {
      sandbox.reset();
      status.returnsThis();
      send.returnsThis();
    });
    it("does not return unexpected values", async () => {
      const endpoint = yupress.endpoint(
        () => ({
          id: 1,
          secret: "secret value",
        }),
        {},
        IdRequired
      );
      await endpoint(queryReq, res);
      const { id, secret } = JSON.parse(send.getCall(0).args[0]);
      // check that the parsing worked
      assert.equal(1, id);
      // check that the secret value did not escape
      assert.equal(undefined, secret);
    });
  });

  describe("services", () => {
    it("are provided", async () => {
      const endpoint = yupress.endpoint(({ baz, bar, foo }) => {
        assert.equal(5, baz);
        assert.equal("a", bar);
        assert.equal(true, foo);
      });

      await endpoint(queryReq, res);
      assert(status.calledOnceWith(OK));
    });

    it("are called only as needed", async () => {
      const endpoint = yupress.endpoint(({ used }) => {
        return used;
      });

      await endpoint(queryReq, res);
      assert(used.calledOnce);
      assert(!unused.calledOnce);
    });

    it("are called with HttpArgs", async () => {
      const endpoint = yupress.endpoint(({ used }) => {
        return used;
      });

      await endpoint(queryReq, res);
      assert(used.calledOnce);
      const { res: resArg, req: reqArg } = used.getCall(0).args[0] as HttpArgs;
      assert(reqArg === queryReq);
      assert(resArg === res);
    });
  });
});
