import { useState } from 'react';
import { Alert, Button, ConfigProvider, Drawer, Empty, Segmented, Table, Tag, Tooltip } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './desktop.css';
import { brand } from './tokens';

type IconName =
  | 'home'
  | 'requests'
  | 'calendar'
  | 'building'
  | 'report'
  | 'arrow'
  | 'refresh'
  | 'leaf';
function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    requests: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18M7 15h3m4 0h3" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V5l10-2v18M14 9h6v12M2 21h20M8 7h2M8 11h2M8 15h2M17 13v2" />
      </>
    ),
    report: (
      <>
        <path d="M4 3v18h17M8 17v-5m5 5V7m5 10V4" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    refresh: (
      <>
        <path d="M20 9a8 8 0 1 0 0 6M20 3v6h-6" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 3C9 2 3 7 5 15c8 4 15-1 15-12Z" />
        <path d="M3 21 15 9" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

// These fixtures are solely for visual comparison. No operational records or API writes.
const samples = [
  {
    id: 'SAMPLE-01',
    kind: '普通咨询',
    name: '样例家庭 01',
    institution: '请顾问协助推荐',
    created: '10月28日 09:40',
    status: 'PENDING_CONTACT',
  },
  {
    id: 'SAMPLE-02',
    kind: '带看意向',
    name: '样例家庭 02',
    institution: '合成机构 · 青禾之家',
    created: '10月28日 09:15',
    status: 'PENDING_CONTACT',
  },
  {
    id: 'SAMPLE-03',
    kind: '普通咨询',
    name: '样例家庭 03',
    institution: '请顾问协助推荐',
    created: '10月27日 16:30',
    status: 'PENDING_CONTACT',
  },
  {
    id: 'SAMPLE-04',
    kind: '普通咨询',
    name: '样例家庭 04',
    institution: '请顾问协助推荐',
    created: '10月27日 15:10',
    status: 'FOLLOWING_UP',
  },
  {
    id: 'SAMPLE-05',
    kind: '带看意向',
    name: '样例家庭 05',
    institution: '合成机构 · 青禾之家',
    created: '10月27日 10:00',
    status: 'PENDING_ARRANGEMENT',
  },
  {
    id: 'SAMPLE-06',
    kind: '带看意向',
    name: '样例家庭 06',
    institution: '合成机构 · 青禾之家',
    created: '10月26日 11:00',
    status: 'CONFIRMED',
  },
];
const metrics = [
  ['PENDING_CONTACT', '待联系', '每一份需求，都值得及时回应', 'requests'],
  ['FOLLOWING_UP', '跟进中', '接续沟通，明确下一步', 'leaf'],
  ['PENDING_ARRANGEMENT', '待安排', '一起找到合适的看院时间', 'calendar'],
  ['CONFIRMED', '已确认带看', '有确认带看的需求数', 'building'],
] as const;
const navigation: [IconName, string][] = [
  ['home', '工作台'],
  ['requests', '需求管理'],
  ['calendar', '带看日程'],
  ['building', '机构资料'],
  ['report', '服务报告'],
];

export default function DesktopPrototype({ variant }: { variant: 'a' | 'b' }) {
  const [state, setState] = useState('样例数据');
  const [selected, setSelected] = useState<(typeof samples)[number] | null>(null);
  const [destination, setDestination] = useState('');
  const rows = state === '样例数据' ? samples : [];
  const [refresh, setRefresh] = useState(false);
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: brand.primary,
          colorLink: brand.primary,
          colorLinkHover: brand.brand,
          colorText: brand.ink,
          colorTextSecondary: brand.muted,
          colorBorder: brand.line,
          colorBgLayout: brand.canvas,
          borderRadius: 12,
          fontSize: 15,
          controlHeight: 44,
          fontFamily: "'Microsoft YaHei UI', 'PingFang SC', sans-serif",
          boxShadowSecondary: '0 8px 32px rgba(15,81,79,0.07)',
        },
      }}
    >
      <div className="eg-desktop">
        <aside className="eg-sidebar">
          <a className="eg-brand" href="?view=dashboard&variant=a">
            <span className="eg-brand-mark">
              <Icon name="leaf" size={30} />
            </span>
            <span>
              快康养<small>让照护，多一份安心</small>
            </span>
          </a>
          <span className="eg-nav-caption">服务工作空间</span>
          <nav aria-label="后台模块">
            {navigation.map(([icon, title], i) => (
              <button
                key={title}
                className={i === 0 ? 'is-active' : ''}
                onClick={() => (i === 0 ? setDestination('') : setDestination(title))}
                aria-current={i === 0 ? 'page' : undefined}
              >
                <Icon name={icon} />
                {title}
                {i === 0 && <span className="eg-nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="eg-sidebar-bottom">
            <span className="eg-availability" /> 本机视觉预览<small>免费对接 · 用心陪伴</small>
          </div>
        </aside>
        <div className="eg-workspace">
          <header className="eg-topbar">
            <span>
              运营空间 <span className="eg-slash">/</span> <strong>工作台</strong>
            </span>
            <div className="eg-top-actions">
              <span className="eg-preview-pill">独立视觉标杆</span>
              <span className="eg-avatar">K</span>
              <span>预览工作空间</span>
            </div>
          </header>
          <main className="eg-main">
            <div className="eg-preview-controls" aria-label="视觉对照控制">
              <span>
                <strong>EVERGREEN</strong> / 第一阶段
              </span>
              <div>
                <span>品牌导航</span>
                <Segmented
                  value={variant}
                  options={[
                    { label: 'A · 浅薄荷', value: 'a' },
                    { label: 'B · 深青绿', value: 'b' },
                  ]}
                  onChange={(v) => {
                    const url = new URL(location.href);
                    url.searchParams.set('variant', String(v));
                    location.href = url.href;
                  }}
                />
                <a href={`?view=requests&variant=${variant}`}>手机需求 ↗</a>
                <a href={`?view=conflict&variant=${variant}&font=150`}>手机冲突 ↗</a>
              </div>
            </div>
            <div className="eg-welcome">
              <div>
                <div className="eg-eyebrow">
                  <span /> 用心连接，安心相伴
                </div>
                <h1>
                  把每一次托付，
                  <br className="eg-small-break" />
                  照顾得更好。
                </h1>
                <p>从一通及时的联系开始，让家庭的下一步更清楚。</p>
              </div>
              <div className="eg-plant" aria-hidden="true">
                <svg viewBox="0 0 210 150">
                  <path d="M101 139C114 100 113 51 152 23" />
                  <path d="M112 98C69 99 53 76 57 48c38 0 63 14 55 50Z" />
                  <path d="M122 69c-5-39 18-60 49-57 1 29-16 53-49 57Z" />
                  <path d="M108 117c19-36 46-45 75-28-14 28-40 38-75 28Z" />
                  <ellipse cx="108" cy="142" rx="47" ry="4" />
                </svg>
              </div>
            </div>
            <div className="eg-data-note">
              <span>
                <strong>交互样例</strong> 以下为 6 条合成需求，不是实际运营数据；A/B 内容完全相同。
              </span>
              <Segmented
                aria-label="数据状态"
                value={state}
                options={['样例数据', '空数据', '错误状态']}
                onChange={setState}
              />
            </div>
            {state === '错误状态' && (
              <Alert
                type="error"
                showIcon
                title="读取失败样例：当前无法获得需求数据"
                description="失败时不把未知计数显示成 0；重试按钮仅恢复本地样例。"
                action={<Button onClick={() => setState('样例数据')}>重试样例</Button>}
              />
            )}
            <section className="eg-metrics" aria-label="需求状态统计">
              {metrics.map(([status, label, caption, icon], i) => (
                <button key={status} className="eg-metric" onClick={() => setDestination(label)}>
                  <span className="eg-metric-top">
                    {label}
                    <span className={`eg-metric-icon tone-${i}`}>
                      <Icon name={icon} />
                    </span>
                  </span>
                  <strong>
                    {state === '错误状态' ? '—' : rows.filter((r) => r.status === status).length}
                    <small>条需求</small>
                  </strong>
                  <span className="eg-metric-caption">
                    {caption}
                    <Icon name="arrow" size={16} />
                  </span>
                </button>
              ))}
            </section>
            <p className="eg-count-note">
              统计口径：完整范围内按当前状态计数；不是今日新增、到访人数或行程场次。
            </p>
            <div className="eg-content-grid">
              <section className="eg-requests-panel">
                <div className="eg-section-heading">
                  <div>
                    <h2>从这里开始</h2>
                    <p>待联系需求 · 最近 5 条，创建时间倒序</p>
                  </div>
                  <Tooltip title="重新载入本地样例">
                    <Button
                      aria-label="刷新待联系样例"
                      icon={<Icon name="refresh" size={18} />}
                      onClick={() => {
                        setRefresh(true);
                        window.setTimeout(() => setRefresh(false), 350);
                      }}
                      loading={refresh}
                    />
                  </Tooltip>
                </div>
                <Table
                  rowKey="id"
                  pagination={false}
                  dataSource={rows.filter((r) => r.status === 'PENDING_CONTACT').slice(0, 5)}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          state === '错误状态' ? '数据暂不可用，请重试' : '暂时没有待联系需求'
                        }
                      />
                    ),
                  }}
                  columns={[
                    {
                      title: '需求 / 家庭',
                      key: 'family',
                      render: (_, r) => (
                        <div className="eg-family-cell">
                          <span className="eg-family-icon">
                            <Icon
                              name={r.kind === '普通咨询' ? 'requests' : 'calendar'}
                              size={20}
                            />
                          </span>
                          <div>
                            <strong>{r.kind}</strong>
                            <small>{r.name}</small>
                          </div>
                        </div>
                      ),
                    },
                    { title: '意向机构', dataIndex: 'institution' },
                    { title: '收到时间', dataIndex: 'created' },
                    {
                      title: '',
                      key: 'action',
                      render: (_, r) => (
                        <Button type="link" onClick={() => setSelected(r)}>
                          查看需求 <Icon name="arrow" size={16} />
                        </Button>
                      ),
                    },
                  ]}
                />
                <div className="eg-list-footer">
                  <span>一份清楚的记录，让下一次沟通更从容。</span>
                  <Button onClick={() => setDestination('需求管理')}>
                    查看全部需求 <Icon name="arrow" size={16} />
                  </Button>
                </div>
              </section>
              <aside className="eg-shortcuts">
                <h2>快捷办理</h2>
                <p>顺着服务的下一步</p>
                {[
                  ['calendar', '安排一次带看', '核对双方意向与时间'],
                  ['building', '维护机构资料', '让公开信息清楚可靠'],
                  ['report', '查看服务报告', '回看每一份服务进展'],
                ].map(([icon, title, caption]) => (
                  <button key={title} onClick={() => setDestination(title)}>
                    <span className="eg-shortcut-icon">
                      <Icon name={icon as IconName} />
                    </span>
                    <span>
                      <strong>{title}</strong>
                      <small>{caption}</small>
                    </span>
                    <Icon name="arrow" size={18} />
                  </button>
                ))}
                <div className="eg-gentle-note">
                  <Icon name="leaf" size={23} />
                  <span>
                    不急着给答案，
                    <br />
                    先听清每个家庭的需要。
                  </span>
                </div>
              </aside>
            </div>
            <footer className="eg-footer">
              <span>快康养 · 让每一份选择更安心</span>
              <span>视觉评审预览 · 无业务写入</span>
            </footer>
          </main>
        </div>
      </div>
      <Drawer
        title="需求详情 · 交互样例"
        open={!!selected}
        onClose={() => setSelected(null)}
        size={480}
      >
        {selected && (
          <div className="eg-detail">
            <Tag color="green">待联系</Tag>
            <h2>{selected.name}</h2>
            <p>
              {selected.kind} · {selected.institution}
            </p>
            <hr />
            <h3>联系记录</h3>
            <p>暂无联系记录。可在手机标杆体验记录与下一步动作。</p>
            <Button type="primary" href={`?view=requests&variant=${variant}`}>
              打开手机需求标杆
            </Button>
            <p>此处只演示页面布局，不发起联系、不提交数据。</p>
          </div>
        )}
      </Drawer>
      <Drawer title={destination} open={!!destination} onClose={() => setDestination('')}>
        <div className="eg-detail">
          <h2>先把体验打磨好</h2>
          <p>
            当前仅完成三项独立视觉标杆。此入口的正式功能保持在现有后台，视觉确认后接入同一套业务接口。
          </p>
          <Button type="primary" href={`?view=requests&variant=${variant}`}>
            体验手机需求
          </Button>
          <p>
            <a href={`?view=conflict&variant=${variant}&font=150`}>体验手机机构冲突核对 →</a>
          </p>
        </div>
      </Drawer>
    </ConfigProvider>
  );
}
