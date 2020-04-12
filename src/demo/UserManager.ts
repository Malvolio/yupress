import * as express from "express";
import { UNAUTHORIZED } from "http-status-codes";
import * as yup from "yup";
import { find } from "lodash";
import { ValidationError } from "yup";
import { yxpError } from "../lib";

export class User {
  constructor(
    public readonly id: number,
    public readonly username: string,
    public readonly password: string
  ) {}
}

const UserCookieSchema = yup.object({
  USERID: yup.number().integer().default(0),
});

export class UserManager {
  private readonly users = new Map([
    [1, new User(1, "michael", "swordfish")],
    [3, new User(3, "mary", "catfish")],
  ]);
  getUser(req: express.Request): Readonly<User> | undefined {
    try {
      const { USERID } = UserCookieSchema.validateSync(req.cookies);
      return this.users.get(USERID);
    } catch (e) {
      if (e instanceof ValidationError) {
        // i.e. cookie absent or not formatted correctly
        throw yxpError(UNAUTHORIZED);
      }
      throw e;
    }
  }
  login(
    username: string,
    password: string
  ): Record<string, string> | undefined {
    const user = find(Array.from(this.users.values()), (user: User) => {
      return user.username === username && user.password === password;
    });
    if (user) {
      return { USERID: String(user.id) };
    }
  }
  logout(): Record<string, string> {
    return { USERID: "" };
  }
}
