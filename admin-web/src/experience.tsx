import { useState } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { z } from 'zod';
import { Button, Form, Input, Alert } from './ui';
import { IconArrowRight } from './ui/icons';
import { Field } from './components/shared';
import { client } from './api/client';
import { sessionSchema, p1, environment } from './api/schema';
import styles from './App.module.css';
export const isDemo = false;
export async function initializeExperience() {}
export function createAppRouter(routes: RouteObject[]) {
  return createBrowserRouter(routes, { basename: '/p1-admin' });
}
export async function loadEnvironment() {
  const r = await fetch('/api/v1/p1-service/config', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error('环境未确认');
  return p1.extend({ datasetMode: environment }).parse(await r.json()).datasetMode ===
    'SYNTHETIC_TEST_ONLY'
    ? '合成测试环境'
    : '正式服务环境';
}
export function ExperienceBanner() {
  return null;
}
export function DemoTools() {
  return null;
}
export function DemoVersionViewer() {
  return null;
}
export function versionHref(id: string, revision: number) {
  return '/api/v1/institution-publications/' + encodeURIComponent(id) + '/revisions/' + revision;
}
export function Login({ onLogin }: { onLogin: (session: z.infer<typeof sessionSchema>) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [form] = Form.useForm();
  async function submit(values: { username: string; password: string }) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await client.request('/login', sessionSchema, {
        method: 'POST',
        body: values,
        login: true,
      });
      form.resetFields(['password']);
      onLogin(result);
    } catch {
      setError('登录未完成，请核对管理员账号及服务配置后重试。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.login}>
      <section className={styles.loginStory}>
        <div className={styles.brand}>
          <span>快</span>快康养 <small>运营工作台</small>
        </div>
        <div>
          <h1>
            接住每一份需求。
            <br />
            把下一步，安排好。
          </h1>
          <p>免费信息对接 · 联系跟进 · 陪同看院</p>
        </div>
        <div className={styles.loginFooter}>每次联系有记录，每份资料有来源。</div>
      </section>
      <section className={styles.loginCard}>
        <h2>登录工作台</h2>
        <p>使用平台管理员账号，继续今天的服务。</p>
        <Form form={form} layout="vertical" onSubmit={submit} disabled={busy}>
          <Field name="username" label="管理员账号" required>
            <Input autoComplete="username" maxLength={80} />
          </Field>
          <Field name="password" label="密码" required>
            <Input.Password autoComplete="current-password" maxLength={200} />
          </Field>
          {error && <Alert type="error" content={error} />}
          <Button htmlType="submit" type="primary" long loading={busy} icon={<IconArrowRight />}>
            登录工作台
          </Button>
        </Form>
        <p className="muted">仅用于本次服务对接。请勿共享账号或复制联系人资料到外部系统。</p>
      </section>
    </main>
  );
}
