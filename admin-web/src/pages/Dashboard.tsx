import { useRenderMark } from '../useRenderMark';
import '@arco-design/web-react/es/Table/style/css.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Table, Tag, Spin, Alert } from '@arco-design/web-react';
import { IconArrowRight, IconRefresh } from '@arco-design/web-react/icon';
import { client, describe } from '../api/client';
import { listSchema, statusLabels, kindLabels } from '../api/schema';
import { time, today } from '../time';
import type { z } from 'zod';
const counts = [
  ['PENDING_CONTACT', '待联系', '及时回应新的需求'],
  ['FOLLOWING_UP', '跟进中', '让每次沟通有下一步'],
  ['PENDING_ARRANGEMENT', '待安排', '核对家属与机构意向'],
  ['CONFIRMED', '有确认带看的需求', '按实际排期准备服务'],
] as const;
export default function Dashboard() {
  const [data, setData] = useState<z.infer<typeof listSchema>[]>(),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    setData(undefined);
    Promise.all(
      counts.map(([status]) =>
        client.request('/requests?limit=5&offset=0&status=' + status, listSchema),
      ),
    )
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(describe(e));
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useRenderMark('admin-dashboard-ready', !!data);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">OPERATIONS / DAILY OVERVIEW</p>
          <h1>把今天的服务，安排好</h1>
          <p>{today()} · 北京时间 · 免费信息对接与带看服务</p>
        </div>
        <Button icon={<IconRefresh />} onClick={() => setRefresh((v) => v + 1)}>
          刷新工作台
        </Button>
      </div>
      {error && <Alert type="error" content={error} />}
      <div className="metric-grid">
        {counts.map(([status, label, caption], i) => (
          <Link
            to={'/requests?status=' + status}
            key={status}
            className="metric"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <span>{label}</span>
            <strong>{data ? data[i].total : error ? '—' : <Spin />}</strong>
            <small>
              {caption} <IconArrowRight />
            </small>
          </Link>
        ))}
      </div>
      <p className="muted">
        以上为服务器完整范围内、按当前状态统计的需求数；不是今日新增数或行程场次。
      </p>
      <div className="split-content">
        <section className="panel">
          <div className="section-caption">
            <h2>等待第一次回应</h2>
            <Link to="/requests?status=PENDING_CONTACT">
              查看全部 <IconArrowRight />
            </Link>
          </div>
          <p className="muted">最近 5 条待联系需求 · 按创建时间倒序</p>
          <Table
            rowKey="id"
            loading={!data && !error}
            data={data?.[0].items || []}
            pagination={false}
            scroll={{ x: 520 }}
            columns={[
              {
                title: '需求',
                dataIndex: 'kind',
                render: (v) => kindLabels[v as keyof typeof kindLabels],
              },
              { title: '意向机构', render: (_, r) => r.institutionName || '请顾问协助推荐' },
              {
                title: '创建时间',
                width: 190,
                render: (_, r) => <span className="datetime">{time(r.createdAt)}</span>,
              },
              {
                title: '状态',
                render: (_, r) => (
                  <Tag color="orange">{statusLabels[r.status as keyof typeof statusLabels]}</Tag>
                ),
              },
            ]}
          />
        </section>
        <section className="panel">
          <p className="eyebrow">SERVICE CHECKLIST</p>
          <h2>从信息到行动，每一步都清楚</h2>
          {[
            ['01', '回应需求', '查看必要联系资料，记录真实联系结果。', '/requests'],
            ['02', '安排看院', '双方确认后再排期，检查人员与交通缓冲。', '/visits'],
            ['03', '维护资料', '有来源的事实，经过确认后按版本发布。', '/institutions'],
          ].map(([number, title, desc, path]) => (
            <Link
              key={number}
              to={path}
              style={{
                display: 'flex',
                gap: 18,
                padding: '20px 0',
                borderBottom: '1px solid #eeeae4',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span style={{ color: '#b9b1a5', fontSize: 22 }}>{number}</span>
              <div>
                <b>{title}</b>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  {desc}
                </p>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
