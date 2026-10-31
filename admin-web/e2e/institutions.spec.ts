import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { DemoState } from '../src/public-demo/types';

async function enter(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: '进入演示工作台', exact: true }).click();
  await expect(page.getByRole('link', { name: '演示工具', exact: true }).first()).toBeVisible();
  await page.goto('./#/institutions');
  await expect(page.getByRole('heading', { name: '机构资料', exact: true })).toBeVisible();
}
async function openSeed(page: Page, id = 'demo-institution-1') {
  const row = page.getByRole('row').filter({ has: page.getByText(id, { exact: true }) });
  await row.getByRole('button', { name: '维护资料', exact: true }).click();
  await expect(page.getByRole('button', { name: '返回机构列表', exact: true })).toBeVisible();
}
async function expand(page: Page, name: string) {
  const details = page
    .locator('details')
    .filter({ has: page.locator('summary').getByText(name, { exact: true }) });
  if (
    !(await details.getAttribute('open')) &&
    !(await details.evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await details.locator('summary').click();
}
async function saveDraft(page: Page, institutionId = 'demo-institution-1') {
  const before = (await storedInstitution(page, institutionId))?.draft.draftRevision ?? 0;
  const save = page.locator('#institution-draft button').filter({ hasText: /^保存草稿$/ });
  await expect(save).toBeEnabled();
  await save.click();
  await expect
    .poll(async () => (await storedInstitution(page, institutionId))?.draft.draftRevision)
    .toBe(before + 1);
  await expect(save).not.toHaveClass(/ant-btn-loading/);
  await expect(save).toBeDisabled();
  await expect(page.getByLabel('机构公开名称', { exact: true })).toBeEnabled();
  await expect(
    page.getByText('草稿已保存。请核对来源并完成模拟来源确认。', { exact: true }),
  ).toBeVisible();
}
async function confirmAndPublish(page: Page, revision: number) {
  await expand(page, '来源与确认');
  await page.getByLabel('本次确认来源引用', { exact: true }).fill('合成演示来源记录 ' + revision);
  await page.getByLabel('模拟确认人 / 可追溯标识', { exact: true }).fill('演示确认人 E2E');
  const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  await page.getByLabel('实际模拟来源确认日期', { exact: true }).fill(day);
  await page.getByRole('button', { name: '确认已保存草稿', exact: true }).click();
  await expect(
    page.getByText('本草稿已记录模拟来源确认，可以发布。', { exact: true }),
  ).toBeVisible();
  await expand(page, '版本发布');
  await page.getByRole('button', { name: '模拟发布已确认版本', exact: true }).click();
  await page
    .getByRole('dialog', { name: '发布已确认版本？', exact: true })
    .getByRole('button', { name: '确认继续', exact: true })
    .click();
  await expect(
    page.getByText('模拟服务已确认发布第 ' + revision + ' 版。旧版本保留，服务接入独立管理。', {
      exact: true,
    }),
  ).toBeVisible();
}
async function viewPublication(page: Page, revision: number) {
  const popup = page.waitForEvent('popup');
  await page
    .getByRole('link', { name: '读取已发布第 ' + revision + ' 版公开资料 ↗', exact: true })
    .click();
  const viewer = await popup;
  await expect(
    viewer.getByRole('heading', { name: '模拟机构历史版本 V' + revision, exact: true }),
  ).toBeVisible();
  return viewer;
}
async function price(page: Page, bed: number) {
  await expand(page, '公示价格');
  await page.getByLabel('第1行床位费', { exact: true }).fill(String(bed));
  await page.getByLabel('第1行总月费', { exact: true }).fill(String(bed + 1200));
}
async function storedState(page: Page) {
  return page.evaluate(async () => {
    const state = await new Promise<DemoState>((resolve, reject) => {
      const request = indexedDB.open('p1-admin-public-demo-v1', 1);
      request.onsuccess = () => {
        const db = request.result,
          get = db.transaction('demo', 'readonly').objectStore('demo').get('state');
        get.onsuccess = () => {
          resolve(get.result);
          db.close();
        };
        get.onerror = () => reject(get.error);
      };
      request.onerror = () => reject(request.error);
    });
    return state;
  });
}
async function storedInstitution(page: Page, id: string) {
  return (await storedState(page)).institutions[id];
}

test('真实表单新建机构、两次价格版本发布、旧版固定与独立服务资格', async ({ page }) => {
  await enter(page);
  const id = 'demo-e2e-publication',
    name = '合成演示机构 E2E 发布';
  await page.getByRole('button', { name: '新建机构草稿', exact: true }).click();
  const create = page.getByRole('dialog', { name: '新建机构草稿', exact: true });
  await create.getByLabel('机构稳定 ID', { exact: true }).fill(id);
  await create.getByRole('button', { name: '准备新草稿', exact: true }).click();
  await page.getByLabel('机构公开名称', { exact: true }).fill(name);
  await page.getByLabel('地区代码（按确认资料填写）', { exact: true }).fill('420100');
  await page.getByLabel('所属地区名称', { exact: true }).fill('演示地区');
  await page.getByRole('checkbox', { name: '同时发布详细介绍与价目表', exact: true }).check();
  await expand(page, '公开介绍');
  await page.getByLabel('公开资料来源', { exact: true }).fill('纯合成演示资料，不代表真实机构');
  await page.getByLabel('实际地址（未知保持空白）', { exact: true }).fill('虚构演示区域 E2E 号');
  await page.getByLabel('机构性质（按确认资料填写）', { exact: true }).fill('演示性质（虚构）');
  await expand(page, '公示价格');
  await page.getByRole('button', { name: '增加价格行', exact: true }).click();
  await page.getByLabel('第1行护理档位', { exact: true }).fill('合成演示基础档');
  await page.getByLabel('第1行床位费', { exact: true }).fill('1800');
  await page.getByLabel('第1行护理费', { exact: true }).fill('500');
  await page.getByLabel('第1行伙食费', { exact: true }).fill('700');
  await page.getByLabel('第1行总月费', { exact: true }).fill('3000');
  await saveDraft(page, id);
  await confirmAndPublish(page, 1);
  const version1 = await viewPublication(page, 1);
  await expect(version1.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(version1.getByText('合计 3000 元／月（合成）', { exact: true })).toBeVisible();
  const first = await storedInstitution(page, id);
  expect(first.draft.serviceAccess.enabled).toBe(false);
  const frozenV1 = first.versions['1'];
  await price(page, 2200);
  await saveDraft(page, id);
  await expect(
    page.getByRole('button', { name: '模拟发布已确认版本', exact: true }),
  ).toBeDisabled();
  await confirmAndPublish(page, 2);
  const version2 = await viewPublication(page, 2);
  await expect(version2.getByText('合计 3400 元／月（合成）', { exact: true })).toBeVisible();
  await version1.reload();
  await expect(version1.getByText('合计 3000 元／月（合成）', { exact: true })).toBeVisible();
  expect((await storedInstitution(page, id)).versions['1']).toEqual(frozenV1);
  await page.getByRole('checkbox', { name: '允许接收新咨询 / 带看意向', exact: true }).check();
  await page.getByLabel('接入决定来源 / 确认说明', { exact: true }).fill('合成演示接待决定');
  await page.getByRole('button', { name: '保存接入设置', exact: true }).click();
  await expect(
    page.getByText('已允许接收本机构的新咨询与带看意向。', { exact: true }),
  ).toBeVisible();
  const active = await storedInstitution(page, id);
  expect(active.draft.serviceAccess.enabled).toBe(true);
  expect(active.draft.currentRecordRevision).toBe(2);
  expect(active.versions['1']).toEqual(frozenV1);
  await page.getByRole('checkbox', { name: '允许接收新咨询 / 带看意向', exact: true }).uncheck();
  await page.getByLabel('接入决定来源 / 确认说明', { exact: true }).fill('合成演示停止接待决定');
  await page.getByRole('button', { name: '保存接入设置', exact: true }).click();
  await page
    .getByRole('dialog', { name: '停止接收本机构的新服务申请？', exact: true })
    .getByRole('button', { name: '确认继续', exact: true })
    .click();
  await expect(page.getByText('已停止新服务申请，旧记录保留。', { exact: true })).toBeVisible();
  expect((await storedInstitution(page, id)).draft.currentRecordRevision).toBe(2);
});

test('双标签旧版冲突保留本地输入，采用模拟服务价格和字段后合并保存', async ({ page, context }) => {
  await enter(page);
  await openSeed(page);
  const second = await context.newPage();
  await second.goto('./#/institutions');
  await openSeed(second);
  await price(page, 2100);
  await saveDraft(page);
  const localName = '合成演示机构 B窗口保留';
  await second.getByLabel('机构公开名称', { exact: true }).fill(localName);
  await price(second, 2300);
  await second.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(
    second.getByText(
      '检测到版本冲突，本地修改已保留。请先查询模拟服务版本、比较差异，再合并保存并重新确认。',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(second.getByLabel('机构公开名称', { exact: true })).toHaveValue(localName);
  await expect(second.getByLabel('第1行床位费', { exact: true })).toHaveValue('2300');
  await second.getByRole('button', { name: '查询模拟服务版本', exact: true }).click();
  const review = second.getByRole('dialog', { name: '核对模拟服务最新版本', exact: true });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: '采用模拟服务价格', exact: true }).click();
  await review
    .getByRole('button', { name: '保留我的修改，以最新版本为基准继续编辑', exact: true })
    .click();
  await expect(review).toBeHidden();
  await expect(second.getByLabel('机构公开名称', { exact: true })).toHaveValue(localName);
  await expect(second.getByLabel('第1行床位费', { exact: true })).toHaveValue('2100');
  await saveDraft(second);
  await page.getByRole('button', { name: '查询模拟服务版本', exact: true }).click();
  await expect(page.getByLabel('机构公开名称', { exact: true })).toHaveValue(localName);
  const serverName = '合成演示机构 A窗口后继';
  await page.getByLabel('机构公开名称', { exact: true }).fill(serverName);
  await saveDraft(page);
  await second.getByLabel('机构公开名称', { exact: true }).fill('合成演示机构 B窗口旧输入');
  await second.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(
    second.getByText(
      '检测到版本冲突，本地修改已保留。请先查询模拟服务版本、比较差异，再合并保存并重新确认。',
      { exact: true },
    ),
  ).toBeVisible();
  await second.getByRole('button', { name: '查询模拟服务版本', exact: true }).click();
  const nameDifference = review
    .locator('section')
    .filter({ has: second.getByRole('heading', { name: '机构名称', exact: true }) });
  await nameDifference.getByRole('button', { name: '采用模拟服务值', exact: true }).click();
  await review
    .getByRole('button', { name: '保留我的修改，以最新版本为基准继续编辑', exact: true })
    .click();
  await expect(review).toBeHidden();
  await expect(second.getByLabel('机构公开名称', { exact: true })).toHaveValue(serverName);
  const mergedSave = second.locator('#institution-draft button').filter({ hasText: /^保存草稿$/ });
  await expect(
    second.getByRole('button', { name: '查询模拟服务版本', exact: true }),
  ).not.toHaveClass(/ant-btn-loading/);
  await expect(second.getByLabel('机构公开名称', { exact: true })).toBeEnabled();
  if (await mergedSave.isEnabled()) {
    await saveDraft(second);
  } else {
    // Adopting every server field can leave no new content to submit. The visible form and persisted draft must agree.
    const current = await storedInstitution(second, 'demo-institution-1');
    expect(current.draft.publicProfile?.name).toBe(serverName);
    expect(current.draft.publicProfile?.prices[0].bed).toBe(2100);
    await expect(second.getByText('有未保存修改', { exact: true })).toBeHidden();
    expect(
      JSON.parse(
        await second.getByLabel('Institution V1.2.1 完整资料', { exact: true }).inputValue(),
      ),
    ).toEqual(current.draft.record);
    await expect(
      second.getByText(
        '已采用模拟服务最新版本作为保存基准。本地修改保留；请完成合并、保存草稿并重新确认。',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(second.getByLabel('第1行床位费', { exact: true })).toHaveValue('2100');
    await expect(second.getByLabel('第1行总月费', { exact: true })).toHaveValue('3300');
    await expect(mergedSave).toBeDisabled();
  }
  const stored = await storedInstitution(second, 'demo-institution-1');
  expect(stored.draft.publicProfile.name).toBe(serverName);
  expect(stored.draft.publicProfile.prices[0].bed).toBe(2100);
  expect(stored.versions['1'].publicProfile.prices[0].bed).toBe(1800);
});

async function baselineForm(page: Page): Promise<Locator> {
  await page.locator('summary').filter({ hasText: '已有目录迁移' }).click();
  const form = page.locator('#institution-import');
  await expect(form).toBeVisible();
  return form;
}
test('从演示工具下载合成基线，经文件和粘贴导入，坏格式和缺标识均拒绝', async ({ page }) => {
  test.setTimeout(120000);
  await enter(page);
  await page.goto('./#/demo-tools');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载仅含合成标识的机构导入样例', exact: true }).click();
  const file = await downloading,
    local = await file.path();
  expect(local).toBeTruthy();
  const sample = await readFile(local!, 'utf8');
  expect(JSON.parse(sample).syntheticMarker).toBe('P1_PUBLIC_DEMO_SYNTHETIC_ONLY');
  await page.goto('./#/institutions');
  const form = await baselineForm(page);
  const submit = form.locator('button').filter({ hasText: /^导入现有目录$/ });
  async function importBaseline(expectedReceipts: number) {
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect
      .poll(
        async () =>
          Object.values((await storedState(page)).receipts).filter((r) =>
            r.signature.includes('/institutions/import-baseline'),
          ).length,
      )
      .toBe(expectedReceipts);
    await expect(submit).not.toHaveClass(/ant-btn-loading/);
    await expect(submit).toBeEnabled();
    await expect(form.getByLabel('或粘贴完整目录 JSON', { exact: true })).toBeEnabled();
    await expect(
      form.getByText('模拟服务已确认导入 5 条已有版本，原事实与核验日期保留。', { exact: true }),
    ).toBeVisible();
  }
  await form.getByLabel('现有目录 JSON 文件', { exact: true }).setInputFiles({
    name: '合成基线.json',
    mimeType: 'application/json',
    buffer: Buffer.from(sample),
  });
  await expect(form.getByLabel('或粘贴完整目录 JSON', { exact: true })).toHaveValue(sample);
  await form.getByLabel('本次迁移来源引用', { exact: true }).fill('合成演示文件导入');
  await form
    .getByRole('checkbox', {
      name: '我确认仅迁移现有版本，保留原核验日期，不代表本次重新核验',
      exact: true,
    })
    .check();
  await importBaseline(1);
  // Pasting the equivalent compact JSON avoids spending the action timeout selecting 5,000 pretty-printed lines.
  await form
    .getByLabel('或粘贴完整目录 JSON', { exact: true })
    .fill(JSON.stringify(JSON.parse(sample)), { timeout: 45000 });
  await form.getByLabel('本次迁移来源引用', { exact: true }).fill('合成演示粘贴导入');
  await importBaseline(2);
  const before = await storedInstitution(page, 'demo-institution-1');
  await form.getByLabel('或粘贴完整目录 JSON', { exact: true }).fill('{broken', { timeout: 45000 });
  await submit.click();
  await expect(form.locator('.ant-alert-error')).toBeVisible();
  const malformedError = await form.locator('.ant-alert-error').innerText();
  expect(await storedInstitution(page, 'demo-institution-1')).toEqual(before);
  const unmarked = JSON.parse(sample);
  delete unmarked.syntheticMarker;
  await form
    .getByLabel('或粘贴完整目录 JSON', { exact: true })
    .fill(JSON.stringify(unmarked), { timeout: 45000 });
  await submit.click();
  await expect(form.locator('.ant-alert-error')).toBeVisible();
  await expect(form.locator('.ant-alert-error')).not.toHaveText(malformedError);
  expect(await storedInstitution(page, 'demo-institution-1')).toEqual(before);
});
