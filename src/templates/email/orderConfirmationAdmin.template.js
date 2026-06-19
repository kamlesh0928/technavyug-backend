const orderConfirmationAdminTemplate = (userName, userEmail, order) => {
  const items = order.items || [];
  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #f0f0f0; color:#111827; font-size:13px; font-weight:600;">${item.Product?.name || "Product"}</td>
      <td style="padding:8px; border-bottom:1px solid #f0f0f0; text-align:center; font-size:13px; color:#6b7280;">${item.quantity}</td>
      <td style="padding:8px; border-bottom:1px solid #f0f0f0; text-align:right; font-size:13px; color:#6b7280;">₹${parseFloat(item.price).toFixed(2)}</td>
      <td style="padding:8px; border-bottom:1px solid #f0f0f0; text-align:right; font-size:13px; color:#6b7280;">₹${parseFloat(item.gstAmount || 0).toFixed(2)}</td>
      <td style="padding:8px; border-bottom:1px solid #f0f0f0; text-align:right; font-size:13px; color:#111827; font-weight:700;">₹${parseFloat(item.totalPrice || 0).toFixed(2)}</td>
    </tr>`,
    )
    .join("");

  let addr = order.shippingAddress || {};
  if (typeof addr === "string") {
    try {
      addr = JSON.parse(addr);
    } catch (e) {
      addr = {};
    }
  }
  const addressStr = [
    addr.name,
    addr.phone,
    addr.addressLine1,
    addr.addressLine2,
    addr.city,
    addr.state,
    addr.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  const subtotal = parseFloat(order.subtotal || 0).toFixed(2);
  const _gstAmount = parseFloat(order.gstAmount || 0).toFixed(2);
  const cgst = parseFloat(order.cgstAmount || 0).toFixed(2);
  const sgst = parseFloat(order.sgstAmount || 0).toFixed(2);
  const discount = parseFloat(order.discountAmount || 0);
  const total = parseFloat(order.totalAmount || 0).toFixed(2);

  return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f1f5f9; padding:40px 20px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <div style="background:linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color:white; padding:24px 30px; text-align:center;">
        <h2 style="margin:0 0 4px 0; font-size:20px; font-weight:800;">🛒 New Order Received</h2>
        <p style="margin:0; color:#93c5fd; font-size:12px;">${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
      </div>

      <div style="padding:25px 30px;">

        <!-- Order Info -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <tr>
            <td style="padding:8px 0; font-weight:700; color:#6b7280; font-size:13px; width:140px;">Order #</td>
            <td style="padding:8px 0; color:#111827; font-size:13px; font-weight:600;">
              ${order.orderNumber}
            </td>
          </tr>

          ${
            order.invoiceNumber
              ? `
          <tr>
            <td style="padding:8px 0; font-weight:700; color:#6b7280; font-size:13px;">
              Invoice #
            </td>
            <td style="padding:8px 0; color:#111827; font-size:13px; font-weight:600;">
              ${order.invoiceNumber}
            </td>
          </tr>`
              : ""
          }

          ${
            order.paymentId
              ? `
          <tr>
            <td style="padding:8px 0; font-weight:700; color:#6b7280; font-size:13px;">
              Payment ID
            </td>
            <td style="padding:8px 0; color:#111827; font-size:13px; font-weight:600;">
              ${order.paymentId}
            </td>
          </tr>`
              : ""
          }

          ${
            order.paymentMethod
              ? `
          <tr>
            <td style="padding:8px 0; font-weight:700; color:#6b7280; font-size:13px;">
              Payment Method
            </td>
            <td style="padding:8px 0; color:#111827; font-size:13px; font-weight:600;">
              ${order.paymentMethod}
            </td>
          </tr>`
              : ""
          }

          <tr>
            <td style="padding:8px 0; font-weight:700; color:#6b7280; font-size:13px;">
              Customer
            </td>
            <td style="padding:8px 0; color:#111827; font-size:13px;">
              ${userName} (${userEmail})
            </td>
          </tr>
        </table>

        <!-- Items -->
        <h3 style="color:#111827; font-size:14px; margin:20px 0 10px; font-weight:700;">Items Ordered:</h3>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px; text-align:left; font-size:11px; color:#6b7280; font-weight:700; text-transform:uppercase;">Item</th>
              <th style="padding:8px; text-align:center; font-size:11px; color:#6b7280; font-weight:700; text-transform:uppercase;">Qty</th>
              <th style="padding:8px; text-align:right; font-size:11px; color:#6b7280; font-weight:700; text-transform:uppercase;">Price</th>
              <th style="padding:8px; text-align:right; font-size:11px; color:#6b7280; font-weight:700; text-transform:uppercase;">GST</th>
              <th style="padding:8px; text-align:right; font-size:11px; color:#6b7280; font-weight:700; text-transform:uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <!-- Price Breakdown -->
        <div style="background:#f8fafc; border-radius:8px; padding:15px; margin:20px 0;">
          <table style="width:100%;">
            <tr>
              <td style="padding:3px 0; font-size:13px; color:#6b7280;">Subtotal</td>
              <td style="padding:3px 0; font-size:13px; color:#374151; text-align:right; font-weight:600;">₹${subtotal}</td>
            </tr>
            <tr>
              <td style="padding:3px 0; font-size:13px; color:#6b7280;">CGST (9%)</td>
              <td style="padding:3px 0; font-size:13px; color:#374151; text-align:right;">₹${cgst}</td>
            </tr>
            <tr>
              <td style="padding:3px 0; font-size:13px; color:#6b7280;">SGST (9%)</td>
              <td style="padding:3px 0; font-size:13px; color:#374151; text-align:right;">₹${sgst}</td>
            </tr>
            ${
              discount > 0
                ? `
            <tr>
              <td style="padding:3px 0; font-size:13px; color:#059669;">Discount${order.couponCode ? ` (${order.couponCode})` : ""}</td>
              <td style="padding:3px 0; font-size:13px; color:#059669; text-align:right;">-₹${discount.toFixed(2)}</td>
            </tr>`
                : ""
            }
            <tr>
              <td colspan="2" style="border-top:2px solid #e5e7eb; padding-top:8px;"></td>
            </tr>
            <tr>
              <td style="padding:3px 0; font-size:16px; font-weight:800; color:#059669;">Total Amount</td>
              <td style="padding:3px 0; font-size:16px; font-weight:800; color:#059669; text-align:right;">₹${total}</td>
            </tr>
          </table>
        </div>

        ${
          addressStr
            ? `
        <div style="background:#f8fafc; border-radius:8px; padding:15px; margin:20px 0;">
          <p style="margin:0 0 5px 0; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px;">Ship To</p>
          <p style="margin:0; font-size:13px; color:#374151;">${addressStr}</p>
        </div>`
            : ""
        }

      </div>

      <div style="background:#f8fafc; padding:14px 30px; border-top:1px solid #e5e7eb; text-align:center;">
        <p style="font-size:11px;color:#9ca3af;margin:0;">
          &copy; ${new Date().getFullYear()} Technavyug Pvt. Ltd. Admin Notification.
        </p>
      </div>

    </div>
  </div>
  `;
};

export default orderConfirmationAdminTemplate;
