// Esta función ahora acepta un objeto 'invoiceData' mucho más rico en detalles.
export const generateInvoiceHtml = (invoiceData: any) => {
    // Logo de tu empresa (placeholder). Reemplázalo con tu propio logo en formato Base64.
    // Puedes usar un conversor online: https://www.base64-image.de/
    const logoBase64 = 'data:image/png;base64,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';

    // Construimos las filas de la tabla de productos
    const itemsRows = invoiceData.items.map((item: any) => {
        let rowHtml = `
            <tr class="item">
                <td>${item.quantity}</td>
                <td>${item.nombre}</td>
                <td class="text-right">$${item.precio.toFixed(2)}</td>
                <td class="text-right">$${(item.quantity * item.precio).toFixed(2)}</td>
            </tr>
        `;
        // Si hay un descuento para este ítem, añadimos una fila detallada
        if (item.promoDescription) {
            rowHtml += `
                <tr class="promo-detail">
                    <td></td>
                    <td colspan="2" class="promo-description-text">${item.promoDescription}</td>
                    <td class="text-right">-$${item.descuentoAplicado.toFixed(2)}</td>
                </tr>
            `;
        }
        return rowHtml;
    }).join('');

    // --- MEJORA: Construcción de la dirección completa ---
    const fullAddress = [
        invoiceData.cliente.direccion,
        invoiceData.cliente.barrio,
        invoiceData.cliente.localidad
    ].filter(Boolean).join(', '); // Filtra valores vacíos y los une con comas

    // --- MEJORA: Extraer descripciones de promociones únicas para el resumen ---
    const uniquePromos = invoiceData.items
        .filter((item: any) => item.promoDescription)
        .map((item: any) => item.promoDescription)
        .filter((value: any, index: any, self: any) => self.indexOf(value) === index);

    const promosSummaryHtml = uniquePromos.map((promo: string) => `<li>${promo}</li>`).join('');

    return `
    <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; font-size: 14px; }
                .invoice-box { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
                .header img { max-width: 120px; }
                .invoice-details { text-align: right; }
                .invoice-details h1 { font-size: 2.5em; margin: 0; color: #333; }
                .details-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .company-details, .client-details { width: 48%; line-height: 1.6; }
                .client-details strong { display: block; margin-bottom: 5px; }
                h2 { color: #3730A3; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 10px; font-size: 1.2em; }
                .items-table { width: 100%; border-collapse: collapse; }
                .items-table th, .items-table td { padding: 10px; border-bottom: 1px solid #ddd; }
                .items-table th { background-color: #f2f2f2; font-weight: bold; text-align: left; }
                .items-table .text-right { text-align: right; }
                .items-table tr.item:hover { background-color: #f9f9f9; }
                .promo-detail td { border-bottom: 1px solid #e0e0e0; }
                .promo-description-text { color: #16A34A; font-style: italic; font-size: 0.9em; padding-top: 2px; padding-bottom: 8px; }
                
                /* Estilos para el pie de tabla (reemplaza al summary) */
                .items-table tfoot td { font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
                .items-table tfoot .total-label { text-align: right; }
                .items-table tfoot .total-value { text-align: right; font-size: 1.3em; }
                .items-table tfoot .discount-text { color: #16A34A; font-weight: normal; border-top: none; }
                
                .promo-summary { margin-top: 20px; padding: 15px; border: 1px solid #16A34A; background-color: #f0fff4; border-radius: 8px; }
                .promo-summary h2 { color: #15803d; border-bottom: 2px solid #d1fae5; font-size: 1.1em; }
                .promo-summary ul { list-style-type: none; padding-left: 0; margin: 10px 0 0 0; }
                .promo-summary li { margin-bottom: 5px; color: #166534; }
                
                .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.8em; color: #777; }
            </style>
        </head>
        <body>
            <div class="invoice-box">
                <div class="header">
                    <img src="${logoBase64}" alt="Logo de la Empresa"/>
                    <div class="invoice-details">
                        <h1>FACTURA</h1>
                        <span>Nº: ${invoiceData.id.substring(0, 8).toUpperCase()}</span><br>
                        <span>Fecha: ${new Date(invoiceData.fecha).toLocaleString('es-AR')}</span>
                    </div>
                </div>
                <div class="details-grid">
                    <div class="company-details">
                        <h2>Vendido por:</h2>
                        <strong>${invoiceData.distribuidora.nombre}</strong><br>
                        ${invoiceData.distribuidora.direccion}<br>
                        Tel: ${invoiceData.distribuidora.telefono}
                    </div>
                    <div class="client-details">
                        <h2>Facturado a:</h2>
                        <strong>${invoiceData.cliente.nombre}</strong><br>
                        ${fullAddress || 'Dirección no especificada'}<br>
                        Zona: ${invoiceData.cliente.zonaNombre || 'No especificada'}<br>
                        Tel: ${invoiceData.cliente.telefono || 'No especificado'}<br>
                        Email: ${invoiceData.cliente.email || 'No especificado'}<br>
                        CUIT/DNI: ${invoiceData.cliente.cuit || 'No especificado'}
                    </div>
                </div>
                <h2>Detalle de la Compra</h2>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Cant.</th>
                            <th>Producto</th>
                            <th class="text-right">P/Unit.</th>
                            <th class="text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" class="total-label">Subtotal:</td>
                            <td class="text-right">$${invoiceData.totalVentaBruto.toFixed(2)}</td>
                        </tr>
                        ${invoiceData.totalDescuento > 0 ? `
                        <tr>
                            <td colspan="3" class="total-label discount-text">Descuentos:</td>
                            <td class="text-right discount-text">-$${invoiceData.totalDescuento.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td colspan="3" class="total-label">Total:</td>
                            <td class="total-value">$${invoiceData.totalVenta.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                
                ${promosSummaryHtml ? `
                <div class="promo-summary">
                    <h2>Promociones Aplicadas</h2>
                    <ul>
                        ${promosSummaryHtml}
                    </ul>
                </div>
                ` : ''}
                
                <div class="footer">
                    <p>Gracias por su compra.</p>
                </div>
            </div>
        </body>
    </html>
    `;
};

