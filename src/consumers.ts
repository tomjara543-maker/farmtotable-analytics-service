import { idempotent, prisma } from "./db";
import { EventEnvelope, subscribe } from "./events";

interface Allocation {
  batchId: string;
  quantityKg: number;
}

const orderTo = (orderId: string, from: string[], status: string) =>
  prisma.orderStat.updateMany({ where: { orderId, status: { in: from } }, data: { status } });

async function adjustBatches(allocations: Allocation[], sign: 1 | -1) {
  for (const a of allocations) {
    await prisma.batchExpiry.updateMany({ where: { batchId: a.batchId }, data: { quantityAvailable: { increment: sign * a.quantityKg } } });
  }
}

const deliveryTo = (deliveryId: string, status: string) => prisma.deliveryStat.updateMany({ where: { deliveryId }, data: { status } });

async function project({ eventType, data, occurredAt }: EventEnvelope) {
  const at = new Date(occurredAt);
  switch (eventType) {
    case "user.registered":
    case "user.updated":
      if (data.role) await prisma.userStat.upsert({ where: { userId: data.userId }, create: { userId: data.userId, role: data.role }, update: { role: data.role } });
      break;
    case "producer.created":
      await prisma.producerStat.upsert({ where: { producerId: data.producerId }, create: { producerId: data.producerId }, update: {} });
      break;
    case "product.available":
      await prisma.batchExpiry.upsert({
        where: { batchId: data.batchId },
        create: { batchId: data.batchId, productId: data.productId, quantityAvailable: data.quantityKg, expiryEstimate: data.expiryEstimate },
        update: {},
      });
      break;
    case "order.created":
      await prisma.orderStat.upsert({
        where: { orderId: data.orderId },
        create: { orderId: data.orderId, status: "PENDING_INVENTORY", total: data.total, createdAt: at },
        update: {},
      });
      break;
    case "inventory.reserved":
      await adjustBatches(data.allocations, -1);
      await orderTo(data.orderId, ["PENDING_INVENTORY"], "CONFIRMED");
      break;
    case "inventory.insufficient":
      await orderTo(data.orderId, ["PENDING_INVENTORY"], "REJECTED");
      break;
    case "inventory.released":
      await adjustBatches(data.allocations, 1);
      await orderTo(data.orderId, ["CONFIRMED"], "CANCELLED");
      break;
    case "order.cancelled":
      await orderTo(data.orderId, ["PENDING_INVENTORY", "CONFIRMED", "PAID"], "CANCELLED");
      await prisma.commissionStat.updateMany({ where: { orderId: data.orderId }, data: { cancelled: true } });
      break;
    case "payment.authorized": {
      await orderTo(data.orderId, ["CONFIRMED"], "PAID");
      const items = data.items as { productId: string; producerId: string; productName: string; quantity: number; unitPrice: number }[];
      const rate = Number(data.commissionRate ?? 0.1);
      const byProducer = new Map<string, number>();
      for (const i of items) byProducer.set(i.producerId, (byProducer.get(i.producerId) ?? 0) + i.quantity * i.unitPrice);
      await prisma.$transaction([
        prisma.paymentStat.create({ data: { paymentId: data.paymentId, orderId: data.orderId, amount: data.amount, status: "AUTHORIZED", createdAt: at } }),
        prisma.productSale.createMany({
          data: items.map((i) => ({ orderId: data.orderId, productId: i.productId, name: i.productName, kg: i.quantity, revenue: i.quantity * i.unitPrice })),
        }),
        ...[...byProducer].map(([producerId, gross]) =>
          prisma.commissionStat.upsert({
            where: { orderId_producerId: { orderId: data.orderId, producerId } },
            create: { orderId: data.orderId, producerId, commission: Math.round(Math.round(gross) * rate) },
            update: {},
          }),
        ),
      ]);
      break;
    }
    case "payment.refunded":
      await prisma.paymentStat.updateMany({ where: { paymentId: data.paymentId }, data: { status: "REFUNDED" } });
      break;
    case "delivery.created":
      await prisma.deliveryStat.upsert({
        where: { deliveryId: data.deliveryId },
        create: { deliveryId: data.deliveryId, orderId: data.orderId, status: "PENDING" },
        update: {},
      });
      break;
    case "route.planned":
      for (const id of (data.deliveryIds ?? []) as string[]) await deliveryTo(id, "ASSIGNED");
      break;
    case "delivery.in_transit":
      await deliveryTo(data.deliveryId, "IN_TRANSIT");
      await orderTo(data.orderId, ["PAID", "IN_DELIVERY"], "IN_DELIVERY");
      break;
    case "delivery.completed":
      await deliveryTo(data.deliveryId, "DELIVERED");
      await orderTo(data.orderId, ["PAID", "IN_DELIVERY"], "DELIVERED");
      break;
    case "delivery.failed":
      await deliveryTo(data.deliveryId, "FAILED");
      break;
    case "delivery.cancelled":
      await deliveryTo(data.deliveryId, "CANCELLED");
      break;
    case "coldchain.breach":
      await prisma.deliveryStat.updateMany({ where: { deliveryId: data.deliveryId }, data: { coldChainBreach: true } });
      break;
  }
}

export async function registerConsumers() {
  await subscribe(
    "analytics-service",
    ["#"],
    idempotent(async (event) => {
      await prisma.eventLog.upsert({
        where: { eventId: event.eventId },
        create: { eventId: event.eventId, eventType: event.eventType, source: event.source, occurredAt: new Date(event.occurredAt), data: event.data ?? {} },
        update: {},
      });
      await project(event);
    }),
  );
}
