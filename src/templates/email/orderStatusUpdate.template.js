const orderStatusUpdateTemplate = (
  name,
  order,
  newStatus,
  statusDescription,
) => {
  const items = order.items || [];

  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:12px 10px; border-bottom:1px solid #f0f0f0; color:#111827; font-size:14px; font-weight:600;">${item.Product?.name || "Product"}</td>
      <td style="padding:12px 10px; border-bottom:1px solid #f0f0f0; color:#6b7280; text-align:center; font-size:13px;">${item.quantity}</td>
      <td style="padding:12px 10px; border-bottom:1px solid #f0f0f0; color:#6b7280; text-align:right; font-size:13px;">₹${parseFloat(item.price).toFixed(2)}</td>
      <td style="padding:12px 10px; border-bottom:1px solid #f0f0f0; color:#6b7280; text-align:right; font-size:13px;">₹${parseFloat(item.gstAmount || 0).toFixed(2)}</td>
      <td style="padding:12px 10px; border-bottom:1px solid #f0f0f0; color:#111827; text-align:right; font-size:13px; font-weight:700;">₹${parseFloat(item.totalPrice || 0).toFixed(2)}</td>
    </tr>`,
    )
    .join("");

  let addr = order.shippingAddress || {};

  if (typeof addr === "string") {
    try {
      addr = JSON.parse(addr);
    } catch {
      addr = {};
    }
  }

  const addressStr = [
    addr.name,
    addr.addressLine1,
    addr.addressLine2,
    addr.city,
    addr.state,
    addr.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  const subtotal = parseFloat(order.subtotal || 0).toFixed(2);
  const gstAmount = parseFloat(order.gstAmount || 0).toFixed(2);
  const discount = parseFloat(order.discountAmount || 0);
  const total = parseFloat(order.totalAmount || 0).toFixed(2);

  // Determine gradient colors based on status
  let bgGradient = "linear-gradient(135deg, #64748b 0%, #475569 100%)"; // Default gray
  let textColor = "#f8fafc";
  let subTextColor = "#cbd5e1";

  if (newStatus === "Processing") {
    bgGradient = "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"; // Blue
    textColor = "#ffffff";
    subTextColor = "#bfdbfe";
  } else if (newStatus === "Shipped") {
    bgGradient = "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)"; // Indigo
    textColor = "#ffffff";
    subTextColor = "#c7d2fe";
  } else if (newStatus === "Delivered") {
    bgGradient = "linear-gradient(135deg, #059669 0%, #047857 100%)"; // Green
    textColor = "#ffffff";
    subTextColor = "#a7f3d0";
  } else if (newStatus === "Cancelled" || newStatus === "Refunded") {
    bgGradient = "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"; // Red
    textColor = "#ffffff";
    subTextColor = "#fecaca";
  }

  return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f1f5f9; padding:40px 20px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:${bgGradient}; padding:28px; text-align:center;">
        <h2 style="margin:0 0 4px 0; color:${textColor}; font-size:22px; font-weight:800;">Order Status Update</h2>
        <p style="margin:0; color:${subTextColor}; font-size:13px;">${newStatus}</p>
      </div>

      <div style="padding:30px;">

        <p style="font-size:15px;color:#374151;line-height:1.6; margin:0 0 20px 0;">
          Hi <b>${name}</b>,<br><br>
          There is an update regarding your order 
            <b style="color:#0f2c59;">
              ${order.orderNumber}
            </b>.
        </p>
        
        <div style="background:#f8fafc; border-left: 4px solid #0f2c59; border-radius:4px; padding:15px; margin:20px 0;">
          <p style="margin:0; font-size:14px; color:#374151; font-weight:500;">
            ${statusDescription}
          </p>
        </div>

        <!-- Items Table -->
        <table style="width:100%; border-collapse:collapse; margin:20px 0;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px; text-align:left; color:#6b7280; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Item</th>
              <th style="padding:10px; text-align:center; color:#6b7280; font-size:11px; font-weight:700; text-transform:uppercase;">Qty</th>
              <th style="padding:10px; text-align:right; color:#6b7280; font-size:11px; font-weight:700; text-transform:uppercase;">Price</th>
              <th style="padding:10px; text-align:right; color:#6b7280; font-size:11px; font-weight:700; text-transform:uppercase;">GST</th>
              <th style="padding:10px; text-align:right; color:#6b7280; font-size:11px; font-weight:700; text-transform:uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <!-- Price Breakdown -->
        <div style="background:#f8fafc; border-radius:10px; padding:18px; margin:20px 0;">
          <table style="width:100%;">
            <tr>
              <td style="padding:4px 0; font-size:13px; color:#6b7280;">Subtotal</td>
              <td style="padding:4px 0; font-size:13px; color:#374151; text-align:right; font-weight:600;">₹${subtotal}</td>
            </tr>
            <tr>
              <td style="padding:4px 0; font-size:13px; color:#6b7280;">GST (18%)</td>
              <td style="padding:4px 0; font-size:13px; color:#374151; text-align:right; font-weight:600;">₹${gstAmount}</td>
            </tr>
            ${
              discount > 0
                ? `
            <tr>
              <td style="padding:4px 0; font-size:13px; color:#059669;">Discount${order.couponCode ? ` (${order.couponCode})` : ""}</td>
              <td style="padding:4px 0; font-size:13px; color:#059669; text-align:right; font-weight:600;">-₹${discount.toFixed(2)}</td>
            </tr>`
                : ""
            }
            <tr>
              <td colspan="2" style="border-top:2px solid #e5e7eb; padding-top:8px;"></td>
            </tr>
            <tr>
              <td style="padding:4px 0; font-size:17px; font-weight:800; color:#111827;">Total Paid</td>
              <td style="padding:4px 0; font-size:17px; font-weight:800; color:#059669; text-align:right;">₹${total}</td>
            </tr>
          </table>
        </div>

        ${
          addressStr
            ? `
        <div style="background:#f8fafc; border-radius:8px; padding:15px; margin:20px 0;">
          <p style="margin:0 0 5px 0; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px;">Shipping Address</p>
          <p style="margin:0; font-size:13px; color:#374151; line-height:1.5;">${addressStr}</p>
        </div>`
            : ""
        }

        <p style="font-size:13px;color:#6b7280;margin-top:25px;line-height:1.6;">
          Need help with your order? Contact us at <a href="mailto:support@technavyug.com" style="color:#2563eb;">support@technavyug.com</a>
        </p>

      </div>

      <!-- Footer -->
      <div style="background:#f8fafc; padding:16px; border-top:1px solid #e5e7eb; text-align:center;">
        <p style="font-size:11px;color:#9ca3af;margin:0;">
          &copy; ${new Date().getFullYear()} Technavyug Pvt. Ltd. All rights reserved.
        </p>
      </div>

    </div>
  </div>
  `;
};

export default orderStatusUpdateTemplate;
