import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, NavBar, Popup, TextArea } from 'antd-mobile';
import type { TextAreaRef } from 'antd-mobile';
import './mobile.css';

type Screen = { page: 'requests' | 'conflict' } | { page: 'detail'; id: string };
type Draft = { note: string; next: string; savedNote: string; savedNext: string };
type Version = 'local' | 'server';
const requests = [
  {
    id: 'EV-028',
    kind: '带看意向',
    family: '样例家庭 A',
    initial: 'A',
    institution: '春和康养中心',
    area: '武昌区',
    status: '待联系',
    time: '12 分钟前',
    source: '小程序意向',
    next: '了解看院意向，确认方便联系的时间',
    color: 'mint',
  },
  {
    id: 'EV-027',
    kind: '普通咨询',
    family: '样例家庭 B',
    initial: 'B',
    institution: '青禾长者之家',
    area: '洪山区',
    status: '跟进中',
    time: '42 分钟前',
    source: '小程序咨询',
    next: '等待家庭回复，继续了解机构需求',
    color: 'blue',
  },
  {
    id: 'EV-026',
    kind: '带看意向',
    family: '样例家庭 C',
    initial: 'C',
    institution: '春和康养中心',
    area: '武昌区',
    status: '待安排',
    time: '今天 09:15',
    source: '线下合成样例',
    next: '确认同行人数与出发地点',
    color: 'sand',
  },
  {
    id: 'EV-025',
    kind: '普通咨询',
    family: '样例家庭 D',
    initial: 'D',
    institution: '晴川颐养社区',
    area: '汉阳区',
    status: '待联系',
    time: '昨天 16:30',
    source: '小程序咨询',
    next: '首次联系，了解家庭目前的安排',
    color: 'rose',
  },
] as const;
const statuses = ['全部需求', '待联系', '跟进中', '待安排'] as const;
const nextActions = ['继续联系', '等待回复', '沟通看院意向'];
const differences = [
  {
    key: 'address',
    label: '机构地址',
    hint: '请核对入口与接待地点。',
    local:
      '武汉市武昌区东湖路 88 号春和康养中心 2 栋一层接待处（从东湖路南门进入，沿无障碍通道直行约 200 米，在花园旁右转）',
    server:
      '武汉市武昌区东湖路 88 号春和康养中心 2 栋一层访客中心（从北门进入，沿湖边步道直行约 300 米，由访客中心统一接待）',
  },
  {
    key: 'name',
    label: '机构名称',
    hint: '比较机构公开名称；当前两份名称均为合成样例。',
    local: '春和康养中心（样例）',
    server: '春和康养服务中心（样例）',
  },
  {
    key: 'nature',
    label: '机构性质',
    hint: '机构性质应以人工确认资料为准。此处仅演示差异选择。',
    local: '民营（合成资料，未核验）',
    server: '公建民营（合成资料，未核验）',
  },
  {
    key: 'room',
    label: '房间与居住条件',
    hint: '仅比较描述文字，不构成真实床位或接收能力。',
    local: '合成样例：以双人间为主，设有共享花园与阅读角。具体房型及设施以实地核实为准。',
    server: '合成样例：设有单人间、双人间与家属会客室。具体房型及设施以实地核实为准。',
  },
] as const;

function Icon({
  name,
}: {
  name: 'leaf' | 'search' | 'filter' | 'arrow' | 'requests' | 'compare' | 'check' | 'clock';
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    leaf: (
      <>
        <path d="M19 4c-8-1-14 2-13 8 0 4 6 6 9 2 2-3 2-6 4-10Z" />
        <path d="m5 20 8-11" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    filter: (
      <>
        <path d="M4 6h16M7 12h10M10 18h4" />
        <circle cx="8" cy="6" r="1.5" />
        <circle cx="16" cy="12" r="1.5" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    requests: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="3" />
        <path d="M9 4V2h6v2M9 10h6M9 15h4" />
      </>
    ),
    compare: (
      <>
        <path d="M5 7h14m-4-4 4 4-4 4M19 17H5m4-4-4 4 4 4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      className="em-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default function MobilePrototype({ view }: { view: 'requests' | 'conflict' }) {
  const variant = new URLSearchParams(window.location.search).get('variant') === 'b' ? 'b' : 'a';
  const [route, setRoute] = useState<Screen>({ page: view });
  const [filter, setFilter] = useState<string>('全部需求');
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saved, setSaved] = useState<Record<string, { note: string; next: string }[]>>({});
  const [notice, setNotice] = useState('');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [field, setField] = useState(0);
  const [choices, setChoices] = useState<Partial<Record<number, Version>>>({});
  const [complete, setComplete] = useState(false);
  const indexRef = useRef(0);
  const dirtyRef = useRef(false);
  const restoringRef = useRef(false);
  const permittedPopRef = useRef(false);
  const pendingRef = useRef<null | (() => void)>(null);
  const textRef = useRef<TextAreaRef>(null);
  const request = route.page === 'detail' ? requests.find((item) => item.id === route.id)! : null;
  const draft = request
    ? (drafts[request.id] ?? { note: '', next: '继续联系', savedNote: '', savedNext: '继续联系' })
    : null;
  const hasUnsaved = Object.values(drafts).some(
    (item) => item.note !== item.savedNote || item.next !== item.savedNext,
  );
  dirtyRef.current =
    route.page === 'detail' &&
    !!draft &&
    (draft.note !== draft.savedNote || draft.next !== draft.savedNext);

  useEffect(() => {
    const initial = { page: view } as Screen;
    window.history.replaceState({ evergreenMobile: true, index: 0, route: initial }, '');
    const onPop = (event: PopStateEvent) => {
      if (restoringRef.current) {
        restoringRef.current = false;
        return;
      }
      const target = event.state?.evergreenMobile
        ? (event.state.route as Screen)
        : ({ page: view } as Screen);
      const targetIndex = event.state?.evergreenMobile
        ? (event.state.index as number)
        : indexRef.current - 1;
      if (dirtyRef.current && !permittedPopRef.current) {
        const delta = indexRef.current - targetIndex;
        restoringRef.current = true;
        window.history.go(delta);
        pendingRef.current = () => {
          permittedPopRef.current = true;
          window.history.go(-delta);
        };
        setLeaveOpen(true);
        return;
      }
      permittedPopRef.current = false;
      indexRef.current = targetIndex;
      setRoute(target);
      setNotice('');
      window.scrollTo?.(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [view]);

  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [hasUnsaved]);

  function navigate(next: Screen) {
    const apply = () => {
      indexRef.current += 1;
      window.history.pushState({ evergreenMobile: true, index: indexRef.current, route: next }, '');
      setRoute(next);
      setNotice('');
      window.scrollTo?.(0, 0);
    };
    if (dirtyRef.current) {
      pendingRef.current = apply;
      setLeaveOpen(true);
    } else apply();
  }

  function updateDraft(patch: Partial<Pick<Draft, 'note' | 'next'>>) {
    if (!request || !draft) return;
    setDrafts((previous) => ({ ...previous, [request.id]: { ...draft, ...patch } }));
    setNotice('');
  }

  function saveContact() {
    if (!request || !draft || !draft.note.trim()) return;
    setSaved((previous) => ({
      ...previous,
      [request.id]: [
        ...(previous[request.id] ?? []),
        { note: draft.note.trim(), next: draft.next },
      ],
    }));
    setDrafts((previous) => ({
      ...previous,
      [request.id]: { ...draft, savedNote: draft.note, savedNext: draft.next },
    }));
    setNotice('已暂存到本页样例，刷新即清空；未联系任何人。');
  }

  const picked = Object.keys(choices).length;
  const filtered = requests.filter(
    (item) =>
      (filter === '全部需求' || item.status === filter) &&
      `${item.family}${item.institution}${item.id}`.includes(search.trim()),
  );
  const current = differences[field];

  return (
    <div className="evergreen-mobile" data-variant={variant}>
      <header className="em-topbar">
        <NavBar
          back={route.page === 'requests' ? null : '返回'}
          backIcon={route.page === 'requests' ? false : undefined}
          onBack={() => navigate({ page: 'requests' })}
          left={
            route.page === 'requests' ? (
              <span className="em-brand">
                <span className="em-brand-symbol">
                  <Icon name="leaf" />
                </span>
                快康养<span className="em-brand-suffix">· 工作台</span>
              </span>
            ) : undefined
          }
          right={
            <span className="em-user" aria-label="合成顾问账号">
              林
            </span>
          }
        >
          {route.page === 'detail' ? '需求详情' : route.page === 'conflict' ? '核对机构资料' : null}
        </NavBar>
      </header>
      <div className="em-sample-banner">
        <span className="em-live-dot" />
        交互样例 · 不写入业务
      </div>

      {route.page === 'requests' && (
        <main className="em-content em-request-list">
          <section className="em-greeting">
            <p className="em-eyebrow">10 月 28 日，星期三</p>
            <h1>
              每一次托付，
              <br />
              都好好跟进<span className="em-title-dot">。</span>
            </h1>
            <p className="em-soft">从一声问候开始，让下一步更清楚。</p>
            <div className="em-leaf-decoration" aria-hidden="true">
              <Icon name="leaf" />
            </div>
          </section>
          <div className="em-stat-row" aria-label="合成需求统计">
            <button className="em-stat" onClick={() => setFilter('待联系')}>
              <span>
                <Icon name="clock" />
                待联系
              </span>
              <strong>
                {String(requests.filter((item) => item.status === '待联系').length).padStart(
                  2,
                  '0',
                )}
                <small>个需求</small>
              </strong>
            </button>
            <button className="em-stat" onClick={() => setFilter('待安排')}>
              <span>
                <Icon name="check" />
                待安排
              </span>
              <strong>
                {String(requests.filter((item) => item.status === '待安排').length).padStart(
                  2,
                  '0',
                )}
                <small>个需求</small>
              </strong>
            </button>
          </div>
          <div className="em-search-row">
            <label className="em-search">
              <Icon name="search" />
              <input
                aria-label="搜索样例需求"
                placeholder="搜家庭、机构或需求编号"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button
              className="em-filter-button"
              onClick={() => setFilterOpen(true)}
              aria-label="筛选需求状态"
            >
              <Icon name="filter" />
            </button>
          </div>
          <div className="em-section-heading">
            <h2>{filter}</h2>
            <button onClick={() => setFilterOpen(true)}>
              {filtered.length} 个需求 <span aria-hidden="true">⌄</span>
            </button>
          </div>
          <div className="em-card-list">
            {filtered.map((item) => (
              <button
                className="em-request-card"
                key={item.id}
                onClick={() => navigate({ page: 'detail', id: item.id })}
                aria-label={`查看${item.family}需求`}
              >
                <span className="em-card-top">
                  <span className={`em-avatar em-avatar-${item.color}`}>{item.initial}</span>
                  <span className="em-card-person">
                    <strong>{item.family}</strong>
                    <span>
                      {item.id} · {item.time}
                    </span>
                  </span>
                  <span
                    className={`em-status em-status-${item.status === '待联系' ? 'new' : item.status === '待安排' ? 'pending' : 'active'}`}
                  >
                    {item.status}
                  </span>
                </span>
                <span className="em-institution">
                  {item.institution}
                  <span>
                    {item.area} · {item.kind} · 合成机构
                  </span>
                </span>
                <span className="em-card-next">
                  <span>
                    <span className="em-next-label">下一步</span>
                    {item.next}
                  </span>
                  <Icon name="arrow" />
                </span>
                {drafts[item.id] && drafts[item.id].note !== drafts[item.id].savedNote && (
                  <span className="em-draft-tag">有未暂存的输入</span>
                )}
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="em-empty">
              <Icon name="search" />
              <h3>没有找到对应样例</h3>
              <p>换个关键词，或查看全部状态。</p>
              <Button
                onClick={() => {
                  setSearch('');
                  setFilter('全部需求');
                }}
              >
                重置筛选
              </Button>
            </div>
          )}
          <p className="em-end-note">已显示全部合成需求 · 免费信息对接</p>
        </main>
      )}

      {route.page === 'detail' && request && draft && (
        <main className="em-content em-detail">
          <section className="em-detail-hero">
            <span className={`em-avatar em-avatar-${request.color}`}>{request.initial}</span>
            <div>
              <p className="em-eyebrow">需求 {request.id}</p>
              <h1>{request.family}</h1>
              <span className="em-status em-status-new">{request.status}</span>
            </div>
          </section>
          <section className="em-panel">
            <div className="em-section-heading">
              <h2>这次的意向</h2>
              <span className="em-tiny-label">合成资料</span>
            </div>
            <dl className="em-detail-facts">
              <div>
                <dt>意向机构</dt>
                <dd>{request.institution}</dd>
              </div>
              <div>
                <dt>所在区域</dt>
                <dd>武汉市{request.area}</dd>
              </div>
              <div>
                <dt>需求来源</dt>
                <dd>{request.source}</dd>
              </div>
              <div>
                <dt>联系资料</dt>
                <dd>样例中不展示真实联系方式</dd>
              </div>
            </dl>
            <p className="em-inline-note">带看意向不等于确认时间。此页仅体验跟进过程。</p>
          </section>
          <section className="em-panel">
            <div className="em-section-heading">
              <h2>联系记录</h2>
              <span className="em-tiny-label">本页样例</span>
            </div>
            <ol className="em-timeline">
              <li>
                <span className="em-timeline-dot" />
                <div>
                  <strong>收到{request.kind}</strong>
                  <p>
                    {request.time} · {request.source} · 合成样例
                  </p>
                  <p>
                    {request.kind === '带看意向'
                      ? '家庭希望先了解机构，再沟通后续看院安排。'
                      : '家庭希望了解机构情况，目前没有带看意向。'}
                  </p>
                </div>
              </li>
              {(saved[request.id] ?? []).map((item, index) => (
                <li key={index}>
                  <span className="em-timeline-dot" />
                  <div>
                    <strong>本页暂存记录 {index + 1}</strong>
                    <p className="em-record-note">{item.note}</p>
                    <p>下一步：{item.next}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="em-panel em-contact-panel" id="em-contact-form">
            <div className="em-section-heading">
              <h2>记下这次沟通</h2>
              <span className="em-tiny-label">仅本地</span>
            </div>
            <label className="em-field-label" htmlFor="em-contact-note">
              联系备注
            </label>
            <TextArea
              ref={textRef}
              id="em-contact-note"
              aria-label="联系备注"
              className="em-textarea"
              placeholder="写下沟通结果或还需确认的事情…"
              value={draft.note}
              onChange={(note) => updateDraft({ note })}
              rows={4}
              maxLength={600}
              showCount
            />
            <fieldset className="em-next-actions">
              <legend>下一步动作</legend>
              {nextActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  aria-pressed={draft.next === action}
                  className={draft.next === action ? 'is-selected' : ''}
                  onClick={() => updateDraft({ next: action })}
                >
                  {draft.next === action && <Icon name="check" />}
                  {action}
                </button>
              ))}
            </fieldset>
            <p className="em-inline-note">输入用于本页交互演示。暂存后仍会在刷新时清空。</p>
          </section>
          {notice && (
            <p className="em-notice" role="status">
              <Icon name="check" />
              {notice}
            </p>
          )}
          <div className="em-action-bar">
            <Button onClick={() => navigate({ page: 'requests' })}>返回列表</Button>
            <Button
              color="primary"
              disabled={!draft.note.trim() || !dirtyRef.current}
              onClick={saveContact}
            >
              暂存到样例
            </Button>
          </div>
        </main>
      )}

      {route.page === 'conflict' && (
        <main className="em-content em-conflict">
          {!complete ? (
            <>
              <section className="em-conflict-heading">
                <p className="em-soft">本地输入已保留，请逐项选择。</p>
              </section>
              <div className="em-progress-info">
                <strong>
                  差异 {field + 1} / {differences.length}
                </strong>
                <span>
                  已选 {picked} / {differences.length}
                </span>
              </div>
              <div className="em-progress" aria-label="差异选择进度">
                {differences.map((item, index) => (
                  <button
                    key={item.label}
                    onClick={() => setField(index)}
                    aria-label={`查看差异${index + 1}：${item.label}`}
                    aria-current={index === field ? 'step' : undefined}
                    className={`${choices[index] ? 'is-done' : ''} ${index === field ? 'is-current' : ''}`}
                  >
                    <span>{choices[index] ? <Icon name="check" /> : index + 1}</span>
                  </button>
                ))}
              </div>
              <section className="em-difference-field" aria-live="polite">
                <h2>{current.label}</h2>
                <p className="em-soft">{current.hint}</p>
                <div
                  className="em-version-options"
                  role="radiogroup"
                  aria-label={`选择${current.label}版本`}
                >
                  {(['local', 'server'] as const).map((version) => (
                    <button
                      key={version}
                      role="radio"
                      aria-checked={choices[field] === version}
                      className={`em-version-card ${choices[field] === version ? 'is-selected' : ''}`}
                      onClick={() => setChoices((previous) => ({ ...previous, [field]: version }))}
                    >
                      <span className="em-version-heading">
                        <span className="em-version-kicker">
                          {version === 'local' ? '我的本地版本' : '服务器样例版本'}
                        </span>
                        <span className="em-radio-mark">
                          {choices[field] === version && <Icon name="check" />}
                        </span>
                      </span>
                      <span className="em-version-time">
                        {version === 'local' ? '本页编辑 · 10:42' : '合成快照 · 10:38'}
                      </span>
                      <span className="em-version-value">{current[version]}</span>
                      <span className="em-version-select">
                        {choices[field] === version
                          ? '已选择此版本'
                          : version === 'local'
                            ? '保留本地'
                            : '采用服务器'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <div className="em-difference-navigation">
                <Button disabled={field === 0} onClick={() => setField((previous) => previous - 1)}>
                  上个差异
                </Button>
                <span>
                  {picked === differences.length
                    ? '每一项都已亲自选择'
                    : `还需选择 ${differences.length - picked} 项`}
                </span>
              </div>
              <p className="em-inline-note">
                返回上一项会保留选择。未选择的字段不会自动采用任何版本。
              </p>
              <div className="em-action-bar em-conflict-footer">
                <Button
                  disabled={field === differences.length - 1}
                  onClick={() => setField((previous) => previous + 1)}
                >
                  下个差异 <span aria-hidden="true">→</span>
                </Button>
                <Button
                  color="primary"
                  disabled={picked !== differences.length}
                  onClick={() => setComplete(true)}
                >
                  完成校对
                </Button>
              </div>
            </>
          ) : (
            <>
              <section className="em-complete-heading">
                <span className="em-complete-icon">
                  <Icon name="check" />
                </span>
                <p className="em-eyebrow">全部 {differences.length} 项已选择</p>
                <h1>选择已整理好</h1>
                <p>
                  以下为你的选值汇总。
                  <br />
                  <strong>仅本页演示，未提交服务器。</strong>
                </p>
              </section>
              <div className="em-summary-list">
                {differences.map((item, index) => (
                  <section className="em-panel" key={item.label}>
                    <div className="em-section-heading">
                      <h2>{item.label}</h2>
                      <span className="em-tiny-label">
                        {choices[index] === 'local' ? '保留本地' : '采用服务器'}
                      </span>
                    </div>
                    <p>{item[choices[index]!]}</p>
                  </section>
                ))}
              </div>
              <div className="em-action-bar">
                <Button
                  onClick={() => {
                    setComplete(false);
                    setField(0);
                  }}
                >
                  返回修改选择
                </Button>
                <Button color="primary" onClick={() => navigate({ page: 'requests' })}>
                  回到需求
                </Button>
              </div>
            </>
          )}
        </main>
      )}

      {route.page === 'requests' && (
        <nav className="em-bottom-nav" aria-label="手机工作导航">
          <button className="is-active" aria-current="page" onClick={() => {}}>
            <Icon name="requests" />
            <span>需求跟进</span>
          </button>
          <button onClick={() => navigate({ page: 'conflict' })}>
            <Icon name="compare" />
            <span>差异校对</span>
          </button>
        </nav>
      )}
      <Popup
        visible={filterOpen}
        onMaskClick={() => setFilterOpen(false)}
        onClose={() => setFilterOpen(false)}
        getContainer={null}
        bodyClassName="em-filter-popup"
        showCloseButton
      >
        <section
          className="em-filter-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="em-filter-title"
        >
          <span className="em-sheet-handle" />
          <h2 id="em-filter-title">按状态找需求</h2>
          <p className="em-soft">选好状态，专注眼前的一步。</p>
          <div className="em-filter-options">
            {statuses.map((status) => (
              <button
                key={status}
                aria-pressed={filter === status}
                onClick={() => {
                  setFilter(status);
                  setFilterOpen(false);
                }}
              >
                <span>{status}</span>
                <span>
                  {status === '全部需求'
                    ? requests.length
                    : requests.filter((item) => item.status === status).length}
                  {filter === status && <Icon name="check" />}
                </span>
              </button>
            ))}
          </div>
          <Button block onClick={() => setFilterOpen(false)}>
            返回需求
          </Button>
        </section>
      </Popup>
      <Dialog
        visible={leaveOpen}
        getContainer={null}
        destroyOnClose
        title="还有未暂存的联系输入"
        content="可以继续填写，或保留草稿返回。草稿只留在本页，刷新后会清空。"
        closeOnAction
        actions={[
          {
            key: 'stay',
            text: '继续填写',
            onClick: () => {
              setLeaveOpen(false);
              pendingRef.current = null;
            },
          },
          {
            key: 'leave',
            text: '保留草稿并返回',
            onClick: () => {
              setLeaveOpen(false);
              const go = pendingRef.current;
              pendingRef.current = null;
              go?.();
            },
          },
        ]}
        onClose={() => setLeaveOpen(false)}
      />
    </div>
  );
}
