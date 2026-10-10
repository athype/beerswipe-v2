import request from "supertest";
import { describe, it } from "vitest";

import app from "../src/app.js";

describe("app", () => {
  it("responds with a not found message", () =>
    request(app)
      .get("/what-is-this-even")
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(404));
});
