import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportService } from './export';
import { UserProfile } from '../types';

export const InvoiceService = {
  generateInvoice: async (data: any, profile: UserProfile) => {
    const doc = new jsPDF();
    const isSale = data.type === 'sell';
    
    // 1. Header
    doc.setFontSize(18); doc.text(profile.firm_name || 'INVOICE', 14, 15);
    doc.setFontSize(10); doc.text(profile.address || '', 14, 20);
    doc.text(`Phone: ${profile.contact || ''}`, 14, 25);
    if(profile.gstin) doc.text(`GSTIN: ${profile.gstin}`, 14, 30);

    // 2. Info
    doc.setFontSize(14); doc.text(isSale ? 'SALE INVOICE' : 'PURCHASE ORDER', 140, 15);
    doc.setFontSize(10); doc.text(`Date: ${data.date}`, 140, 22);
    if(data.invoice_no) doc.text(`Invoice #: ${data.invoice_no}`, 140, 27);

    // 3. Bill To
    doc.line(14, 35, 196, 35);
    doc.text(isSale ? 'Bill To:' : 'Supplier:', 14, 42);
    doc.setFontSize(11); doc.text(data.party_name || 'Cash Sale', 14, 48);
    doc.setFontSize(10);
    
    let extraY = 53;
    if (data.party_address) { doc.text(data.party_address, 14, extraY); extraY += 5; }
    if (data.vehicle) { doc.text(`Vehicle: ${data.vehicle}`, 120, 42); if(data.vehicle_rent) doc.text(`Rent: ${data.vehicle_rent}`, 120, 47); }
    if (data.supplier) { doc.text(`Source: ${data.supplier}`, 120, 52); } // Added Source Supplier
    if (data.send_to) { doc.text(`Ship To: ${data.send_to}`, 120, 52); }

    // 4. Items Table (Added HSN & Tax)
    const tableRows = data.items?.map((item: any) => [
        item.item_name,
        item.hsn_code || '-',
        `${item.quantity} ${item.unit}`,
        item.rate,
        item.gst_percent ? `${item.gst_percent}%` : '0%',
        item.total
    ]) || [];

    autoTable(doc, {
        startY: 65,
        head: [['Item', 'HSN', 'Qty', 'Rate', 'Tax', 'Total']],
        body: tableRows,
        theme: 'grid'
    });

    // 5. Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`Grand Total: Rs.${data.total_amount}`, 140, finalY);
    
    if (data.notes) doc.text(`Note: ${data.notes}`, 14, finalY + 10);

    // 6. Save
    const pdfData = doc.output('datauristring').split(',')[1];
    await exportService.saveAndOpenFile(pdfData, `Invoice_${data.party_name}.pdf`, 'application/pdf');
  },

  generateReceipt: async (data: any, profile: UserProfile) => {
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text("PAYMENT RECEIPT", 105, 15, { align: 'center' });
      doc.setFontSize(10); doc.text(profile.firm_name, 105, 22, { align: 'center' });
      
      doc.rect(20, 35, 170, 80);
      doc.text(`Date: ${data.date}`, 150, 45);
      
      doc.setFontSize(14); doc.text(data.party_name, 80, 60);
      doc.setFontSize(16); doc.text(`Rs.${data.amount}`, 80, 75);
      
      doc.setFontSize(10);
      doc.text(`Mode: ${data.payment_mode || 'Cash'}`, 30, 90);
      if(data.payment_purpose) doc.text(`Purpose: ${data.payment_purpose}`, 30, 100);

      const pdfData = doc.output('datauristring').split(',')[1];
      await exportService.saveAndOpenFile(pdfData, `Receipt_${data.party_name}.pdf`, 'application/pdf');
  }
};







