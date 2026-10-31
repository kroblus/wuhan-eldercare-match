import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('发布标记、提交 SHA 与纯静态子路径', async ({ request }) => {
  const info = await request.get('./build-info.json');
  expect(info.ok()).toBe(true);
  const build = await info.json();
  expect(build.mode).toBe('PUBLIC_DEMO');
  expect(build.sha).toMatch(/^[a-f0-9]{40}$/);
  const expected = process.env.EXPECTED_DEPLOY_SHA || process.env.GITHUB_SHA;
  if (expected) expect(build.sha).toBe(expected);
  expect((await request.get('./this-route-does-not-exist')).status()).toBe(404);
  const html = await (await request.get('./')).text();
  expect(html).toContain('/wuhan-eldercare-match/assets/');
  expect(html).not.toContain('/p1-admin/');
});
async function enter(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: '进入演示工作台' }).click();
  await expect(page.getByRole('heading', { name: '把每一次托付，照顾得更好。' })).toBeVisible();
}
async function state(page: Page): Promise<any> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('p1-admin-public-demo-v1', 1);
        open.onsuccess = () => {
          const db = open.result,
            r = db.transaction('demo', 'readonly').objectStore('demo').get('state');
          r.onsuccess = () => {
            resolve(r.result);
            db.close();
          };
        };
      }),
  );
}
async function route(page: Page, path: string, title: string) {
  await page.goto('./#/' + path);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}
for (const width of [320, 375, 390, 430, 768, 1280, 1440])
  test(`尺寸与字号 ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await enter(page);
    for (const size of [100, 150]) {
      if (size === 150) {
        if (width < 768) await page.getByRole('button', { name: '打开导航' }).click();
        await page.getByLabel('阅读字号').click();
        if (width >= 768)
          await page
            .locator('.ant-select-item-option-content')
            .filter({ hasText: '字号 150%' })
            .click();
        else {
          await page.getByRole('button', { name: '字号 150%' }).click();
          await page
            .getByRole('dialog', { name: '工作区域', exact: true })
            .getByRole('button', { name: '关闭窗口' })
            .click();
        }
      }
      await expect(page.locator('[data-reading-size]')).toHaveAttribute(
        'data-reading-size',
        String(size),
      );
      for (const [path, title] of [
        ['dashboard', '把每一次托付，照顾得更好。'],
        ['requests', '需求管理'],
        ['visits', '带看日程'],
        ['institutions', '机构资料'],
        ['reports', '服务报告'],
        ['demo-tools', '演示工具'],
      ]) {
        // Hash navigation stays in the mounted app, preserving its actual font preference.
        await page.evaluate((p) => {
          location.hash = '#/' + p;
        }, path);
        await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
          `${path} ${width} ${size}% horizontal overflow`,
        ).toBe(true);
        if (width < 768)
          expect(
            (await page.locator('.request-card').count()) ||
              (await page.locator('nav[aria-label="手机工作导航"]').count()),
          ).toBeGreaterThan(0);
        if (['dashboard', 'reports', 'demo-tools'].includes(path))
          await page.screenshot({
            path: info.outputPath(`${path}-${width}-${size}.png`),
            fullPage: true,
          });
      }
    }
  });
test('故障显式开启、响应丢失原操作重试、进度导入与跨标签重置', async ({ page, context }, info) => {
  await enter(page);
  await route(page, 'demo-tools', '演示工具');
  await page.getByRole('button', { name: '下一次写入已保存但响应丢失', exact: true }).click();
  await page.getByRole('link', { name: '④ 生成报告' }).click();
  await expect(page.getByText(/已开启一次模拟故障/)).toBeVisible();
  await page.getByRole('button', { name: '生成报告预览' }).click();
  await expect(page.getByText('尚未生成本批报告。', { exact: true })).toBeVisible();
  const saved = await state(page);
  expect(Object.keys(saved.reports)).toHaveLength(1);
  await page.getByRole('button', { name: '生成报告预览' }).click();
  await expect(page.getByText('本批次已固定', { exact: true })).toBeVisible();
  expect((await state(page)).reports).toEqual(saved.reports);
  await route(page, 'demo-tools', '演示工具');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出演示进度', exact: true }).click();
  const d = await download,
    path = info.outputPath('synthetic-progress.json');
  await d.saveAs(path);
  const json = JSON.parse(await readFile(path, 'utf8'));
  expect(json.syntheticMarker).toBe('P1_PUBLIC_DEMO_SYNTHETIC_ONLY');
  const second = await context.newPage();
  await second.goto('./#/dashboard');
  await expect(second.getByRole('heading', { name: '把每一次托付，照顾得更好。' })).toBeVisible();
  await page.getByLabel('或粘贴演示进度').fill('{"schemaVersion":9}');
  await page.getByRole('button', { name: '校验并导入演示进度' }).click();
  await page.getByRole('button', { name: '确认继续', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('格式或版本不正确');
  expect((await state(page)).datasetId).toBe(json.datasetId);
  await page.getByLabel('选择进度文件').setInputFiles(path);
  await page.getByRole('button', { name: '校验并导入演示进度' }).click();
  await page.getByRole('button', { name: '确认继续', exact: true }).click();
  await expect(page.getByRole('button', { name: '进入演示工作台' })).toBeVisible();
  await expect(second.getByRole('button', { name: '进入演示工作台' })).toBeVisible();
  expect((await state(page)).generation).toBe(json.generation + 1);
  expect((await state(page)).requests).toEqual(json.requests);
  await page.getByRole('button', { name: '进入演示工作台' }).click();
  await route(page, 'demo-tools', '演示工具');
  await page.getByRole('button', { name: '清除本浏览器演示数据', exact: true }).click();
  await page.getByRole('button', { name: '确认继续', exact: true }).click();
  await expect(page.getByRole('button', { name: '进入演示工作台' })).toBeVisible();
  await page.reload();
  expect(Object.keys((await state(page)).requests)).toHaveLength(0);
  expect(Object.keys((await state(page)).institutions)).toHaveLength(0);
  await page.getByRole('button', { name: '进入演示工作台' }).click();
  await route(page, 'demo-tools', '演示工具');
  await page.getByRole('button', { name: '一键恢复初始演示', exact: true }).click();
  await page.getByRole('button', { name: '确认继续', exact: true }).click();
  await expect(page.getByRole('button', { name: '进入演示工作台' })).toBeVisible();
  expect(Object.keys((await state(page)).requests)).toHaveLength(76);
});
