import { BadRequestException, Injectable } from '@nestjs/common';
import { Between, DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Payment } from '../entities/payment.entity';
import { Expense } from '../../cash/entities/expense.entity';

interface DayInfo {
  key: string;
  year: number;
  month: number;
  day: number;
}

interface DayGroup {
  info: DayInfo;
  payments: Payment[];
  expenses: Expense[];
}

interface Transaction {
  type: string;
  dateValue: Date;
  date: string;
  concept: string;
  method: string;
  saleNumber: string;
  amount: number;
  transferTime: string;
  isMixed: boolean;
}

@Injectable()
export class CashReportService {
  constructor(private readonly dataSource: DataSource) {}

  async exportCashReport(
    startDate?: string,
    endDate?: string,
  ): Promise<{ buffer: ExcelJS.Buffer; filename: string }> {
    const generatedAt = new Date();
    const { start, end, hasRange } = this.resolveRange(startDate, endDate);

    const paymentRepo = this.dataSource.getRepository(Payment);
    const expenseRepo = this.dataSource.getRepository(Expense);

    const payments = await paymentRepo.find({
      relations: ['paymentMethod', 'sale', 'sale.items', 'sale.items.product'],
      where: { sale: { isCanceled: false, createdAt: Between(start, end) } },
      order: { createdAt: 'ASC' },
    });

    const expenses = await expenseRepo.find({
      relations: ['paymentMethod'],
      where: { createdAt: Between(start, end) },
      order: { createdAt: 'ASC' },
    });

    const workbook = new ExcelJS.Workbook();
    const dayGroups = new Map<string, DayGroup>();

    const addToGroup = (date: Date, kind: 'payment' | 'expense', item: Payment | Expense) => {
      const info = this.getLimaDayInfo(date);
      const existing = dayGroups.get(info.key);
      const group: DayGroup = existing ?? { info, payments: [], expenses: [] };
      if (kind === 'payment') {
        group.payments.push(item as Payment);
      } else {
        group.expenses.push(item as Expense);
      }
      if (!existing) {
        dayGroups.set(info.key, group);
      }
    };

    payments.forEach((p) => addToGroup(p.sale?.createdAt ?? p.createdAt, 'payment', p));
    expenses.forEach((e) => addToGroup(e.createdAt, 'expense', e));

    const groups = Array.from(dayGroups.values()).sort((a, b) =>
      a.info.key.localeCompare(b.info.key),
    );

    if (!groups.length) {
      this.addDailySheet(
        workbook,
        'SIN DATOS',
        this.buildRangeLabel(start, end, hasRange),
        generatedAt,
        [],
        [],
      );
    } else {
      groups.forEach((group) => {
        const label = this.buildDayLabel(group.info);
        const sheetName = label.length > 31 ? label.slice(0, 31) : label;
        this.addDailySheet(
          workbook,
          sheetName,
          `Fecha: ${label}`,
          generatedAt,
          group.payments,
          group.expenses,
        );

        const inventoryLabel = this.buildInventoryDayLabel(group.info);
        const inventorySheetName =
          inventoryLabel.length > 31 ? inventoryLabel.slice(0, 31) : inventoryLabel;
        this.addInventorySheet(
          workbook,
          inventorySheetName,
          inventoryLabel,
          generatedAt,
          group.payments,
        );
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `reporte-caja-${this.buildFileStamp(generatedAt)}.xlsx`;
    return { buffer, filename };
  }

  private addDailySheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    rangeLabel: string,
    generatedAt: Date,
    payments: Payment[],
    expenses: Expense[],
  ): void {
    // netAmount is always persisted at sale creation time; fall back to amount if zero (legacy rows)
    const totalSales = payments.reduce(
      (acc, p) => acc + Number(p.netAmount !== 0 ? p.netAmount : p.amount),
      0,
    );
    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const netTotal = Number((totalSales - totalExpenses).toFixed(2));

    const methodTotals = new Map<number, { name: string; total: number }>();
    payments.forEach((p) => {
      const key = p.paymentMethod?.id;
      if (!key) return;
      const current = methodTotals.get(key) ?? { name: p.paymentMethod.name, total: 0 };
      current.total += Number(p.netAmount !== 0 ? p.netAmount : p.amount);
      methodTotals.set(key, current);
    });

    const expenseMethodTotals = new Map<number, { name: string; total: number }>();
    expenses.forEach((e) => {
      const key = e.paymentMethod?.id;
      if (!key) return;
      const current = expenseMethodTotals.get(key) ?? { name: e.paymentMethod.name, total: 0 };
      current.total += Number(e.amount);
      expenseMethodTotals.set(key, current);
    });

    const netByMethod = new Map<number, { name: string; total: number }>();
    for (const [methodId, sales] of methodTotals.entries()) {
      const expensesByMethod = expenseMethodTotals.get(methodId);
      netByMethod.set(methodId, {
        name: sales.name,
        total: Number((sales.total - (expensesByMethod?.total ?? 0)).toFixed(2)),
      });
    }
    for (const [methodId, expense] of expenseMethodTotals.entries()) {
      if (netByMethod.has(methodId)) continue;
      netByMethod.set(methodId, {
        name: expense.name,
        total: Number((0 - expense.total).toFixed(2)),
      });
    }

    const buildSaleConcept = (payment: Payment): string => {
      const items = payment.sale?.items ?? [];
      if (!items.length) return 'Pago';
      const lines = items
        .map((item) => {
          const name = item.product?.name?.trim();
          if (!name) return '';
          const quantity = Number(item.quantity ?? 0);
          const subtotal = Number(item.subtotal ?? 0);
          return `${quantity} x ${name} (${subtotal.toFixed(2)})`;
        })
        .filter(Boolean);
      return lines.length ? lines.join('\n') : 'Pago';
    };

    const paymentCountBySaleId = new Map<number, number>();
    payments.forEach((p) => {
      const saleId = p.sale?.id;
      if (!saleId) return;
      paymentCountBySaleId.set(saleId, (paymentCountBySaleId.get(saleId) ?? 0) + 1);
    });
    const mixedSaleIds = new Set<number>(
      Array.from(paymentCountBySaleId.entries())
        .filter(([, count]) => count > 1)
        .map(([saleId]) => saleId),
    );

    const transactions: Transaction[] = [
      ...payments.map((p) => ({
        type: 'Venta',
        dateValue: p.sale?.createdAt ?? p.createdAt,
        date: this.formatLimaDateTime(p.sale?.createdAt ?? p.createdAt),
        concept: buildSaleConcept(p),
        method:
          p.sale?.id && mixedSaleIds.has(p.sale.id)
            ? `${p.paymentMethod?.name ?? 'N/D'} (MIXTO)`
            : (p.paymentMethod?.name ?? 'N/D'),
        saleNumber: p.sale?.saleNumber ?? '',
        amount: Number(p.netAmount !== 0 ? p.netAmount : p.amount),
        transferTime: p.transferTime ?? '',
        isMixed: p.sale?.id ? mixedSaleIds.has(p.sale.id) : false,
      })),
      ...expenses.map((e) => ({
        type: 'Gasto',
        dateValue: e.createdAt,
        date: this.formatLimaDateTime(e.createdAt),
        concept: e.description,
        method: e.paymentMethod?.name ?? 'N/D',
        saleNumber: '',
        amount: Number(-e.amount),
        transferTime: '',
        isMixed: false,
      })),
    ].sort((a, b) => b.dateValue.getTime() - a.dateValue.getTime());

    const sheet = workbook.addWorksheet(sheetName);

    const titleFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    const subtitleFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    const zebraFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFB' },
    };
    const mixedFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFBEB' },
    };
    const kpiGreen: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' },
    };
    const kpiRed: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' },
    };
    const kpiBlue: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDBEAFE' },
    };
    const resumenTitleFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    const ventasTitleFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF86EFAC' },
    };
    const ventasBodyFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCFCE7' },
    };
    const gastosTitleFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFCA5A5' },
    };
    const gastosBodyFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' },
    };
    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };

    const applyRowBorder = (row: ExcelJS.Row, fromCol: number, toCol: number): void => {
      for (let col = fromCol; col <= toCol; col += 1) {
        row.getCell(col).border = borderThin;
      }
    };

    // Row 1 — title
    const titleRow = sheet.addRow(['REPORTE DE CAJA']);
    titleRow.height = 20;
    sheet.mergeCells('A1', 'G1');
    const titleCell = titleRow.getCell(1);
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = titleFill;

    // Row 2 — range label
    const rangeRow = sheet.addRow([rangeLabel]);
    rangeRow.height = 18;
    sheet.mergeCells('A2', 'G2');
    const rangeCell = rangeRow.getCell(1);
    rangeCell.font = { bold: true };
    rangeCell.alignment = { vertical: 'middle', horizontal: 'center' };
    rangeCell.fill = subtitleFill;

    // Row 3 — generated timestamp
    const generatedRow = sheet.addRow([`Generado: ${this.formatLimaDateTimeHuman(generatedAt)}`]);
    sheet.mergeCells('A3', 'G3');
    generatedRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    generatedRow.getCell(1).fill = subtitleFill;

    sheet.addRow([]);

    // KPI block (starts at row 5)
    const resumenStartRow = (sheet.lastRow?.number ?? 3) + 1;

    const resumenRow = sheet.getRow(resumenStartRow);
    resumenRow.getCell(1).value = 'Resumen';
    resumenRow.getCell(1).font = { bold: true, color: { argb: 'FF111827' } };
    resumenRow.getCell(1).fill = resumenTitleFill;
    sheet.mergeCells(`A${resumenStartRow}:B${resumenStartRow}`);
    resumenRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    applyRowBorder(resumenRow, 1, 2);

    const totalSalesRow = sheet.getRow(resumenStartRow + 1);
    totalSalesRow.getCell(1).value = 'Total ventas';
    totalSalesRow.getCell(2).value = totalSales;
    totalSalesRow.getCell(1).fill = kpiGreen;
    totalSalesRow.getCell(2).fill = kpiGreen;

    const totalExpensesRow = sheet.getRow(resumenStartRow + 2);
    totalExpensesRow.getCell(1).value = 'Total egresos';
    totalExpensesRow.getCell(2).value = -totalExpenses;
    totalExpensesRow.getCell(1).fill = kpiRed;
    totalExpensesRow.getCell(2).fill = kpiRed;

    const netRow = sheet.getRow(resumenStartRow + 3);
    netRow.getCell(1).value = 'Neto';
    netRow.getCell(2).value = netTotal;
    netRow.getCell(1).fill = kpiBlue;
    netRow.getCell(2).fill = kpiBlue;
    netRow.font = { bold: true };

    const netMethodTitleRow = sheet.getRow(resumenStartRow + 4);
    netMethodTitleRow.getCell(1).value = 'Neto por metodo';
    netMethodTitleRow.getCell(1).font = { bold: true, color: { argb: 'FF111827' } };
    netMethodTitleRow.getCell(1).fill = resumenTitleFill;
    sheet.mergeCells(`A${resumenStartRow + 4}:B${resumenStartRow + 4}`);
    netMethodTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const netMethodRows: ExcelJS.Row[] = [];
    const orderedNetMethods = Array.from(netByMethod.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    orderedNetMethods.forEach((method, index) => {
      const row = sheet.getRow(resumenStartRow + 5 + index);
      row.getCell(1).value = `Neto ${method.name}`;
      row.getCell(2).value = method.total;
      row.getCell(1).fill = kpiBlue;
      row.getCell(2).fill = kpiBlue;
      row.font = { bold: true };
      row.height = 18;
      netMethodRows.push(row);
    });

    [totalSalesRow, totalExpensesRow, netRow, netMethodTitleRow, ...netMethodRows].forEach((row) =>
      applyRowBorder(row, 1, 2),
    );
    [totalSalesRow, totalExpensesRow, netRow, ...netMethodRows].forEach((row) => {
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    // Side-by-side method tables (columns D-E = ventas, F-G = gastos)
    const writeMethodTable = (
      title: string,
      totals: Map<number, { name: string; total: number }>,
      startRow: number,
      startCol: number,
      tFill: ExcelJS.Fill,
      bFill: ExcelJS.Fill,
    ): number => {
      if (!totals.size) return 0;

      const mTitleRow = sheet.getRow(startRow);
      mTitleRow.getCell(startCol).value = title;
      mTitleRow.getCell(startCol).font = { bold: true, color: { argb: 'FF111827' } };
      mTitleRow.getCell(startCol).fill = tFill;
      sheet.mergeCells(startRow, startCol, startRow, startCol + 1);
      mTitleRow.getCell(startCol).alignment = { vertical: 'middle', horizontal: 'center' };
      applyRowBorder(mTitleRow, startCol, startCol + 1);

      const mHeaderRow = sheet.getRow(startRow + 1);
      mHeaderRow.getCell(startCol).value = 'Metodo';
      mHeaderRow.getCell(startCol + 1).value = 'Total';
      mHeaderRow.font = { bold: true };
      mHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
      for (let col = startCol; col <= startCol + 1; col += 1) {
        const cell = mHeaderRow.getCell(col);
        cell.fill = bFill;
        cell.border = borderThin;
      }

      let offset = 0;
      for (const { name, total } of totals.values()) {
        const row = sheet.getRow(startRow + 2 + offset);
        row.getCell(startCol).value = name;
        row.getCell(startCol + 1).value = total;
        row.getCell(startCol + 1).numFmt = '#,##0.00';
        row.getCell(startCol).fill = bFill;
        row.getCell(startCol + 1).fill = bFill;
        applyRowBorder(row, startCol, startCol + 1);
        offset += 1;
      }
      return 2 + totals.size;
    };

    const salesMethodHeight = writeMethodTable(
      'Ventas por metodo',
      methodTotals,
      resumenStartRow,
      4,
      ventasTitleFill,
      ventasBodyFill,
    );
    const expenseMethodHeight = writeMethodTable(
      'Gastos por metodo',
      expenseMethodTotals,
      resumenStartRow,
      6,
      gastosTitleFill,
      gastosBodyFill,
    );

    const resumenHeight = 5 + Math.max(orderedNetMethods.length, 1);
    const blockHeight = Math.max(resumenHeight, salesMethodHeight, expenseMethodHeight);
    const txHeaderRow = resumenStartRow + blockHeight + 1;

    // Transaction detail table
    const txHeader = sheet.getRow(txHeaderRow);
    txHeader.getCell(1).value = 'Tipo';
    txHeader.getCell(2).value = 'Fecha';
    txHeader.getCell(3).value = 'Concepto';
    txHeader.getCell(4).value = 'Metodo';
    txHeader.getCell(5).value = 'No. Venta';
    txHeader.getCell(6).value = 'Monto';
    txHeader.getCell(7).value = 'Hora transferencia';
    txHeader.font = { bold: true };
    txHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    txHeader.height = 18;
    txHeader.eachCell((cell) => {
      cell.fill = headerFill;
      cell.border = borderThin;
    });

    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 22;
    sheet.getColumn(3).width = 28;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 16;
    sheet.getColumn(6).width = 14;
    sheet.getColumn(7).width = 16;

    let txTotal = 0;
    transactions.forEach((tx, index) => {
      const row = sheet.addRow([
        tx.type,
        this.toLimaExcelDate(tx.dateValue),
        tx.concept,
        tx.method,
        tx.saleNumber,
        tx.amount,
        tx.transferTime ?? '',
      ]);
      row.getCell(2).numFmt = 'yyyy-mm-dd hh:mm:ss';
      row.getCell(6).numFmt = '#,##0.00';
      row.alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

      if (tx.isMixed) {
        row.eachCell((cell) => {
          cell.fill = mixedFill;
        });
      } else if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = zebraFill;
        });
      }
      row.eachCell((cell) => {
        cell.border = borderThin;
      });

      const conceptLines = tx.concept.split('\n');
      const maxLineLength = Math.max(...conceptLines.map((line) => line.length), 0);
      const estimatedLines = Math.max(conceptLines.length, Math.ceil(maxLineLength / 40));
      if (estimatedLines > 1) {
        row.height = Math.min(120, 18 + (estimatedLines - 1) * 14);
      }

      txTotal += Number(tx.amount);
    });

    const totalRow = sheet.addRow(['', '', '', '', 'TOTAL', txTotal, '']);
    totalRow.font = { bold: true };
    totalRow.getCell(6).numFmt = '#,##0.00';
    totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.eachCell((cell) => {
      cell.border = borderThin;
      cell.fill = headerFill;
    });

    sheet.views = [{ state: 'frozen', ySplit: txHeader.number }];
    sheet.autoFilter = {
      from: { row: txHeader.number, column: 1 },
      to: { row: txHeader.number, column: 7 },
    };
  }

  private addInventorySheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    label: string,
    generatedAt: Date,
    payments: Payment[],
  ): void {
    // Deduplicate sales (a sale can have multiple payments)
    const salesMap = new Map<number, Payment['sale']>();
    payments.forEach((payment) => {
      if (payment.sale?.id) {
        salesMap.set(payment.sale.id, payment.sale);
      }
    });

    const productTotals = new Map<number, { name: string; quantity: number }>();
    salesMap.forEach((sale) => {
      sale?.items?.forEach((item) => {
        const productId = item.product?.id;
        if (!productId || !item.product?.name) return;
        const current = productTotals.get(productId) ?? {
          name: item.product.name,
          quantity: 0,
        };
        current.quantity += Number(item.quantity ?? 0);
        productTotals.set(productId, current);
      });
    });

    const sheet = workbook.addWorksheet(sheetName);

    const titleFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    const subtitleFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    const zebraFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFB' },
    };
    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };

    const applyRowBorder = (row: ExcelJS.Row, fromCol: number, toCol: number): void => {
      for (let col = fromCol; col <= toCol; col += 1) {
        row.getCell(col).border = borderThin;
      }
    };

    const invTitleRow = sheet.addRow(['INVENTARIO DE VENTAS']);
    invTitleRow.height = 20;
    sheet.mergeCells('A1', 'B1');
    const invTitleCell = invTitleRow.getCell(1);
    invTitleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    invTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    invTitleCell.fill = titleFill;

    const rangeRow = sheet.addRow([label]);
    rangeRow.height = 18;
    sheet.mergeCells('A2', 'B2');
    const rangeCell = rangeRow.getCell(1);
    rangeCell.font = { bold: true };
    rangeCell.alignment = { vertical: 'middle', horizontal: 'center' };
    rangeCell.fill = subtitleFill;

    const generatedRow = sheet.addRow([`Generado: ${this.formatLimaDateTimeHuman(generatedAt)}`]);
    sheet.mergeCells('A3', 'B3');
    generatedRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    generatedRow.getCell(1).fill = subtitleFill;

    sheet.addRow([]);

    const headerRow = sheet.addRow(['Producto', 'Cantidad']);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 18;
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.border = borderThin;
    });

    sheet.getColumn(1).width = 40;
    sheet.getColumn(2).width = 14;

    const sortedProducts = Array.from(productTotals.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    sortedProducts.forEach((product, index) => {
      const row = sheet.addRow([product.name, product.quantity]);
      row.getCell(2).numFmt = '#,##0';
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = zebraFill;
        });
      }
      applyRowBorder(row, 1, 2);
    });
  }

  // ──────────────────────────── helpers ─────────────────────────────

  private resolveRange(
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date; hasRange: boolean } {
    const hasStart = Boolean(startDate);
    const hasEnd = Boolean(endDate);

    const start = hasStart
      ? this.parseDateInput(startDate as string, false)
      : new Date('1970-01-01T00:00:00-05:00');
    const end = hasEnd
      ? this.parseDateInput(endDate as string, true)
      : new Date('9999-12-31T23:59:59.999-05:00');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (start > end) {
      throw new BadRequestException('startDate cannot be greater than endDate');
    }
    return { start, end, hasRange: hasStart || hasEnd };
  }

  private parseDateInput(input: string, isEnd: boolean): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return new Date(`${input}T${isEnd ? '23:59:59.999' : '00:00:00.000'}-05:00`);
    }
    return new Date(input);
  }

  private formatLimaDateTime(date: Date): string {
    const fmt = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  }

  /** Converts a UTC Date to a UTC Date whose numeric parts match Lima local time,
   *  so ExcelJS renders it correctly with format 'yyyy-mm-dd hh:mm:ss'. */
  private toLimaExcelDate(date: Date): Date {
    const fmt = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    return new Date(
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
      ),
    );
  }

  private formatLimaDateTimeHuman(date: Date): string {
    const fmt = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return fmt.format(date).replace(',', '');
  }

  private buildRangeLabel(start: Date, end: Date, hasRange: boolean): string {
    if (!hasRange) return 'Rango: Todos los registros';
    return `Rango: del ${this.formatLimaDateTimeHuman(start)} al ${this.formatLimaDateTimeHuman(end)}`;
  }

  private getLimaDayInfo(date: Date): DayInfo {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    return { key: `${parts.year}-${parts.month}-${parts.day}`, year, month, day };
  }

  private buildDayLabel(info: DayInfo): string {
    const weekdays = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const months = [
      'ENE',
      'FEB',
      'MAR',
      'ABR',
      'MAY',
      'JUN',
      'JUL',
      'AGO',
      'SEP',
      'OCT',
      'NOV',
      'DIC',
    ];
    const dateUtc = new Date(Date.UTC(info.year, info.month - 1, info.day));
    const weekday = weekdays[dateUtc.getUTCDay()];
    const day = String(info.day).padStart(2, '0');
    const month = months[info.month - 1];
    return `${weekday}, ${day} ${month} ${info.year}`;
  }

  private buildInventoryDayLabel(info: DayInfo): string {
    const weekdays = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const months = [
      'ENE',
      'FEB',
      'MAR',
      'ABR',
      'MAY',
      'JUN',
      'JUL',
      'AGO',
      'SEP',
      'OCT',
      'NOV',
      'DIC',
    ];
    const dateUtc = new Date(Date.UTC(info.year, info.month - 1, info.day));
    const weekday = weekdays[dateUtc.getUTCDay()];
    const day = String(info.day).padStart(2, '0');
    const month = months[info.month - 1];
    return `INVENTARIO de ${weekday}, ${day} DE ${month} ${info.year}`;
  }

  private buildFileStamp(date: Date): string {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
  }
}
