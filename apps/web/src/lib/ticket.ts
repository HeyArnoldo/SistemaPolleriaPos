import { formatCurrency } from '@/lib/formatting';
import type { Sale } from '@/types/models';
import type { PrintSettings } from '@/lib/print-settings';

const resolvePaymentName = (payment: Sale['payments'][number]): string =>
  payment.paymentMethod?.name?.trim() ?? 'Efectivo';

export const buildTicketHtml = (sale: Sale, settings: PrintSettings): string => {
  const ticketWidthMm = settings.ticketWidthMm;
  const ticketPaddingTopMm = settings.paddingTopMm;
  const ticketPaddingXmm = settings.paddingXMm;
  const ticketPaddingBottomMm = settings.paddingBottomMm;
  const fontScale = settings.fontScale;

  const date = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const dateText = date.toLocaleDateString('es-PE');
  const timeText = date.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const total = Number(sale.totalAmount ?? 0);
  const received = sale.payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const change = Math.max(0, received - total);

  const paymentLabel =
    sale.payments.length === 1
      ? resolvePaymentName(sale.payments[0])
      : `Mixto (${sale.payments.map(resolvePaymentName).join(' + ')})`;

  const isMixedPayment = sale.payments.length > 1;
  const hasTransferPayment = sale.payments.some((p) => Boolean(p.transferTime?.trim()));
  const showTransferTime = hasTransferPayment || isMixedPayment;
  const transferTimeSummary = sale.payments
    .filter((p) => p.transferTime?.trim())
    .map((p) => {
      const label = resolvePaymentName(p);
      const time = p.transferTime?.trim();
      return label && time ? `${label} ${time}` : (time ?? '');
    })
    .filter(Boolean)
    .join(' / ');

  const itemsHtml = sale.items
    .map(
      (item) => `
        <tr>
          <td class="text-center col-qty">${item.quantity}</td>
          <td class="text-left item-desc col-desc">${item.product?.name ?? 'Producto'}</td>
          <td class="text-right col-total">${formatCurrency(Number(item.unitPrice) * item.quantity)}</td>
        </tr>
      `,
    )
    .join('');

  const paymentsHtml =
    sale.payments.length > 1
      ? `
        <div style="margin-top:4px;">
          ${sale.payments
            .map(
              (p) =>
                `<div class="flex-between"><span>${resolvePaymentName(p)}</span><span>${formatCurrency(p.amount)}</span></div>`,
            )
            .join('')}
        </div>
      `
      : '';

  const baseFontSize = 13 * fontScale;
  const smallFontSize = 11 * fontScale;
  const tinyFontSize = 10 * fontScale;
  const bigFontSize = 16 * fontScale;
  const totalFontSize = 15 * fontScale;
  const descFontSize = 15 * fontScale;

  return `
    <html>
      <head>
        <style>
          :root {
            --font-base: ${baseFontSize}px;
            --font-small: ${smallFontSize}px;
            --font-tiny: ${tinyFontSize}px;
            --font-big: ${bigFontSize}px;
            --font-total: ${totalFontSize}px;
            --font-desc: ${descFontSize}px;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 100%;
            height: auto;
            margin: 0;
            font-family: "Arial", sans-serif;
            padding: ${ticketPaddingTopMm}mm ${ticketPaddingXmm}mm ${ticketPaddingBottomMm}mm;
            color: #111;
            line-height: 1.15;
            font-size: var(--font-base);
          }
          h1 { font-size: 15px; text-align: center; margin-bottom: 3px; }
          .big-code { font-size: var(--font-big); font-weight: bold; text-align: center; letter-spacing: 1px; margin: 3px 0; }
          .info { font-size: var(--font-small); line-height: 1.25; margin-bottom: 3px; }
          table { width: 100%; border-collapse: collapse; font-size: var(--font-base); table-layout: fixed; }
          th, td { padding: 1px 0; line-height: 1.25; }
          th { text-align: left; font-weight: bold; font-size: var(--font-base); }
          td { border-bottom: 1px solid #ddd; }
          .item-desc { font-size: var(--font-desc); font-weight: 600; overflow-wrap: anywhere; }
          .col-desc { width: auto; }
          .col-qty { width: 12%; white-space: nowrap; font-weight: bold; font-size: var(--font-big); }
          .col-total { width: 24%; white-space: nowrap; }
          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          tr:last-child td { border-bottom: none; }
          .divider { border-top: 1px solid #000; margin: 2px 0; }
          .total-line { display: flex; justify-content: space-between; font-weight: bold; font-size: var(--font-total); margin: 3px 0; }
          .label { font-weight: bold; margin-top: 3px; }
          .flex-between { display: flex; justify-content: space-between; font-size: var(--font-small); margin-top: 1px; line-height: 1.25; }
          .payment-details { font-size: var(--font-base); margin-top: 3px; line-height: 1.25; }
          @page { size: ${ticketWidthMm}mm auto; margin: 0; }
          @media print {
            html, body { width: ${ticketWidthMm}mm; height: auto; margin: 0; }
            body { padding: ${ticketPaddingTopMm}mm ${ticketPaddingXmm}mm ${ticketPaddingBottomMm}mm; }
            .big-code { letter-spacing: 0.5px; }
          }
        </style>
      </head>
      <body>
        <h1>Pollería Carbón</h1>
        ${sale.saleNumber ? `<div class="big-code">#${sale.saleNumber}</div>` : ''}
        <div class="info">
          <div>FECHA: ${dateText}</div>
          <div>HORA: ${timeText}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="text-center col-qty">CANT</th>
              <th class="text-center col-desc">DESCRIPCIÓN</th>
              <th class="text-right col-total">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="total-line">
          <span>TOTAL</span>
          <span>${formatCurrency(total)}</span>
        </div>
        <div class="payment-details">
          <div><strong>Método:</strong> ${paymentLabel}</div>
          <div><strong>Recibido:</strong> ${formatCurrency(received)}</div>
          ${
            showTransferTime
              ? `<div><strong>Transferencia:</strong> ${transferTimeSummary || '-'}</div>`
              : `<div><strong>Vuelto:</strong> ${formatCurrency(change)}</div>`
          }
        </div>
        ${paymentsHtml}
        <script>
          (function () {
            try {
              var pxToMm = function (px) { return (px * 25.4) / 96; };
              var heightPx = document.body.scrollHeight || 0;
              var heightMm = Math.max(60, Math.ceil(pxToMm(heightPx)));
              var style = document.createElement("style");
              style.id = "ticket-page-size";
              style.textContent =
                "@page { size: ${ticketWidthMm}mm " + heightMm + "mm; margin: 0; }";
              document.head.appendChild(style);
            } catch (e) {
              // Ignore sizing errors.
            }
          })();
        </script>
      </body>
    </html>
  `;
};
