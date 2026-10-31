import {
  Login,
  createAppRouter,
  loadEnvironment,
  ExperienceBanner,
  DemoTools,
  DemoVersionViewer,
  isDemo,
} from './experience';
import NavigationGuard from './components/NavigationGuard';
import { useEffect, useState, Suspense, lazy } from 'react';
import { Outlet, NavLink, useLocation, RouterProvider, Navigate } from 'react-router-dom';
import { Button, Form, Input, Alert, Select, Drawer, Spin, Modal, Tag, useMobile } from './ui';
import {
  IconDashboard,
  IconList,
  IconCalendar,
  IconHome,
  IconFile,
  IconMenu,
  IconExport,
  IconArrowRight,
} from './ui/icons';
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
function Shell({ username, onLogout }: { username: string; onLogout: () => Promise<void> }) {
  const mobile = useMobile();
  const { pending, dirty } = useWork(),
    location = useLocation();
  const [drawer, setDrawer] = useState(false),
    [font, setFont] = useState('100'),
    [env, setEnv] = useState('环境读取中'),
    [logoutError, setLogoutError] = useState('');
  useEffect(() => {
    document.documentElement.style.setProperty('--reading', font === '150' ? '1.5' : '1');
    document.documentElement.style.fontSize = font === '150' ? '24px' : '16px';
    return () => {
      document.documentElement.style.removeProperty('--reading');
      document.documentElement.style.fontSize = '16px';
    };
  }, [font]);
  useEffect(() => {
    let active = true;
    loadEnvironment()
      .then((label) => {
        if (active) setEnv(label);
      })
      .catch(() => {
        if (active) setEnv('环境未确认');
      });
    return () => {
      active = false;
    };
  }, []);
  const title =
    nav.find(([path]) => location.pathname.endsWith('/' + path))?.[1] ||
    (isDemo &&
      (location.pathname === '/demo-tools'
        ? '演示工具'
        : location.pathname.startsWith('/versions/')
          ? '模拟历史版本'
          : '')) ||
    (location.pathname.endsWith('/more') ? '更多' : '工作台');
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
  const accountControls = (
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
  );
  return (
    <div className={styles.shell} data-reading-size={font} data-mobile={mobile}>
      {!mobile && (
        <aside className={styles.sidebar}>
          {navigation}
          <p className={styles.sidebarNote}>免费对接 · 用心陪伴</p>
        </aside>
      )}
      <Drawer
        title="工作区域"
        visible={drawer}
        onCancel={() => setDrawer(false)}
        footer={null}
        placement="left"
        width="min(86vw,300px)"
      >
        <div className={styles.drawerNav}>
          {navigation}
          {mobile && accountControls}
        </div>
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
          {!mobile && accountControls}
        </header>
        <main className={styles.content}>
          <ExperienceBanner />
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
          {isDemo ? '快康养 · 互动演示' : '快康养 · 内部服务工作区'}{' '}
          <span>{isDemo ? '合成资料 · 不同设备不自动同步' : '联系资料仅供本次对接使用'}</span>
        </footer>
      </div>
      {mobile && (
        <nav className={styles.bottomNav} aria-label="手机工作导航">
          {[
            ['dashboard', '工作台', IconDashboard],
            ['requests', '需求', IconList],
            ['visits', '日程', IconCalendar],
            ['more', '更多', IconMenu],
          ].map(([path, label, Component]) => {
            const Icon = Component as typeof IconDashboard;
            return (
              <NavLink
                key={String(path)}
                to={'/' + path}
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                <Icon />
                <span>{String(label)}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
      <NavigationGuard />
    </div>
  );
}
function More() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>更多服务</h1>
          <p>让每一份资料和进展都有据可查。</p>
        </div>
      </div>
      <div className="more-links">
        {isDemo && <NavLink to="/demo-tools">演示工具与使用说明</NavLink>}
        <NavLink to="/institutions">
          <IconHome />
          <div>
            <strong>机构资料</strong>
            <p>草稿、来源确认与版本发布</p>
          </div>
          <IconArrowRight />
        </NavLink>
        <NavLink to="/reports">
          <IconFile />
          <div>
            <strong>服务报告</strong>
            <p>完整范围统计与同批 Excel</p>
          </div>
          <IconArrowRight />
        </NavLink>
      </div>
    </>
  );
}
function Root() {
  const [session, setSession] = useState<z.infer<typeof sessionSchema> | null>(null),
    [loading, setLoading] = useState(true),
    [generation, setGeneration] = useState(0),
    [resetNotice, setResetNotice] = useState(false);
  useEffect(() => {
    let active = true;
    client.onReset = () => {
      if (active) {
        setResetNotice(true);
        setSession(null);
        setGeneration((v) => v + 1);
      }
    };
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
      client.onReset = () => {};
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
      <>
        {isDemo && resetNotice && (
          <Alert
            type="warning"
            content="演示数据已在本浏览器重建或清除，旧草稿和待重试操作已清除，请重新进入。"
          />
        )}
        <Login
          onLogin={(s) => {
            setResetNotice(false);
            client.establish(s.csrfToken);
            setSession(s);
            setGeneration((v) => v + 1);
          }}
        />
      </>
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
const router = createAppRouter([
  {
    element: <Root />,
    errorElement: (
      <section className="panel">
        <h1>页面暂时无法打开</h1>
        <p>网站可能刚更新，已保存的资料仍保留。请刷新后继续；若问题持续，可稍后重试。</p>
        <Button onClick={() => window.location.reload()}>刷新页面</Button>
      </section>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'requests', element: <Requests /> },
      { path: 'visits', element: <Visits /> },
      { path: 'institutions', element: <Institutions /> },
      { path: 'reports', element: <Reports /> },
      { path: 'more', element: <More /> },
      ...(isDemo
        ? [
            { path: 'demo-tools', element: <DemoTools /> },
            { path: 'versions/:id/:revision', element: <DemoVersionViewer /> },
          ]
        : []),
      {
        path: '*',
        element: (
          <section className="panel">
            <h1>页面不存在</h1>
            <NavLink to="/dashboard">返回工作台</NavLink>
          </section>
        ),
      },
    ],
  },
]);
export default function App() {
  return <RouterProvider router={router} />;
}
