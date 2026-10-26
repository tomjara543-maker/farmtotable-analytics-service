import { Router } from "express";
import { requireUser } from "./auth";
import { prisma } from "./db";
import { daysBetween, round2, toDate, today } from "./http";

const SOLD = ["PAID", "IN_DELIVERY", "DELIVERED"];
const IN_PROGRESS = ["PENDING", "ASSIGNED", "IN_TRANSIT"];

export function analyticsRoutes() {
  const router = Router();

  router.get("/dashboard", requireUser("ADMIN"), async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const t = today();

    const [paid, orders, sold, commissions, batches, deliveries, producers, buyers, events] = await Promise.all([
      prisma.paymentStat.findMany({ where: { status: "AUTHORIZED" } }),
      prisma.orderStat.findMany({ select: { orderId: true, status: true } }),
      prisma.orderStat.findMany({ where: { status: { in: SOLD } }, select: { orderId: true } }),
      prisma.commissionStat.aggregate({ where: { cancelled: false }, _sum: { commission: true } }),
      prisma.batchExpiry.findMany(),
      prisma.deliveryStat.findMany(),
      prisma.producerStat.count(),
      prisma.userStat.count({ where: { role: "BUYER" } }),
      prisma.eventLog.findMany({ orderBy: { occurredAt: "desc" }, take: 15, select: { eventId: true, eventType: true, source: true, occurredAt: true } }),
    ]);

    const revenue = paid.reduce((s, p) => s + p.amount, 0);

    const salesByDay = Array.from({ length: days }, (_, i) => {
      const date = toDate(new Date(Date.now() - (days - 1 - i) * 86_400_000));
      const dayPayments = paid.filter((p) => toDate(p.createdAt) === date);
      return { date, revenue: dayPayments.reduce((s, p) => s + p.amount, 0), orders: dayPayments.length };
    });

    const sales = await prisma.productSale.findMany({ where: { orderId: { in: sold.map((o) => o.orderId) } } });
    const byProduct = new Map<string, { name: string; kg: number; revenue: number }>();
    for (const s of sales) {
      const acc = byProduct.get(s.productId) ?? { name: s.name, kg: 0, revenue: 0 };
      byProduct.set(s.productId, { name: s.name, kg: round2(acc.kg + s.kg), revenue: acc.revenue + s.revenue });
    }
    const topProducts = [...byProduct]
      .map(([productId, v]) => ({ productId, name: v.name, kg: v.kg, revenue: Math.round(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;

    res.json({
      revenue,
      commission: commissions._sum.commission ?? 0,
      orders: orders.length,
      avgTicket: paid.length ? Math.round(revenue / paid.length) : 0,
      ordersByStatus,
      salesByDay,
      topProducts,
      wasteKg: round2(batches.filter((b) => b.expiryEstimate < t).reduce((s, b) => s + b.quantityAvailable, 0)),
      atRiskKg: round2(
        batches.filter((b) => b.expiryEstimate >= t && daysBetween(t, b.expiryEstimate) <= 3).reduce((s, b) => s + b.quantityAvailable, 0),
      ),
      deliveries: {
        delivered: deliveries.filter((d) => d.status === "DELIVERED").length,
        failed: deliveries.filter((d) => d.status === "FAILED").length,
        inProgress: deliveries.filter((d) => IN_PROGRESS.includes(d.status)).length,
        coldChainBreaches: deliveries.filter((d) => d.coldChainBreach).length,
      },
      producers,
      buyers,
      recentEvents: events.map((e) => ({ id: e.eventId, type: e.eventType, source: e.source, at: e.occurredAt })),
    });
  });

  return router;
}
