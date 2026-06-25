const invoiceUserTemplate = (user, order, companyInfo) => {
  const items = order.items || [];

  const itemRows = items
    .map(
      (item, index) => `
    <tr>
      <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; color:#374151; font-size:13px;">${index + 1}</td>
      <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; color:#111827; font-size:13px; font-weight:600;">${item.Product?.name || "Product"}</td>
      <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; color:#374151; font-size:13px; text-align:center;">${item.quantity}</td>
      <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; color:#374151; font-size:13px; text-align:right;">₹${parseFloat(item.price).toFixed(2)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; color:#374151; font-size:13px; text-align:right;">₹${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; color:#374151; font-size:13px; text-align:center;">${parseFloat(item.gstRate || 18)}%</td>
      <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; color:#374151; font-size:13px; text-align:right;">₹${(parseFloat(item.gstAmount || 0) / 2).toFixed(2)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; color:#374151; font-size:13px; text-align:right;">₹${(parseFloat(item.gstAmount || 0) / 2).toFixed(2)}</td>
      <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; color:#111827; font-size:13px; text-align:right; font-weight:700;">₹${parseFloat(item.totalPrice || 0).toFixed(2)}</td>
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

  const orderDate = new Date(order.createdAt || Date.now()).toLocaleDateString(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );

  const subtotal = parseFloat(order.subtotal || 0).toFixed(2);
  const cgst = parseFloat(order.cgstAmount || 0).toFixed(2);
  const sgst = parseFloat(order.sgstAmount || 0).toFixed(2);
  const gstTotal = parseFloat(order.gstAmount || 0).toFixed(2);
  const discount = parseFloat(order.discountAmount || 0);
  const total = parseFloat(order.totalAmount || 0).toFixed(2);

  return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f1f5f9; padding:40px 20px;">
    <div style="max-width:700px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg, #0f2c59 0%, #1a4073 100%); padding:30px 35px; text-align:center;">
        <h1 style="margin:0 0 4px 0; color:#ffffff; font-size:22px; font-weight:800; letter-spacing:0.5px;">TAX INVOICE</h1>
        <p style="margin:0; color:#93c5fd; font-size:12px; letter-spacing:2px; text-transform:uppercase;">GST Compliant Invoice</p>
      </div>

      <div style="padding:30px 35px;">

        <!-- Company & Invoice Info -->
        <table style="width:100%; margin-bottom:25px;">
          <tr>
            <td style="vertical-align:top; width:50%;">
              <p style="margin:0 0 3px 0; font-size:16px; font-weight:800; color:#0f2c59;">${companyInfo.name}</p>
              <p style="margin:0 0 2px 0; font-size:12px; color:#6b7280;">GSTIN: <strong style="color:#374151;">${companyInfo.gstin}</strong></p>
              <p style="margin:0; font-size:12px; color:#6b7280;">${companyInfo.address}</p>
            </td>
            <td style="vertical-align:top; width:50%; text-align:right;">
              <table style="margin-left:auto;">
                <tr>
                  <td style="padding:2px 12px 2px 0; font-size:12px; color:#6b7280; text-align:right;">Invoice No:</td>
                  <td style="padding:2px 0; font-size:12px; font-weight:700; color:#0f2c59;">${order.invoiceNumber || "N/A"}</td>
                </tr>
                <tr>
                  <td style="padding:2px 12px 2px 0; font-size:12px; color:#6b7280; text-align:right;">Date:</td>
                  <td style="padding:2px 0; font-size:12px; font-weight:600; color:#374151;">${orderDate}</td>
                </tr>
                <tr>
                  <td style="padding:2px 12px 2px 0; font-size:12px; color:#6b7280; text-align:right;">Order No:</td>
                  <td style="padding:2px 0; font-size:12px; font-weight:600; color:#374151;">${order.orderNumber}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Divider -->
        <hr style="border:0; border-top:2px solid #e5e7eb; margin:0 0 25px 0;">

        <!-- Bill To -->
        <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px; padding:18px; margin-bottom:25px;">
          <p style="margin:0 0 6px 0; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:1px;">Bill To</p>
          <p style="margin:0 0 3px 0; font-size:14px; font-weight:700; color:#111827;">${user.name}</p>
          <p style="margin:0 0 2px 0; font-size:12px; color:#6b7280;">${user.email}</p>
          ${addressStr ? `<p style="margin:4px 0 0 0; font-size:12px; color:#6b7280;">${addressStr}</p>` : ""}
        </div>

        <!-- Items Table -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 8px; text-align:left; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e5e7eb;">#</th>
              <th style="padding:10px 8px; text-align:left; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e5e7eb;">Item</th>
              <th style="padding:10px 8px; text-align:center; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e5e7eb;">Qty</th>
              <th style="padding:10px 8px; text-align:right; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e5e7eb;">Rate</th>
              <th style="padding:10px 8px; text-align:right; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e5e7eb;">Taxable</th>
              <th style="padding:10px 8px; text-align:center; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e5e7eb;">GST%</th>
              <th style="padding:10px 8px; text-align:right; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e5e7eb;">CGST</th>
              <th style="padding:10px 8px; text-align:right; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e5e7eb;">SGST</th>
              <th style="padding:10px 8px; text-align:right; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <!-- Totals -->
        <table style="width:100%; margin-left:auto; max-width:320px; float:right;">
          <tr>
            <td style="padding:6px 0; font-size:13px; color:#6b7280;">Subtotal:</td>
            <td style="padding:6px 0; font-size:13px; color:#374151; text-align:right; font-weight:600;">₹${subtotal}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; font-size:13px; color:#6b7280;">CGST (9%):</td>
            <td style="padding:6px 0; font-size:13px; color:#374151; text-align:right; font-weight:600;">₹${cgst}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; font-size:13px; color:#6b7280;">SGST (9%):</td>
            <td style="padding:6px 0; font-size:13px; color:#374151; text-align:right; font-weight:600;">₹${sgst}</td>
          </tr>
          ${
            discount > 0
              ? `
          <tr>
            <td style="padding:6px 0; font-size:13px; color:#059669;">Discount${order.couponCode ? ` (${order.couponCode})` : ""}:</td>
            <td style="padding:6px 0; font-size:13px; color:#059669; text-align:right; font-weight:600;">-₹${discount.toFixed(2)}</td>
          </tr>
          `
              : ""
          }
          <tr>
            <td colspan="2" style="border-top:2px solid #0f2c59; padding-top:10px;"></td>
          </tr>
          <tr>
            <td style="padding:4px 0; font-size:16px; font-weight:800; color:#0f2c59;">Grand Total:</td>
            <td style="padding:4px 0; font-size:16px; font-weight:800; color:#0f2c59; text-align:right;">₹${total}</td>
          </tr>
        </table>

        <div style="clear:both;"></div>

        <!-- GST Summary -->
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:15px; margin-top:25px;">
          <p style="margin:0 0 8px 0; font-size:12px; font-weight:700; color:#1e40af; text-transform:uppercase; letter-spacing:0.5px;">GST Summary</p>
          <table style="width:100%; border-collapse:collapse;">
            <tr style="background:#dbeafe;">
              <th style="padding:6px 8px; text-align:left; font-size:11px; color:#1e40af; font-weight:700;">Tax Type</th>
              <th style="padding:6px 8px; text-align:center; font-size:11px; color:#1e40af; font-weight:700;">Rate</th>
              <th style="padding:6px 8px; text-align:right; font-size:11px; color:#1e40af; font-weight:700;">Taxable Amount</th>
              <th style="padding:6px 8px; text-align:right; font-size:11px; color:#1e40af; font-weight:700;">Tax Amount</th>
            </tr>
            <tr>
              <td style="padding:6px 8px; font-size:12px; color:#374151;">CGST</td>
              <td style="padding:6px 8px; font-size:12px; color:#374151; text-align:center;">9%</td>
              <td style="padding:6px 8px; font-size:12px; color:#374151; text-align:right;">₹${subtotal}</td>
              <td style="padding:6px 8px; font-size:12px; color:#374151; text-align:right;">₹${cgst}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px; font-size:12px; color:#374151;">SGST</td>
              <td style="padding:6px 8px; font-size:12px; color:#374151; text-align:center;">9%</td>
              <td style="padding:6px 8px; font-size:12px; color:#374151; text-align:right;">₹${subtotal}</td>
              <td style="padding:6px 8px; font-size:12px; color:#374151; text-align:right;">₹${sgst}</td>
            </tr>
            <tr style="border-top:1px solid #bfdbfe;">
              <td colspan="3" style="padding:6px 8px; font-size:12px; font-weight:700; color:#1e40af;">Total Tax</td>
              <td style="padding:6px 8px; font-size:12px; font-weight:700; color:#1e40af; text-align:right;">₹${gstTotal}</td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top:30px; padding-top:20px; border-top:1px solid #e5e7eb;">
          <p style="font-size:11px; color:#9ca3af; margin:0 0 4px 0;">This is a computer-generated invoice and does not require a physical signature.</p>
          <p style="font-size:11px; color:#9ca3af; margin:0 0 4px 0;">For any queries, please contact us at <a href="mailto:support@technavyug.com" style="color:#2563eb;">support@technavyug.com</a></p>
          <p style="font-size:11px; color:#9ca3af; margin:0;">Payment received via PhonePe (Online Payment).</p>
        </div>

      </div>

      <!-- Bottom Bar -->
      <div style="background:#f8fafc; padding:16px 35px; border-top:1px solid #e5e7eb; text-align:center;">
        <p style="margin:0; font-size:11px; color:#9ca3af;">
          &copy; ${new Date().getFullYear()} ${companyInfo.name}. All rights reserved. | GSTIN: ${companyInfo.gstin}
        </p>
      </div>

    </div>
  </div>
  `;
};

export default invoiceUserTemplate;
