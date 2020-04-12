import * as express from "express";
import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";

import * as yup from "yup";

import { Yupress, yxpError, HttpArgs, json } from "../lib";
import { UNAUTHORIZED } from "http-status-codes";
import { UserManager } from "./UserManager";

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

const userManager = new UserManager();

const user = ({ req }: HttpArgs) => {
  const user = userManager.getUser(req);
  if (!user) {
    throw yxpError(UNAUTHORIZED);
  }
  return user;
};

const yupress = new Yupress({ user });

const IdRequired = yup.object({
  id: yup.number().integer().required(),
});

// Note that this is NOT identical to `user`:
// `password` is omitted!
const UserResponse = yup.object({
  id: yup.number().integer().required(),
  username: yup.string().required(),
});

const IsMeResponse = yup.object({
  isme: yup.boolean(),
  user: UserResponse,
});

app.get(
  "/api/isme/:id",
  yupress.endpoint(
    ({ params: { id }, user }) => ({
      user,
      isme: id === user.id,
    }),
    { params: IdRequired },
    IsMeResponse
  )
);

const LoginSchema = yup.object({
  username: yup.string().required(),
  password: yup.string().required(),
});

app.post(
  "/api/login",
  yupress.endpoint(
    ({ body: { username, password } }) => {
      const cookies = userManager.login(username, password);
      if (cookies) {
        return json({}, { cookies });
      }
      return yxpError(UNAUTHORIZED, "username/password not found");
    },
    { body: LoginSchema }
  )
);
app.post(
  "/api/logout",
  yupress.endpoint(() => {
    const cookies = userManager.logout();
    return json({}, { cookies });
  })
);

app.get("/*", express.static("src/demo/public"));

app.listen(3000);
