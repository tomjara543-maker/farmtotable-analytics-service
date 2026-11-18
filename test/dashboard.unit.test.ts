import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSalesByDay, clampDays, rankTopProducts } from "../src/routes";

test("buildSalesByDay arma una serie diaria continua y clampDays limita el rango a 7–90 días", () => {
  const now = new Date(2026, 10, 17, 12).getTime();
  const series = buildSalesByDay(
    [
      { amount: 10_000, createdAt: new Date(2026, 10, 17, 9) },
      { amount: 5_000, createdAt: new Date(2026, 10, 17, 18) },
      { amount: 7_000, createdAt: new Date(2026, 10, 15, 8) },
      { amount: 99_000, createdAt: new Date(2026, 9, 1, 8) },
    ],
    7,
    now,
  );

  assert.equal(series.length, 7);
  assert.equal(series[0].date, "2026-11-11");
  assert.deepEqual(series.at(-1), { date: "2026-11-17", revenue: 15_000, orders: 2 });
  assert.deepEqual(series.at(-3), { date: "2026-11-15", revenue: 7_000, orders: 1 });
  assert.equal(series.reduce((s, d) => s + d.revenue, 0), 22_000);

  assert.equal(clampDays(undefined), 14);
  assert.equal(clampDays("3"), 7);
  assert.equal(clampDays("365"), 90);
  assert.equal(clampDays("30"), 30);
});

test("rankTopProducts suma ventas por producto y devuelve los 5 de mayor ingreso", () => {
  const sales = [
    { productId: "fresa", name: "Fresa", kg: 1.1, revenue: 9_000.4 },
    { productId: "fresa", name: "Fresa", kg: 2.2, revenue: 9_000.4 },
    ...["a", "b", "c", "d", "e"].map((id, i) => ({ productId: id, name: id.toUpperCase(), kg: 1, revenue: (i + 1) * 1_000 })),
  ];

  const top = rankTopProducts(sales);

  assert.equal(top.length, 5);
  assert.deepEqual(top[0], { productId: "fresa", name: "Fresa", kg: 3.3, revenue: 18_001 });
  assert.deepEqual(top.map((p) => p.productId), ["fresa", "e", "d", "c", "b"]);
});
