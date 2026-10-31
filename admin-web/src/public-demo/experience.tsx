import { useEffect, useState } from 'react';
import { createHashRouter, Link, useNavigate, useParams, type RouteObject } from 'react-router-dom';
import { z } from 'zod';
import { Button, Alert, Select, Spin } from '../ui';
import { confirmAction } from '../components/shared';
import { client, describe } from './client';
import { sessionSchema } from '../api/schema';
import {
  initializeDemo,
  readDemo,
  subscribeDemo,
  resetDemo,
  clearDemo,
  exportDemo,
  importDemo,
  armFault,
  getArmedFault,
  subscribeFault,
} from './store';
import {
  createSyntheticRequest,
  expireDemoSession,
  exportBaselineDemo,
  loadEmptyScenario,
  loadHistoricalScenario,
} from './service';
import type { DemoState } from './types';
export const isDemo = true;
export const initializeExperience = initializeDemo;
export const createAppRouter = (routes: RouteObject[]) => createHashRouter(routes);
export const loadEnvironment = async () => '浏览器合成演示';
export const versionHref = (id: string, revision: number) =>
  '#/versions/' + encodeURIComponent(id) + '/' + revision;
const disclosure =
  '互动演示 · 全部为合成数据 · 修改仅保存在当前浏览器，不会联系真实人员或发布真实资料。';
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function Login({ onLogin }: { onLogin: (session: z.infer<typeof sessionSchema>) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <main className="demo-entry">
      <div className="demo-entry-card">
        <span className="demo-wordmark">快康养</span>
        <h1>
          从一条咨询，
          <br />
          到一份服务报告。
        </h1>
        <p>快康养互动演示</p>
        <p className="demo-disclosure">{disclosure}</p>
        <ol>
          <li>新增模拟咨询，记录联系与下一步。</li>
          <li>安排带看，体验确认、改期和到访。</li>
          <li>维护模拟机构版本，下载本批次报告。</li>
        </ol>
        <p>
          无需账号、密码或手机号。同一浏览器的标签页共享演示进度；电脑、手机和微信内置浏览器各自独立，可用进度文件手动接续。
        </p>
        {error && <Alert type="error" content={error} />}
        <Button
          type="primary"
          long
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              onLogin(
                await client.request('/login', sessionSchema, {
                  method: 'POST',
                  body: {},
                  login: true,
                }),
              );
            } catch (e) {
              setError(describe(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          进入演示工作台
        </Button>
        <small>请只输入虚构资料。本地演示不提供真实认证或多人协作服务。</small>
      </div>
    </main>
  );
}
export function ExperienceBanner() {
  const [fault, setFault] = useState(getArmedFault);
  useEffect(() => subscribeFault(setFault), []);
  const [guide, setGuide] = useState(() => {
    try {
      return localStorage.getItem('kky-public-demo:guide-hidden') !== '1';
    } catch {
      return true;
    }
  });
  return (
    <aside className="demo-banner" aria-label="互动演示说明">
      <strong>{disclosure}</strong>
      <div className="demo-banner-links">
        <Link to="/demo-tools">演示工具</Link>
        <span>不同设备不自动同步</span>
      </div>
      {fault && (
        <Alert
          type="warning"
          content={
            <span>
              已开启一次模拟故障：{fault.path} ·{' '}
              {fault.mode === 'before-write' ? '保存前失败' : '保存后响应丢失'}{' '}
              <button onClick={() => armFault(null)}>关闭故障</button>
            </span>
          }
        />
      )}{' '}
      {guide && (
        <div className="demo-guide">
          <span>体验顺序：</span>
          <Link to="/demo-tools">① 新增模拟需求</Link>
          <Link to="/requests">② 联系与安排</Link>
          <Link to="/visits">③ 带看进度</Link>
          <Link to="/reports">④ 生成报告</Link>
          <button
            onClick={() => {
              setGuide(false);
              try {
                localStorage.setItem('kky-public-demo:guide-hidden', '1');
              } catch {
                /* preference only */
              }
            }}
          >
            跳过引导
          </button>
        </div>
      )}
    </aside>
  );
}
export function DemoTools() {
  const navigate = useNavigate();
  const [state, setState] = useState<DemoState>(),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('CONSULTATION'),
    [institutionId, setInstitutionId] = useState(''),
    [fault, setFault] = useState(''),
    [faultPath, setFaultPath] = useState('/reports'),
    [progress, setProgress] = useState('');
  useEffect(
    () =>
      subscribeFault((value) => {
        if (!value) setFault('');
      }),
    [],
  );
  useEffect(() => {
    let active = true;
    const reload = () =>
      void readDemo()
        .then((s) => {
          if (active) setState(s);
        })
        .catch((e) => {
          if (active) setError(describe(e));
        });
    reload();
    const off = subscribeDemo(reload);
    return () => {
      active = false;
      off();
    };
  }, []);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="demo-tools">
      <div className="page-heading">
        <div>
          <h1>演示工具</h1>
          <p>正常操作默认顺畅；只有在这里主动选择，才会模拟异常。</p>
        </div>
      </div>
      {error && <Alert type="error" content={error} />}
      {message && <Alert type="success" content={message} />}
      <section className="panel">
        <h2>当前浏览器的演示进度</h2>
        <p>
          场景起始日：{state?.anchorDay || '读取中'}（北京时间）。已保存{' '}
          {state ? Object.keys(state.requests).length : '—'} 条需求，
          {state ? Object.keys(state.institutions).length : '—'} 家模拟机构。
        </p>
        <p>
          刷新不会重新播种。退出只结束演示会话；恢复初始数据或清除数据才会删除本浏览器进度。同浏览器标签共享数据；其他设备、隐私窗口和微信浏览器不自动同步。
        </p>
        <label>
          模拟需求类型
          <Select
            value={kind}
            onChange={setKind}
            options={[
              { value: 'CONSULTATION', label: '模拟咨询' },
              { value: 'VISIT_INTENT', label: '模拟带看意向' },
            ]}
          />
        </label>
        <label>
          意向机构
          <Select
            allowClear
            value={institutionId}
            onChange={(v) => setInstitutionId(v || '')}
            placeholder="尚未确定机构"
            options={Object.entries(state?.institutions || {})
              .filter(([, i]) => i.draft.serviceAccess.enabled)
              .map(([id, i]) => ({ value: id, label: i.draft.publicProfile?.name || id }))}
          />
        </label>
        <Button
          type="primary"
          loading={busy}
          onClick={() =>
            void run(async () => {
              const result = await createSyntheticRequest({
                kind: kind as 'CONSULTATION' | 'VISIT_INTENT',
                ...(institutionId ? { institutionId } : {}),
              });
              navigate('/requests?requestId=' + result.item.id);
            })
          }
        >
          新增模拟需求并查看
        </Button>
        <p className="muted">自动生成演示联系人编号与不可拨打的联络标识，不填写真实电话。</p>
      </section>
      <section className="panel">
        <h2>场景与恢复</h2>
        <div className="demo-actions">
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await loadHistoricalScenario();
                navigate('/requests?requestId=' + result.item.id);
              })
            }
          >
            加载可登记到访的历史演示记录
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (
                  await confirmAction(
                    '加载空数据场景？',
                    '清空演示需求与行程，保留合成机构；其他标签也会更新。建议先导出进度。',
                  )
                )
                  await loadEmptyScenario();
              })
            }
          >
            空数据场景
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (
                  await confirmAction(
                    '恢复初始演示？',
                    '覆盖本浏览器演示进度，并按今天重建场景；所有标签的旧草稿与待处理操作会失效。',
                  )
                )
                  await resetDemo();
              })
            }
          >
            一键恢复初始演示
          </Button>
          <Button
            status="danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (
                  await confirmAction(
                    '清除本浏览器演示数据？',
                    '删除本项目的需求、机构、报告和进度。不会清除其他网站资料。可稍后恢复初始演示。',
                  )
                )
                  await clearDemo();
              })
            }
          >
            清除本浏览器演示数据
          </Button>
        </div>
      </section>
      <section className="panel">
        <h2>电脑与手机手动接续</h2>
        <p>
          进度文件只供合成演示。导入会覆盖本浏览器副本，不会同步其他设备。最多 2
          MiB；版本、合成标识和关联必须通过校验。
        </p>
        <div className="demo-actions">
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                saveFile(
                  new Blob([await exportDemo()], { type: 'application/json' }),
                  '快康养-合成演示进度.json',
                );
                setMessage('已发起进度文件下载，请在浏览器确认文件保存。');
              })
            }
          >
            导出演示进度
          </Button>
          <label className="demo-file">
            选择进度文件
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  setError('文件超过 2 MiB。');
                  return;
                }
                try {
                  setProgress(await f.text());
                } catch {
                  setError('文件读取失败，可重选或粘贴合成进度。');
                }
              }}
            />
          </label>
        </div>
        <label>
          或粘贴演示进度
          <textarea
            rows={4}
            value={progress}
            maxLength={2 * 1024 * 1024}
            onChange={(e) => setProgress(e.target.value)}
            placeholder="仅粘贴从这里导出的合成进度"
          />
        </label>
        <Button
          disabled={busy || !progress}
          onClick={() =>
            void run(async () => {
              if (
                await confirmAction(
                  '校验并覆盖演示进度？',
                  '校验失败不会改变现有数据；成功后旧标签草稿失效，需要重新进入。',
                )
              )
                await importDemo(progress);
            })
          }
        >
          校验并导入演示进度
        </Button>
      </section>
      <section className="panel">
        <h2>机构历史与合成导入</h2>
        <p>
          新草稿、模拟来源确认、V1/V2发布和服务资格在“机构资料”中操作。下方读取指定历史版本，不会自动换成最新版。
        </p>
        <Link to="/institutions">维护模拟机构 →</Link>
        <div className="demo-history">
          {Object.entries(state?.institutions || {}).map(([id, i]) => (
            <div key={id}>
              <strong>{i.draft.publicProfile?.name || id}</strong>
              <div>
                {Object.keys(i.versions).map((rev) => (
                  <Link key={rev} to={'/versions/' + id + '/' + rev}>
                    查看 V{rev}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              saveFile(
                new Blob([await exportBaselineDemo()], { type: 'application/json' }),
                '快康养-合成机构导入样例.json',
              );
              setMessage('样例已发起下载。可在机构资料底部使用文件或粘贴导入。');
            })
          }
        >
          下载仅含合成标识的机构导入样例
        </Button>
      </section>
      <section className="panel">
        <h2>主动体验失败与冲突</h2>
        <p>
          两个标签打开同一家机构并编辑：先在标签 A 保存，再在 B 保存旧版本，B
          会保留输入并进入冲突核对。不要先刷新 B。
        </p>
        <label>
          指定下一次写入
          <Select
            value={faultPath}
            onChange={setFaultPath}
            options={[
              { value: '/reports', label: '生成报告' },
              ...Object.keys(state?.requests || {})
                .slice(0, 8)
                .map((id) => ({
                  value: '/requests/' + id + '/followups',
                  label: '联系：' + state!.requests[id].item.contactName,
                })),
              ...Object.keys(state?.institutions || {}).map((id) => ({
                value: '/institutions/' + id + '/draft',
                label: '保存草稿：' + id,
              })),
            ]}
          />
        </label>
        <div className="demo-actions">
          <Button
            disabled={busy}
            onClick={() => {
              armFault({
                mode: 'before-write',
                path: faultPath,
                method: faultPath.endsWith('/draft') ? 'PUT' : 'POST',
              });
              setFault('已开启：指定操作将在保存前失败一次');
            }}
          >
            下一次请求模拟失败
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              armFault({
                mode: 'after-write',
                path: faultPath,
                method: faultPath.endsWith('/draft') ? 'PUT' : 'POST',
              });
              setFault('已开启：指定操作先保存，再丢失一次响应');
            }}
          >
            下一次写入已保存但响应丢失
          </Button>
          <Button
            onClick={() => {
              armFault(null);
              setFault('');
            }}
          >
            关闭故障
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await expireDemoSession();
              })
            }
          >
            模拟会话失效
          </Button>
        </div>
        {fault && (
          <Alert
            type="warning"
            content={
              fault +
              '。仅匹配此操作；关闭后恢复正常。遇未知结果请先查询，再使用原操作重试，不会新增重复事件。'
            }
          />
        )}
      </section>
      <p className="muted">
        构建：{__BUILD_SHA__.slice(0, 12)} · PUBLIC_DEMO ·
        无真实服务、通知或埋点。中国大陆访问情况需朋友用移动数据与 Wi-Fi 实测。
      </p>
    </div>
  );
}
export function DemoVersionViewer() {
  const { id, revision } = useParams();
  const [state, setState] = useState<DemoState>(),
    [error, setError] = useState('');
  useEffect(() => {
    void readDemo()
      .then(setState)
      .catch((e) => setError(describe(e)));
  }, [id, revision]);
  const version = id && revision ? state?.institutions[id]?.versions[revision] : undefined;
  return (
    <section className="panel">
      <h1>模拟机构历史版本 V{revision}</h1>
      <p>固定读取绑定版本，后续发布不会改写这里的资料。</p>
      <Link to="/demo-tools">返回演示工具</Link>
      {error ? (
        <Alert type="error" content={error} />
      ) : !state ? (
        <Spin />
      ) : !version ? (
        <p>该演示版本不存在。</p>
      ) : (
        <>
          <h2>{version.publicProfile?.name}</h2>
          <p>{version.publicProfile?.address}</p>
          <p>{version.publicProfile?.source}</p>
          <div className="demo-price-grid">
            {version.publicProfile?.prices.map((p) => (
              <div key={p.level}>
                <strong>{p.level}</strong>
                <p>
                  床位 {p.bed} + 护理 {p.care} + 餐食 {p.food}
                </p>
                <b>合计 {p.total} 元／月（合成）</b>
              </div>
            ))}
          </div>
          <details>
            <summary>查看此版本完整合成资料</summary>
            <pre className="demo-json">{JSON.stringify(version, null, 2)}</pre>
          </details>
        </>
      )}
    </section>
  );
}
