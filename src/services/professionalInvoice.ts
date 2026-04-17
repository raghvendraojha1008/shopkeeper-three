import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserProfile } from '../types';
import { exportService } from './export';

// Helper function to format currency — use "Rs." for PDF (jsPDF fonts lack ₹ glyph)
const formatCurrency = (amount: number, symbol: string = 'Rs.'): string => {
    const abs = Math.abs(amount);
    const [intPart, decPart] = abs.toFixed(2).split('.');
    let formatted = '';
    if (intPart.length <= 3) {
        formatted = intPart;
    } else {
        formatted = intPart.slice(-3);
        let rest = intPart.slice(0, -3);
        while (rest.length > 2) {
            formatted = rest.slice(-2) + ',' + formatted;
            rest = rest.slice(0, -2);
        }
        if (rest.length > 0) formatted = rest + ',' + formatted;
    }
    const sym = (symbol === '₹') ? 'Rs.' : symbol;
    return `${amount < 0 ? '-' : ''}${sym}${formatted}.${decPart}`;
};

interface InvoiceItem {
    item_name: string;
    quantity: number;
    unit: string;
    rate: number;
    gst_percent?: number;
    total: number;
}

interface InvoiceData {
    id: string;
    type: 'sales' | 'purchase';
    date: string;
    time?: string;
    invoice_no: string;
    party_name: string;
    party_phone?: string;
    party_address?: string;
    items: InvoiceItem[];
    subtotal: number;
    tax_amount?: number;
    total_amount: number;
    notes?: string;
    payment_mode?: string;
    reference_no?: string;
}

type PrintMode = 'standard' | 'thermal58' | 'thermal80';

export const ProfessionalInvoiceService = {
    /**
     * Generate a professional invoice/receipt PDF
     * Supports multiple paper sizes: A4, 58mm thermal, 80mm thermal
     */
    generateInvoice: async (
        invoiceData: InvoiceData,
        profile: UserProfile,
        printMode: PrintMode = 'standard'
    ): Promise<void> => {
        try {
            // Determine page dimensions based on print mode
            const pageConfig = getPageConfig(printMode);
            const doc = new jsPDF({
                orientation: pageConfig.orientation,
                unit: 'mm',
                format: pageConfig.format,
            });

            let yPos = 10;

            // 1. HEADER SECTION with Logo
            if (profile.logo_base64) {
                try {
                    doc.addImage(
                        profile.logo_base64,
                        'PNG',
                        pageConfig.marginLeft,
                        yPos,
                        25,
                        25
                    );
                    yPos += 28;
                } catch (e) {
                    console.error('Failed to add logo:', e);
                }
            }

            // Business Name
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(profile.firm_name || 'INVOICE', pageConfig.marginLeft, yPos);
            yPos += 8;

            // Business Details
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 70, 80);

            if (profile.address) {
                doc.text(profile.address, pageConfig.marginLeft, yPos);
                yPos += 5;
            }

            const contactLines = [];
            if (profile.contact) contactLines.push(`Phone: ${profile.contact}`);
            if (profile.business_email) contactLines.push(`Email: ${profile.business_email}`);
            if (profile.gstin) contactLines.push(`GSTIN: ${profile.gstin}`);

            contactLines.forEach((line) => {
                doc.text(line, pageConfig.marginLeft, yPos);
                yPos += 4;
            });

            yPos += 2;

            // 2. INVOICE METADATA (Type, Number, Date, Time)
            doc.setDrawColor(200, 210, 220);
            doc.line(pageConfig.marginLeft, yPos, pageConfig.width - pageConfig.marginLeft, yPos);
            yPos += 5;

            const docType = invoiceData.type === 'sales' ? 'INVOICE' : 'PURCHASE ORDER';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(docType, pageConfig.marginLeft, yPos);

            const rightX = pageConfig.width - pageConfig.marginLeft - 50;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`Invoice #: ${invoiceData.invoice_no}`, rightX, yPos);
            yPos += 5;

            doc.text(`Date: ${invoiceData.date}`, rightX, yPos);
            if (invoiceData.time) {
                yPos += 4;
                doc.text(`Time: ${invoiceData.time}`, rightX, yPos);
            }
            yPos += 6;

            // 3. BILL TO SECTION
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(invoiceData.type === 'sales' ? 'BILL TO:' : 'FROM:', pageConfig.marginLeft, yPos);
            yPos += 6;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(invoiceData.party_name || 'N/A', pageConfig.marginLeft, yPos);
            yPos += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(80, 90, 100);
            if (invoiceData.party_phone) {
                doc.text(`Phone: ${invoiceData.party_phone}`, pageConfig.marginLeft, yPos);
                yPos += 4;
            }
            if (invoiceData.party_address) {
                doc.text(invoiceData.party_address, pageConfig.marginLeft, yPos);
                yPos += 4;
            }

            yPos += 3;

            // 4. ITEMS TABLE
            const tableData = (invoiceData.items || []).map((item, idx) => [
                (idx + 1).toString(),
                item.item_name,
                `${item.quantity} ${item.unit}`,
                formatCurrency(item.rate, profile.currency_symbol || '₹'),
                item.gst_percent ? `${item.gst_percent}%` : '-',
                formatCurrency(item.total, profile.currency_symbol || '₹'),
            ]);

            const columnWidths = pageConfig.isThermal
                ? [8, 35, 15, 12, 10, 15]
                : [10, 50, 20, 20, 15, 25];

            autoTable(doc, {
                startY: yPos,
                head: [['Sr.', 'Item Name', 'Qty', 'Unit Price', 'Tax', 'Total']],
                body: tableData,
                columnStyles: {
                    0: { halign: 'center', cellWidth: columnWidths[0] },
                    1: { cellWidth: columnWidths[1] },
                    2: { halign: 'center', cellWidth: columnWidths[2] },
                    3: { halign: 'right', cellWidth: columnWidths[3] },
                    4: { halign: 'center', cellWidth: columnWidths[4] },
                    5: { halign: 'right', cellWidth: columnWidths[5] },
                },
                margin: pageConfig.marginLeft,
                didDrawPage: () => {},
                theme: 'grid',
                headStyles: {
                    fillColor: [226, 232, 240],
                    textColor: [15, 23, 42],
                    fontStyle: 'bold',
                    fontSize: 8,
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: 3,
                },
            });

            yPos = (doc as any).previousAutoTable?.finalY ?? yPos + 5;

            // 5. TOTALS & SUMMARY
            const rightCol = pageConfig.width - pageConfig.marginLeft - 40;
            doc.setDrawColor(200, 210, 220);
            doc.line(rightCol - 5, yPos, pageConfig.width - pageConfig.marginLeft, yPos);
            yPos += 4;

            // Sub-total
            doc.setFontSize(9);
            doc.setTextColor(80, 90, 100);
            doc.text('Sub-Total:', rightCol - 5, yPos);
            doc.text(formatCurrency(invoiceData.subtotal, profile.currency_symbol || '₹'), pageConfig.width - pageConfig.marginLeft - 5, yPos, { align: 'right' });
            yPos += 5;

            // Tax/GST
            if (invoiceData.tax_amount && invoiceData.tax_amount > 0) {
                doc.text('Tax/GST:', rightCol - 5, yPos);
                doc.text(formatCurrency(invoiceData.tax_amount, profile.currency_symbol || '₹'), pageConfig.width - pageConfig.marginLeft - 5, yPos, { align: 'right' });
                yPos += 5;
            }

            // Grand Total (Highlighted)
            doc.setFillColor(240, 245, 250);
            doc.rect(rightCol - 40, yPos - 3, 40, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.text('GRAND TOTAL:', rightCol - 5, yPos);
            doc.text(formatCurrency(invoiceData.total_amount, profile.currency_symbol || '₹'), pageConfig.width - pageConfig.marginLeft - 5, yPos, { align: 'right' });
            yPos += 10;

            // 6. NOTES & PAYMENT INFO
            if (invoiceData.notes || invoiceData.payment_mode) {
                doc.setDrawColor(200, 210, 220);
                doc.line(pageConfig.marginLeft, yPos, pageConfig.width - pageConfig.marginLeft, yPos);
                yPos += 4;

                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(80, 90, 100);

                if (invoiceData.notes) {
                    doc.text(`Notes: ${invoiceData.notes}`, pageConfig.marginLeft, yPos);
                    yPos += 4;
                }

                if (invoiceData.payment_mode) {
                    doc.text(`Payment Mode: ${invoiceData.payment_mode}`, pageConfig.marginLeft, yPos);
                    yPos += 4;
                }

                if (invoiceData.reference_no) {
                    doc.text(`Reference #: ${invoiceData.reference_no}`, pageConfig.marginLeft, yPos);
                    yPos += 4;
                }

                yPos += 2;
            }

            // 7. FOOTER SECTION
            if (profile.terms || profile.authorized_signatory) {
                doc.setDrawColor(200, 210, 220);
                doc.line(pageConfig.marginLeft, yPos, pageConfig.width - pageConfig.marginLeft, yPos);
                yPos += 4;

                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 110, 120);

                if (profile.terms) {
                    const termLines = doc.splitTextToSize(profile.terms, pageConfig.width - 2 * pageConfig.marginLeft);
                    doc.text(termLines, pageConfig.marginLeft, yPos);
                    yPos += termLines.length * 3 + 2;
                }

                // Signatory Section
                if (profile.authorized_signatory) {
                    yPos = Math.max(yPos, pageConfig.height - pageConfig.marginLeft - 15);
                    doc.setTextColor(80, 90, 100);
                    doc.text('Authorized By:', pageConfig.width - pageConfig.marginLeft - 30, yPos);
                    doc.line(
                        pageConfig.width - pageConfig.marginLeft - 40,
                        yPos + 8,
                        pageConfig.width - pageConfig.marginLeft,
                        yPos + 8
                    );
                    doc.setFontSize(7);
                    doc.text(profile.authorized_signatory, pageConfig.width - pageConfig.marginLeft - 30, yPos + 12, { align: 'center' });
                }
            }

            // Save PDF — Android 35: blob → sharePdfBlob (no storage permission needed)
            const fileName = `${docType}_${invoiceData.invoice_no}.pdf`;
            const pdfBlob = doc.output('blob');
            await exportService.sharePdfBlob(pdfBlob, fileName);
        } catch (error) {
            console.error('Invoice generation error:', error);
            throw error;
        }
    },

    /**
     * Print invoice directly to printer
     */
    printInvoice: async (
        invoiceData: InvoiceData,
        profile: UserProfile,
        printMode: PrintMode = 'standard'
    ): Promise<void> => {
        try {
            const pageConfig = getPageConfig(printMode);
            const doc = new jsPDF({
                orientation: pageConfig.orientation,
                unit: 'mm',
                format: pageConfig.format,
            });

            // Generate the document same as PDF
            await ProfessionalInvoiceService.generateInvoice(invoiceData, profile, printMode);

            // Trigger print dialog
            const pdfUrl = doc.output('bloburi') as unknown as string;
            const printWindow = window.open(pdfUrl);
            if (printWindow) {
                printWindow.print();
            }
        } catch (error) {
            console.error('Print error:', error);
            throw error;
        }
    },
};

/**
 * Helper function to get page configuration for different print modes
 */
function getPageConfig(mode: PrintMode) {
    const configs = {
        standard: {
            format: 'a4' as const,
            orientation: 'portrait' as const,
            width: 210,
            height: 297,
            marginLeft: 10,
            marginRight: 10,
            isThermal: false,
        },
        thermal58: {
            format: [58, 150] as [number, number],
            orientation: 'portrait' as const,
            width: 58,
            height: 150,
            marginLeft: 2,
            marginRight: 2,
            isThermal: true,
        },
        thermal80: {
            format: [80, 150] as [number, number],
            orientation: 'portrait' as const,
            width: 80,
            height: 150,
            marginLeft: 3,
            marginRight: 3,
            isThermal: true,
        },
    };

    return configs[mode];
}

// formatMoney is now a standalone helper function defined at the top of this file







