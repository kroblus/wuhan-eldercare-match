import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
async function state(page: Page): Promise<any> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('p1-admin-public-demo-v1', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result,
            req = db.transaction('demo', 'readonly').objectStore('demo').get('state');
          req.onsuccess = () => {
            resolve(req.result);
            db.close();
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}
async function enter(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: '进入演示工作台' }).click();
  await expect(page.getByRole('heading', { name: '把每一次托付，照顾得更好。' })).toBeVisible();
}
async function route(page: Page, name: string) {
  await page.goto('./#/' + name);
  await expect(page.getByRole('link', { name: '演示工具', exact: true })).toBeVisible();
}
async function choose(page: Page, control: Locator, text: string) {
  await control.click();
  const content = page.locator('.ant-select-item-option-content').filter({ hasText: text });
  if (await content.count()) await content.first().click();
  else await page.getByRole('button', { name: new RegExp('^' + text + '(?: ✓)?$') }).click();
}
function date(offset: number, hour: number) {
  return (
    new Date(Date.now() + 8 * 3600000 + offset * 86400000).toISOString().slice(0, 10) +
    'T' +
    String(hour).padStart(2, '0') +
    ':00'
  );
}
for (const width of [1440, 390, 320])
  test(`完整故事与下载 ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const requests: string[] = [],
      errors: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    page.on('pageerror', (e) => errors.push(e.message));
    await enter(page);
    const original = await state(page);
    expect(Object.keys(original.requests)).toHaveLength(76);
    await page.reload();
    await expect(page.getByRole('link', { name: '演示工具', exact: true })).toBeVisible();
    expect(Object.keys((await state(page)).requests)).toHaveLength(76);
    await page.getByRole('link', { name: '演示工具', exact: true }).click();
    await expect(page.getByRole('heading', { name: '演示工具', exact: true })).toBeVisible();
    await choose(page, page.getByLabel('模拟需求类型'), '模拟带看意向');
    await page.getByRole('button', { name: '新增模拟需求并查看' }).click();
    const detail = page.getByRole('dialog', { name: '需求详情', exact: true });
    await expect(detail).toBeVisible();
    const id = new URLSearchParams(page.url().split('?')[1]).get('requestId')!;
    await detail.getByLabel('内部备注', { exact: true }).fill('合成演示：已了解参观需求');
    await detail.getByLabel('下次联系（北京时间）', { exact: true }).fill(date(1, 9));
    await detail
      .getByLabel('下一动作（有下次时间时必填）', { exact: true })
      .fill('合成演示：确认集合点');
    await detail.getByRole('button', { name: '保存联系记录', exact: true }).click();
    await expect
      .poll(async () => (await state(page)).requests[id].item.status)
      .toBe('PENDING_ARRANGEMENT');
    await detail.getByText('新增一场带看', { exact: true }).click();
    const visit = detail
      .locator('form')
      .filter({ has: page.getByLabel('负责人标识', { exact: true }) });
    await choose(page, visit.getByLabel('带看机构', { exact: true }), '合成演示机构 A');
    await visit.getByLabel('负责人标识', { exact: true }).fill('演示顾问-新故事');
    await visit.getByLabel('开始（北京时间）', { exact: true }).fill(date(14, 10));
    await visit.getByLabel('结束（北京时间）', { exact: true }).fill(date(14, 11));
    await visit
      .getByLabel('集合与出行说明（用户可见）', { exact: true })
      .fill('合成演示集合点，勿前往');
    await visit.getByRole('button', { name: '保存带看安排', exact: true }).click();
    await expect
      .poll(async () => (await state(page)).requests[id].item.visits[0]?.status)
      .toBe('DRAFT');
    // The original form retains its values after success; close and reopen only the saved visit.
    await detail.getByText('新增一场带看', { exact: true }).click();
    await detail.getByText('修改 / 确认这场安排', { exact: true }).click();
    const edit = detail
      .locator('form')
      .filter({ has: page.getByLabel('负责人标识', { exact: true }) })
      .filter({ visible: true });
    await edit.getByText('已取得家属确认', { exact: true }).click();
    await edit.getByText('已取得机构确认', { exact: true }).click();
    await choose(page, edit.getByLabel('保存方式', { exact: true }), '双方确认，检查冲突后排期');
    await edit.getByRole('button', { name: '保存带看安排', exact: true }).click();
    await page.getByRole('button', { name: '确认继续', exact: true }).click();
    await expect
      .poll(async () => (await state(page)).requests[id].item.visits[0]?.status)
      .toBe('CONFIRMED');
    await edit.getByLabel('开始（北京时间）', { exact: true }).fill(date(15, 10));
    await edit.getByLabel('结束（北京时间）', { exact: true }).fill(date(15, 11));
    await edit.getByRole('button', { name: '确认改期', exact: true }).click();
    await page.getByRole('button', { name: '确认继续', exact: true }).click();
    await expect
      .poll(async () => (await state(page)).requests[id].item.visits[0]?.revision)
      .toBe(3);
    await detail.getByText('修改 / 确认这场安排', { exact: true }).click();
    await detail.getByText('取消 / 到访结果', { exact: true }).click();
    await detail.getByRole('button', { name: '提交本场结果', exact: true }).click();
    await page.getByRole('button', { name: '确认继续', exact: true }).click();
    await expect
      .poll(async () => (await state(page)).requests[id].item.visits[0]?.status)
      .toBe('CANCELLED');
    await detail.getByRole('button', { name: '关闭窗口' }).click();
    await route(page, 'demo-tools');
    await page.getByRole('button', { name: '加载可登记到访的历史演示记录' }).click();
    await expect(detail).toBeVisible();
    const pastId = new URLSearchParams(page.url().split('?')[1]).get('requestId')!;
    await detail.getByText('取消 / 到访结果', { exact: true }).click();
    await choose(page, detail.getByLabel('本场结果', { exact: true }), '记录已到访');
    await detail.getByRole('button', { name: '提交本场结果', exact: true }).click();
    await page.getByRole('button', { name: '确认继续', exact: true }).click();
    await expect
      .poll(async () => (await state(page)).requests[pastId].item.visits[0]?.status)
      .toBe('ARRIVED');
    await detail.getByRole('button', { name: '关闭窗口' }).click();
    await route(page, 'reports');
    await page
      .locator('input[aria-label="报告开始日期"]')
      .fill(new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10));
    await page.getByRole('button', { name: '生成报告预览', exact: true }).click();
    await expect(page.getByText('本批次已固定', { exact: true })).toBeVisible();
    const reports = Object.values((await state(page)).reports) as any[],
      report = reports[0];
    expect(report).toBeTruthy();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载本批次 Excel', exact: true }).click();
    const saved = await download;
    const path = testInfo.outputPath(saved.suggestedFilename());
    await saved.saveAs(path);
    expect(await saved.failure()).toBeNull();
    const zip = unzipSync(await readFile(path));
    const sheets = Object.keys(zip).filter((k) => /^xl\/worksheets\/sheet\d.xml$/.test(k));
    expect(sheets).toHaveLength(4);
    const overview = strFromU8(zip['xl/worksheets/sheet1.xml']);
    expect(overview).toContain(report.snapshotId);
    expect(strFromU8(zip['xl/workbook.xml'])).toContain('统计口径');
    expect(overview).toMatch(
      new RegExp('<c r="C9"[^>]*><v>' + report.metrics.newRequests + '</v>'),
    );
    await page.screenshot({
      path: testInfo.outputPath('report-' + width + '.png'),
      fullPage: true,
    });
    await page
      .locator('input[aria-label="报告开始日期"]')
      .fill(new Date(Date.now() - 39 * 86400000).toISOString().slice(0, 10));
    await expect(page.getByRole('button', { name: '下载本批次 Excel' })).toBeDisabled();
    await page.reload();
    expect(Object.keys((await state(page)).requests)).toHaveLength(78);
    expect((await state(page)).reports[report.snapshotId]).toEqual(report);
    const base = new URL(testInfo.project.use.baseURL!);
    expect(
      requests.filter((u) => {
        const x = new URL(u);
        return x.origin !== base.origin || !x.pathname.startsWith(base.pathname);
      }),
    ).toEqual([]);
    expect(errors).toEqual([]);
    await testInfo.attach('network-isolation', {
      body: JSON.stringify({ requests, externalOrBusinessRequests: 0 }, null, 2),
      contentType: 'application/json',
    });
  });
test('hash 深链、筛选、返回、独立浏览器与退出保留数据', async ({ page, browser }) => {
  await enter(page);
  await page.goto('./#/requests?status=PENDING_CONTACT&page=2');
  await expect(page.getByRole('heading', { name: '需求管理', exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/status=PENDING_CONTACT&page=2/);
  await page.goto('./#/not-a-route');
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/requests\?status/);
  await page.goForward();
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  const before = await state(page);
  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto(page.url().split('#')[0]);
  await expect(second.getByRole('button', { name: '进入演示工作台' })).toBeVisible();
  expect((await state(second)).datasetId).not.toBe(before.datasetId);
  await other.close();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '进入演示工作台' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '进入演示工作台' })).toBeVisible();
  expect((await state(page)).requests).toEqual(before.requests);
});
