-- CreateTable
CREATE TABLE "event_log" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "order_stats" (
    "order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_stats_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "payment_stats" (
    "payment_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_stats_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "product_sales" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "product_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_stats" (
    "order_id" TEXT NOT NULL,
    "producer_id" TEXT NOT NULL,
    "commission" INTEGER NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "commission_stats_pkey" PRIMARY KEY ("order_id","producer_id")
);

-- CreateTable
CREATE TABLE "batch_expiry" (
    "batch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_available" DOUBLE PRECISION NOT NULL,
    "expiry_estimate" TEXT NOT NULL,

    CONSTRAINT "batch_expiry_pkey" PRIMARY KEY ("batch_id")
);

-- CreateTable
CREATE TABLE "delivery_stats" (
    "delivery_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cold_chain_breach" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "delivery_stats_pkey" PRIMARY KEY ("delivery_id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "producer_stats" (
    "producer_id" TEXT NOT NULL,

    CONSTRAINT "producer_stats_pkey" PRIMARY KEY ("producer_id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "event_log_occurred_at_idx" ON "event_log"("occurred_at");

-- CreateIndex
CREATE INDEX "payment_stats_order_id_idx" ON "payment_stats"("order_id");

-- CreateIndex
CREATE INDEX "product_sales_order_id_idx" ON "product_sales"("order_id");

-- CreateIndex
CREATE INDEX "delivery_stats_order_id_idx" ON "delivery_stats"("order_id");
