import { strToU8, zipSync } from 'fflate';
import type { Report } from './reports';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xml = (value: unknown) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const ref = (row: number, col: number) => `${String.fromCharCode(64 + col)}${row}`;
type Cell = { type: 'inlineStr' | 'n' | 'str'; value: string; style: number; formula?: string };
class Sheet {
  rows = new Map<number, Map<number, Cell>>();
  heights = new Map<number, number>();
  merges: string[] = [];
  last = 8;
  constructor(
    readonly name: string,
    readonly widths: number[],
  ) {}
  cell(row: number, col: number, cell: Cell) {
    if (!this.rows.has(row)) this.rows.set(row, new Map());
    this.rows.get(row)!.set(col, cell);
    this.last = Math.max(this.last, row);
  }
  text(row: number, col: number, value: unknown, style: number) {
    this.cell(row, col, { type: 'inlineStr', value: String(value ?? ''), style });
  }
  number(row: number, col: number, value: number | null | undefined) {
    this.cell(row, col, { type: 'n', value: String(value ?? 0), style: 5 });
  }
  ratio(row: number, col: number, formula: string, value: number | null | undefined) {
    this.cell(row, col, {
      type: value == null ? 'str' : 'n',
      value: value == null ? '无可用比率' : String(value),
      style: 6,
      formula,
    });
  }
  span(row: number, first: number, end: number, value: unknown, style: number) {
    this.text(row, first, value, style);
    for (let col = first + 1; col <= end; col++) this.text(row, col, '', style);
    this.merges.push(`${ref(row, first)}:${ref(row, end)}`);
  }
  height(row: number, height: number) {
    this.heights.set(row, height);
    this.last = Math.max(this.last, row);
  }
  toXml(chart: boolean) {
    let out = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetPr><tabColor rgb="FF0F514F"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:H${this.last}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">`;
    out += chart
      ? '<selection activeCell="A1" sqref="A1"/>'
      : '<pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A9" sqref="A9"/>';
    out += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="26"/><cols>';
    out += this.widths
      .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
      .join('');
    out += '</cols><sheetData>';
    for (let row = 1; row <= this.last; row++) {
      out += `<row r="${row}" ht="${this.heights.get(row) ?? 26}" customHeight="1">`;
      for (const [col, cell] of [...(this.rows.get(row) ?? [])].sort(([a], [b]) => a - b)) {
        let style = cell.style;
        if (row > 8 && row % 2 === 0)
          style = ({ 0: 8, 2: 9, 5: 10 } as Record<number, number>)[style] ?? style;
        if (style === 0) style = 11;
        out += `<c r="${ref(row, col)}" s="${style}" t="${cell.type}">`;
        if (cell.formula) out += `<f>${xml(cell.formula)}</f>`;
        out +=
          cell.type === 'inlineStr'
            ? `<is><t xml:space="preserve">${xml(cell.value)}</t></is>`
            : `<v>${xml(cell.value)}</v>`;
        out += '</c>';
      }
      out += '</row>';
    }
    out += '</sheetData>';
    if (this.merges.length)
      out += `<mergeCells count="${this.merges.length}">${this.merges.map((value) => `<mergeCell ref="${value}"/>`).join('')}</mergeCells>`;
    out += `<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="${chart ? 1 : 0}"/><headerFooter><oddFooter>${xml('&L快康养 · 公开合成演示报告&R第 &P / &N 页')}</oddFooter></headerFooter>`;
    if (chart) out += '<drawing r:id="rId1"/>';
    return out + '</worksheet>';
  }
}
const beijing = (value: string) =>
  new Date(Date.parse(value) + 8 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
function metadata(s: Sheet, report: Report) {
  [12, 34, 28, 24, 24, 24, 12, 38].forEach((height, index) => s.height(index + 1, height));
  s.span(2, 2, 8, `快康养  ${s.name}`, 1);
  s.span(3, 2, 8, `公开合成演示 · ${report.warning}`, 7);
  s.span(4, 2, 8, `${report.institutionName}    ${report.from} 至 ${report.to}（含结束日）`, 2);
  s.span(
    5,
    2,
    8,
    `生成 / 观察截止：${beijing(report.generatedAt)} 北京时间    来源：${report.sourceFilter}`,
    2,
  );
  s.span(6, 2, 8, `批次：${report.snapshotId}    口径：${report.policyVersion}`, 2);
}

/** Export exactly the persisted preview, never recompute from mutable demo state. */
export async function buildWorkbook(report: Report): Promise<Blob> {
  const summary = new Sheet('报告总览', [3, 36, 18, 15, 15, 15, 15, 15]);
  const profile = new Sheet('需求画像汇总', [3, 24, 30, 16, 16, 16, 16, 16]);
  const institutions = new Sheet('机构服务成果', [3, 30, 16, 16, 16, 16, 16, 18]);
  const methodology = new Sheet('统计口径', [3, 14, 22, 22, 22, 22, 22, 22]);
  const sheets = [summary, profile, institutions, methodology];
  sheets.forEach((sheet) => metadata(sheet, report));
  const m = report.metrics;
  summary.text(8, 2, '期间业务结果', 3);
  summary.text(8, 3, '数量', 3);
  const keys = [
    ['newRequests', '新需求（条）'],
    ['visitIntentRequests', '关联带看意向（条）'],
    ['contactEvents', '联系记录（次）'],
    ['connectedEvents', '已接通（次）'],
    ['noAnswerEvents', '未接通（次）'],
    ['refusedEvents', '拒绝联系（次）'],
    ['confirmedSessions', '首次双方确认（场）'],
    ['rescheduledEvents', '改期（次）'],
    ['arrivedSessions', '实际到访（场）'],
    ['arrivedRequests', '期间到访去重需求（条）'],
    ['cancelledSessions', '取消带看（场）'],
    ['noShowSessions', '明确未到访（场）'],
  ];
  let row = 9;
  for (const [key, label] of keys) {
    summary.text(row, 2, label, 0);
    summary.number(row, 3, m[key]);
    summary.height(row++, 26);
  }
  summary.height(21, 8);
  summary.span(22, 2, 8, '同批需求转化 · 分母为本区间创建的关联需求，观察至生成时刻', 4);
  summary.height(22, 24);
  summary.text(23, 2, '同批需求分母（条）', 0);
  summary.number(23, 3, m.cohortDenominator);
  summary.span(23, 4, 8, '期间到访可以来自旧需求；不能直接除以新需求', 2);
  summary.text(24, 2, '同批到访需求（条）', 0);
  summary.number(24, 3, m.cohortArrivedRequests);
  summary.span(24, 4, 8, '同批中的需求至少有一场明确到访才计入', 2);
  summary.text(25, 2, '同批到访率', 4);
  summary.ratio(25, 3, 'IF(C23=0,"无可用比率",C24/C23)', m.cohortArrivalRate);
  summary.span(25, 4, 8, '分母为0时无可用比率；不是期间活动相除', 2);
  summary.text(26, 2, '同批已接通需求（条）', 0);
  summary.number(26, 3, m.cohortContactedRequests);
  summary.span(26, 4, 8, `同批有来源入住反馈：${m.cohortMovedInRequests} 条（不代表签约）`, 2);
  summary.span(27, 2, 8, '平台总数按需求去重，不相加机构行；缺少访问埋点，不展示UV/PV。', 2);
  summary.height(27, 24);

  profile.text(8, 2, '画像维度', 3);
  profile.text(8, 3, '分类', 3);
  profile.text(8, 4, '需求数（条）', 3);
  profile.span(8, 5, 8, '来源 / 缺失与小样本处理', 3);
  row = 9;
  for (const p of report.profiles) {
    profile.text(row, 2, p.dimension, 0);
    profile.text(row, 3, p.category, 0);
    if (p.count === null) profile.text(row, 4, '不展示', 2);
    else profile.number(row, 4, p.count);
    profile.span(row, 5, 8, p.note, 2);
    profile.height(row++, 44);
  }
  row++;
  profile.span(row++, 2, 8, '来源分开计数（同批需求，不混入真实获客）', 4);
  const sourceLabels: Record<string, string> = {
    MINIPROGRAM: '小程序主动申请',
    OFFLINE_MANUAL: '线下人工来源',
    SELF_TEST: '员工自测',
    SYNTHETIC_TEST_ONLY: '合成测试',
    UNKNOWN: '来源未知',
  };
  for (const source of report.sources) {
    profile.span(row, 2, 3, sourceLabels[source.source] ?? '来源未知', 0);
    profile.number(row, 4, source.count);
    profile.height(row++, 26);
  }

  [
    '机构',
    '新需求\n条',
    '带看意向\n条',
    '期间确认\n场',
    '期间到访\n场',
    '到访需求\n去重条数',
    '入住反馈\n有来源次数',
  ].forEach((label, i) => institutions.text(8, i + 2, label, 3));
  row = 9;
  for (const institution of report.institutions) {
    institutions.text(row, 2, institution.institutionName, 0);
    [
      'newRequests',
      'visitIntentRequests',
      'confirmedSessions',
      'arrivedSessions',
      'arrivedRequests',
      'movedInFeedbackEvents',
    ].forEach((key, i) => institutions.number(row, i + 3, institution.metrics[key]));
    institutions.height(row++, 36);
  }
  if (row === 9)
    institutions.span(row++, 2, 8, '该范围无机构关联需求，平台未定机构需求仅计入总览。', 2);
  row++;
  institutions.span(row++, 2, 8, '同批需求转化（各机构独立去重，不能相加）', 4);
  [
    '机构',
    '分母\n需求条数',
    '同批接通\n需求条数',
    '同批到访\n需求条数',
    '同批入住反馈\n需求条数',
    '同批到访率',
    '观察截止',
  ].forEach((label, i) => institutions.text(row, i + 2, label, 3));
  institutions.height(row++, 38);
  for (const institution of report.institutions) {
    const metric = institution.metrics;
    institutions.text(row, 2, institution.institutionName, 0);
    [
      'cohortDenominator',
      'cohortContactedRequests',
      'cohortArrivedRequests',
      'cohortMovedInRequests',
    ].forEach((key, i) => institutions.number(row, i + 3, metric[key]));
    institutions.ratio(
      row,
      7,
      `IF(C${row}=0,"无可用比率",E${row}/C${row})`,
      metric.cohortArrivalRate,
    );
    institutions.text(row, 8, '本批生成时刻', 2);
    institutions.height(row++, 36);
  }
  row++;
  institutions.span(row++, 2, 8, '关联需求的联系事件与机构专属看院分开；平台去重数见报告总览。', 2);
  institutions.span(
    row,
    2,
    8,
    '尚未确定机构的需求可能只计入平台总览；不会将平台全部需求归给各机构。',
    2,
  );
  institutions.height(row++, 32);
  institutions.span(row, 2, 8, '本报告范围的期间后续反馈（仅有明确来源的记录）', 4);
  institutions.height(row++, 24);
  institutions.text(row, 2, '已入住反馈（次）', 0);
  institutions.number(row, 3, m.movedInFeedbackEvents);
  institutions.text(row, 4, '未入住反馈（次）', 0);
  institutions.number(row, 5, m.notMovedInFeedbackEvents);
  institutions.text(row, 6, '未知反馈（次）', 0);
  institutions.number(row, 7, m.unknownFeedbackEvents);
  institutions.height(row++, 36);
  institutions.span(
    row,
    2,
    8,
    '未收到反馈不等于未入住；仅记录服务结果，不代表签约、佣金或结算。',
    2,
  );
  institutions.height(row, 28);
  methodology.text(8, 2, '序号', 3);
  methodology.span(8, 3, 8, '统计规则与使用边界', 3);
  row = 9;
  for (const rule of report.rules) {
    methodology.number(row, 2, row - 8);
    methodology.span(row, 3, 8, rule, 0);
    methodology.height(row++, 36);
  }

  const files: Record<string, Uint8Array> = {};
  const put = (name: string, value: string) => {
    files[name] = strToU8(value);
  };
  put('[Content_Types].xml', contentTypes);
  put('_rels/.rels', rels('officeDocument', 'xl/workbook.xml'));
  let workbook = `<workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>`;
  let relationships =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  sheets.forEach((sheet, i) => {
    workbook += `<sheet name="${sheet.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
    relationships += `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
    put(`xl/worksheets/sheet${i + 1}.xml`, sheet.toXml(i === 0));
  });
  workbook += '</sheets><definedNames>';
  sheets.forEach((sheet, i) => {
    workbook += `<definedName name="_xlnm.Print_Area" localSheetId="${i}">'${sheet.name}'!$B$1:$H$${sheet.last}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${sheet.name}'!$8:$8</definedName>`;
  });
  workbook += '</definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
  relationships += `<Relationship Id="rId5" Type="${REL}/styles" Target="styles.xml"/></Relationships>`;
  put('xl/workbook.xml', workbook);
  put('xl/_rels/workbook.xml.rels', relationships);
  put('xl/styles.xml', styles);
  put('xl/worksheets/_rels/sheet1.xml.rels', rels('drawing', '../drawings/drawing1.xml'));
  put('xl/drawings/_rels/drawing1.xml.rels', rels('chart', '../charts/chart1.xml'));
  put('xl/drawings/drawing1.xml', drawing);
  put('xl/charts/chart1.xml', chart(report));
  return new Blob([zipSync(files, { level: 6 }).slice().buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
const rels = (type: string, target: string) =>
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/${type}" Target="${target}"/></Relationships>`;

const styles =
  '      <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n      <numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>\n      <fonts count="5"><font><sz val="11"/><color rgb="FF213A36"/><name val="Microsoft YaHei"/></font><font><b/><sz val="17"/><color rgb="FF0F514F"/><name val="Microsoft YaHei"/></font><font><sz val="10"/><color rgb="FF61736F"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FF176C65"/><name val="Microsoft YaHei"/></font></fonts>\n      <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F514F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F5EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7FBF8"/><bgColor indexed="64"/></patternFill></fill></fills>\n      <borders count="4"><border/><border><bottom style="thin"><color rgb="FFE4EEE8"/></bottom></border><border><bottom style="thin"><color rgb="FF34A48A"/></bottom></border><border><right style="thin"><color rgb="FFFFFFFF"/></right></border></borders>\n      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\n      <cellXfs count="12">\n      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>\n      <xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>\n      <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>\n      <xf numFmtId="0" fontId="3" fillId="2" borderId="3" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>\n      <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>\n      <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" indent="1" vertical="center"/></xf>\n      <xf numFmtId="165" fontId="4" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" indent="1" vertical="center" wrapText="1"/></xf>\n      <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>\n      <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>\n      <xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>\n      <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" indent="1" vertical="center"/></xf>\n      <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>\n      </cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
const drawing =
  '      <xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>3</xdr:col><xdr:colOff>140000</xdr:colOff><xdr:row>7</xdr:row><xdr:rowOff>100000</xdr:rowOff></xdr:from><xdr:ext cx="5905500" cy="4095750"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="期间联系结果"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>';
const contentTypes =
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>';
function chart(report: Report) {
  const cache = ['connectedEvents', 'noAnswerEvents', 'refusedEvents']
    .map((key, i) => `<c:pt idx="${i}"><c:v>${report.metrics[key] ?? 0}</c:v></c:pt>`)
    .join('');
  return (
    '        <c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:lang val="zh-CN"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" sz="1200"><a:solidFill><a:srgbClr val="0F514F"/></a:solidFill><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:rPr><a:t>期间联系结果（次）</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>实际联系记录</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="34A48A"/></a:solidFill></c:spPr><c:cat><c:strRef><c:f>\'报告总览\'!$B$12:$B$14</c:f><c:strCache><c:ptCount val="3"/><c:pt idx="0"><c:v>已接通</c:v></c:pt><c:pt idx="1"><c:v>未接通</c:v></c:pt><c:pt idx="2"><c:v>拒绝联系</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>\'报告总览\'!$C$12:$C$14</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="3"/>' +
    cache +
    '        </c:numCache></c:numRef></c:val></c:ser><c:gapWidth val="110"/><c:axId val="1"/><c:axId val="2"/></c:barChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="2"/><c:crosses val="autoZero"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="E4EEE8"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="1"/><c:crosses val="autoZero"/><c:crossBetween val="between"/><c:majorUnit val="1"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>'
  );
}
