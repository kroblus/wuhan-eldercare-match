import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildWorkbook } from './workbook';
import { buildReport, type Report } from './reports';
import type { DemoState } from './types';

function sample(): Report {
  const state: DemoState = {
    schemaVersion: 1,
    syntheticMarker: 'P1_PUBLIC_DEMO_SYNTHETIC_ONLY',
    seedVersion: 1,
    datasetId: 'synthetic-workbook',
    generation: 0,
    anchorDay: '2040-01-02',
    session: true,
    requests: {},
    institutions: {},
    reports: {},
    blocks: {},
    capacities: {},
    receipts: {},
  };
  const report = buildReport(
    state,
    { from: '2040-01-02', to: '2040-01-02' },
    new Date('2040-01-02T04:00:00Z'),
  );
  report.metrics = {
    ...report.metrics,
    newRequests: 30,
    contactEvents: 9,
    connectedEvents: 6,
    noAnswerEvents: 2,
    refusedEvents: 1,
    cohortDenominator: 30,
    cohortArrivedRequests: 12,
    cohortArrivalRate: 0.4,
  };
  report.institutions = [{ institutionName: '合成演示甲机构', metrics: { ...report.metrics } }];
  return report;
}
async function unzip(blob: Blob) {
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  return Object.fromEntries(
    Object.entries(unzipSync(new Uint8Array(bytes))).map(([name, value]) => [
      name,
      strFromU8(value),
    ]),
  );
}
function parse(value: string) {
  const doc = new DOMParser().parseFromString(value, 'application/xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc;
}
function cell(doc: Document, address: string) {
  return doc.querySelector(`c[r="${address}"]`)!;
}

describe('public-demo real OOXML export', () => {
  it('has four visible green sheets, same snapshot, chart, print settings and latest pane/default-border fixes', async () => {
    const report = sample(),
      blob = await buildWorkbook(report),
      files = await unzip(blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    for (const value of Object.values(files)) parse(value);
    const workbook = parse(files['xl/workbook.xml']);
    expect([...workbook.querySelectorAll('sheet')].map((s) => s.getAttribute('name'))).toEqual([
      '报告总览',
      '需求画像汇总',
      '机构服务成果',
      '统计口径',
    ]);
    expect(workbook.querySelector('sheet[state="hidden"]')).toBeNull();
    expect(workbook.querySelectorAll('definedName[name="_xlnm.Print_Area"]')).toHaveLength(4);
    expect(workbook.querySelector('calcPr')?.getAttribute('fullCalcOnLoad')).toBe('1');
    for (let n = 1; n <= 4; n++) {
      const doc = parse(files[`xl/worksheets/sheet${n}.xml`]);
      expect(doc.documentElement.textContent).toContain(report.snapshotId);
      expect(doc.documentElement.textContent).toContain('公开合成演示');
      expect(doc.querySelector('tabColor')?.getAttribute('rgb')).toBe('FF0F514F');
      expect(doc.querySelector('pageSetup')?.getAttribute('orientation')).toBe('landscape');
      expect(doc.querySelector('sheetView')?.getAttribute('showGridLines')).toBe('0');
      if (n === 1) expect(doc.querySelector('pane')).toBeNull();
      else {
        expect(doc.querySelector('pane')?.getAttribute('ySplit')).toBe('8');
        expect(doc.querySelector('pane')?.hasAttribute('xSplit')).toBe(false);
      }
    }
    const styles = parse(files['xl/styles.xml']);
    expect(styles.querySelector('cellXfs > xf')?.getAttribute('borderId')).toBe('0');
    expect(styles.querySelector('numFmt[numFmtId="165"]')?.getAttribute('formatCode')).toBe('0.0%');
    const chart = parse(files['xl/charts/chart1.xml']);
    expect(
      [...chart.getElementsByTagName('c:numCache')[0].getElementsByTagName('c:v')].map((v) =>
        Number(v.textContent),
      ),
    ).toEqual([6, 2, 1]);
    expect(files['xl/charts/chart1.xml']).toContain('34A48A');
    expect(Object.keys(files).some((path) => /externalLink|vbaProject|\.bin$/.test(path))).toBe(
      false,
    );
    expect(Object.values(files).join('')).not.toMatch(
      /TargetMode="External"|contactPhone|assistanceNote/,
    );
  });

  it('stores quantities as numeric cells and ratio formulas with correct cached snapshot values', async () => {
    const files = await unzip(await buildWorkbook(sample()));
    const summary = parse(files['xl/worksheets/sheet1.xml']);
    expect(cell(summary, 'C9').getAttribute('t')).toBe('n');
    expect(cell(summary, 'C9').querySelector('v')?.textContent).toBe('30');
    expect(cell(summary, 'C23').querySelector('v')?.textContent).toBe('30');
    expect(cell(summary, 'C24').querySelector('v')?.textContent).toBe('12');
    expect(cell(summary, 'C25').querySelector('f')?.textContent).toBe(
      'IF(C23=0,"无可用比率",C24/C23)',
    );
    expect(cell(summary, 'C25').querySelector('v')?.textContent).toBe('0.4');
    const institutions = parse(files['xl/worksheets/sheet3.xml']);
    const formula = [...institutions.querySelectorAll('c')].find((c) => c.querySelector('f'))!;
    const row = formula.getAttribute('r')!.slice(1);
    expect(formula.querySelector('f')?.textContent).toBe(
      `IF(C${row}=0,"无可用比率",E${row}/C${row})`,
    );
    expect(formula.querySelector('v')?.textContent).toBe('0.4');
  });

  it('exports zero denominators as explicit unavailable formula results', async () => {
    const report = sample();
    report.metrics.cohortDenominator = 0;
    report.metrics.cohortArrivedRequests = 0;
    report.metrics.cohortArrivalRate = null;
    const summary = parse((await unzip(await buildWorkbook(report)))['xl/worksheets/sheet1.xml']);
    expect(cell(summary, 'C25').getAttribute('t')).toBe('str');
    expect(cell(summary, 'C25').querySelector('v')?.textContent).toBe('无可用比率');
    expect(cell(summary, 'C25').querySelector('f')).not.toBeNull();
  });

  it.each([
    '=1+1',
    '+SUM(1,2)',
    '-2+3',
    '@SUM(1,2)',
    '=HYPERLINK("https://example.invalid","click")',
    '合成<&>"\u0001',
  ])('keeps untrusted text %s in inline strings', async (danger) => {
    const report = sample();
    report.warning = danger;
    report.institutionName = danger;
    report.institutions[0].institutionName = danger;
    report.profiles[0].note = danger;
    report.rules[0] = danger;
    const files = await unzip(await buildWorkbook(report));
    for (let n = 1; n <= 4; n++) {
      const sheet = parse(files[`xl/worksheets/sheet${n}.xml`]);
      const warning = cell(sheet, 'B3');
      expect(warning.getAttribute('t')).toBe('inlineStr');
      expect(warning.querySelector('f')).toBeNull();
      expect(warning.textContent).toBe(`公开合成演示 · ${danger.replace(/\u0001/g, '')}`);
      for (const formula of sheet.querySelectorAll('f'))
        expect(formula.textContent).toMatch(/^IF\(C\d+=0,"无可用比率",[CE]\d+\/C\d+\)$/);
    }
  });
});
