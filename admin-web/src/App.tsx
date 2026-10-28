import NavigationGuard from './components/NavigationGuard';
import { useEffect, useState, Suspense, lazy } from 'react';
import {
  Outlet,
  NavLink,
  useLocation,
  useBlocker,
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from 'react-router-dom';
import {
  Button,
  Form,
  Input,
  Alert,
  Select,
  Drawer,
  Spin,
  Modal,
  Tag,
} from '@arco-design/web-react';
import {
  IconDashboard,
  IconList,
  IconCalendar,
  IconHome,
  IconFile,
  IconMenu,
  IconExport,
  IconArrowRight,
} from '@arco-design/web-react/icon';
import { z } from 'zod';
import { client, describe } from './api/client';
import { sessionSchema, p1, environment } from './api/schema';
import { WorkState, useWork } from './state';
import { Field, confirmAction } from './components/shared';
import styles from './App.module.css';
const Dashboard = lazy(() => import('./pages/Dashboard')),
  Requests = lazy(() => import('./pages/Requests')),
  Visits = lazy(() => import('./pages/Visits')),
  Institutions = lazy(() => import('./pages/Institutions')),
  Reports = lazy(() => import('./pages/Reports'));
const nav = [
  ['dashboard', '工作台', IconDashboard],
  ['requests', '需求管理', IconList],
  ['visits', '带看日程', IconCalendar],
  ['institutions', '机构资料', IconHome],
  ['reports', '服务报告', IconFile],
] as const;
function Login({ onLogin }: { onLogin: (session: z.infer<typeof sessionSchema>) => void }) {
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
function Shell({ username, onLogout }: { username: string; onLogout: () => Promise<void> }) {
  const { pending, dirty } = useWork(),
    location = useLocation();
  const [drawer, setDrawer] = useState(false),
    [font, setFont] = useState('100'),
    [env, setEnv] = useState('环境读取中'),
    [logoutError, setLogoutError] = useState('');
  useEffect(() => {
    document.documentElement.style.setProperty('--reading', font === '150' ? '1.5' : '1');
    return () => {
      document.documentElement.style.removeProperty('--reading');
    };
  }, [font]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty.size > 0 || pending.size > 0) && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty.size || pending.size) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty.size, pending.size]);
  useEffect(() => {
    let active = true;
    fetch('/api/v1/p1-service/config', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return p1.extend({ datasetMode: environment }).parse(await r.json());
      })
      .then((r) => {
        if (active)
          setEnv(r.datasetMode === 'SYNTHETIC_TEST_ONLY' ? '合成测试环境' : '正式服务环境');
      })
      .catch(() => {
        if (active) setEnv('环境未确认');
      });
    return () => {
      active = false;
    };
  }, []);
  const title = nav.find(([path]) => location.pathname.endsWith('/' + path))?.[1] || '工作台';
  const navigation = (
    <>
      <div className={styles.brand}>
        <span>快</span>
        <div>
          快康养<small>运营工作台</small>
        </div>
      </div>
      <div className={styles.navLabel}>日常工作</div>
      <nav aria-label="工作区域">
        {nav.map(([path, label, Icon]) => (
          <NavLink
            key={path}
            to={'/' + path}
            onClick={() => setDrawer(false)}
            className={({ isActive }) => (isActive ? styles.active : undefined)}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
  return (
    <div className={styles.shell} data-reading-size={font}>
      <aside className={styles.sidebar}>{navigation}</aside>
      <Drawer
        title="工作区域"
        visible={drawer}
        onCancel={() => setDrawer(false)}
        footer={null}
        placement="left"
        width="min(86vw,300px)"
      >
        <div className={styles.drawerNav}>{navigation}</div>
      </Drawer>
      <div className={styles.main}>
        <header className={styles.toolbar}>
          <div>
            <Button
              className={styles.menu}
              aria-label="打开导航"
              icon={<IconMenu />}
              onClick={() => setDrawer(true)}
            />
            <span className={styles.breadcrumb}>
              工作区 <span>/</span> <b>{title}</b>
            </span>
          </div>
          <div className={styles.tools}>
            <Tag color={env === '正式服务环境' ? 'green' : 'gray'}>{env}</Tag>
            <Select
              aria-label="阅读字号"
              value={font}
              onChange={setFont}
              options={[
                { value: '100', label: '字号 100%' },
                { value: '150', label: '字号 150%' },
              ]}
            />
            <span className={styles.identity}>{username}</span>
            <Button
              aria-label="退出登录"
              icon={<IconExport />}
              onClick={async () => {
                if (pending.size) {
                  setLogoutError('有写入结果尚未确认，请先查询或重试原操作。');
                  return;
                }
                if (
                  dirty.size &&
                  !(await confirmAction('退出并放弃未保存修改？', '尚未保存的输入会被清除。'))
                )
                  return;
                try {
                  await onLogout();
                } catch (e) {
                  setLogoutError(describe(e));
                }
              }}
            >
              退出
            </Button>
          </div>
        </header>
        <main className={styles.content}>
          {logoutError && (
            <Alert closable onClose={() => setLogoutError('')} type="error" content={logoutError} />
          )}
          <Suspense
            fallback={
              <div className="loading">
                <Spin /> 正在打开工作区域…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
        <footer className={styles.footer}>
          快康养 · 内部服务工作区 <span>联系资料仅供本次对接使用</span>
        </footer>
      </div>
      <NavigationGuard />
    </div>
  );
}
function Root() {
  const [session, setSession] = useState<z.infer<typeof sessionSchema> | null>(null),
    [loading, setLoading] = useState(true),
    [generation, setGeneration] = useState(0);
  useEffect(() => {
    let active = true;
    client.onExpired = () => {
      if (active) {
        setSession(null);
        setGeneration((v) => v + 1);
      }
    };
    client
      .request('/session', sessionSchema)
      .then((s) => {
        if (active) {
          client.establish(s.csrfToken);
          setSession(s);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      client.onExpired = () => {};
    };
  }, []);
  if (loading)
    return (
      <div className="loading">
        <Spin /> 正在确认管理员会话…
      </div>
    );
  if (!session)
    return (
      <Login
        onLogin={(s) => {
          client.establish(s.csrfToken);
          setSession(s);
          setGeneration((v) => v + 1);
        }}
      />
    );
  return (
    <WorkState key={generation}>
      <Shell
        username={session.username}
        onLogout={async () => {
          await client.request('/logout', p1.extend({ authenticated: z.literal(false) }), {
            method: 'POST',
          });
          client.clear();
          setSession(null);
          setGeneration((v) => v + 1);
        }}
      />
    </WorkState>
  );
}
const router = createBrowserRouter(
  [
    {
      element: <Root />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: <Dashboard /> },
        { path: 'requests', element: <Requests /> },
        { path: 'visits', element: <Visits /> },
        { path: 'institutions', element: <Institutions /> },
        { path: 'reports', element: <Reports /> },
      ],
    },
  ],
  { basename: '/p1-admin' },
);
export default function App() {
  return <RouterProvider router={router} />;
}
