import sequelize from "../config/db.js";
import InvoiceCounter from "../models/invoiceCounter.model.js";
import OrderCounter from "../models/orderCounter.model.js";

export const generateInvoiceNumber = async () => {
  const result = await sequelize.transaction(async (t) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    const dateCompact = `${year}${month}${day}`;

    // Find or create the counter row for today, with row-level lock
    const [counter] = await InvoiceCounter.findOrCreate({
      where: { date: dateStr },
      defaults: { lastSequence: 0 },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // Atomically increment and read the new value
    await counter.increment("lastSequence", { by: 1, transaction: t });
    await counter.reload({ transaction: t });

    const sequence = String(counter.lastSequence).padStart(5, "0");
    return `TNY-INV-${dateCompact}-${sequence}`;
  });

  return result;
};

export const generateOrderNumber = async () => {
  const result = await sequelize.transaction(async (t) => {
    // Find or create the single counter row (id=1), with row-level lock
    const [counter] = await OrderCounter.findOrCreate({
      where: { id: 1 },
      defaults: { lastSequence: 0 },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // Atomically increment and read the new value
    await counter.increment("lastSequence", { by: 1, transaction: t });
    await counter.reload({ transaction: t });

    const sequence = String(counter.lastSequence).padStart(5, "0");
    return `ORD-${sequence}`;
  });

  return result;
};
