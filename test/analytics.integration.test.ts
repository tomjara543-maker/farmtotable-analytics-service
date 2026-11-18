import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { as, request, Running, startApp } from "./helpers";

let api: Running;

before(async () => {
  const { createApp } = await import("../src/app");
  api = await startApp(createApp());
});

after(() => api.close());

test("el dashboard de analítica es exclusivo del administrador", async () => {
  const anonymous = await request(api.url, "/analytics/dashboard?days=30");
  assert.equal(anonymous.status, 401);

  for (const role of ["BUYER", "PRODUCER"]) {
    const res = await request(api.url, "/analytics/dashboard", { headers: as("u-1", role) });
    assert.equal(res.status, 403, `${role} no debería ver el dashboard`);
  }
});

test("expone /health con CORS habilitado para el frontend", async () => {
  const res = await request(api.url, "/health", { headers: { origin: "http://localhost:3000" } });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { service: "analytics-service", status: "ok" });
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});
