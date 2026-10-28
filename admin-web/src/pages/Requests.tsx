import { useRenderMark } from '../useRenderMark';
import '@arco-design/web-react/es/Table/style/css.js';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Form, Input, Select, Table, Tag } from '@arco-design/web-react';
import { IconSearch } from '@arco-design/web-react/icon';
import { listSchema, serviceSchema, statusLabels, kindLabels } from '../api/schema';
import { useRead } from '../useRead';
import { Field, options, ErrorNotice } from '../components/shared';
import RequestDetail from '../components/RequestDetail';
import { time } from '../time';
export default function Requests() {
  const [params] = useSearchParams();
  const initial = params.get('status') || '';
  const [filter, setFilter] = useState<Record<string, string>>(initial ? { status: initial } : {}),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null);
  const query = new URLSearchParams({ limit: '25', offset: String((page - 1) * 25), ...filter });
  const result = useRead('/requests?' + query, listSchema),
    services = useRead('/service-institutions', serviceSchema);
  useRenderMark('admin-requests-ready', !!result.data);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REQUESTS / EVERY CONNECTION COUNTS</p>
          <h1>需求管理</h1>
          <p>记录每次联系，为每个家庭明确下一步。</p>
        </div>
        <Tag>服务器分页 · 每页 25 条</Tag>
      </div>
      <section className="panel">
        <Form
          layout="vertical"
          className="filter-grid"
          initialValues={{ status: initial }}
          onSubmit={(values) => {
            setPage(1);
            setFilter(
              Object.fromEntries(
                Object.entries(values)
                  .filter(([, v]) => v)
                  .map(([k, v]) => [k, String(v)]),
              ),
            );
          }}
        >
          <Field name="status" label="需求状态">
            <Select allowClear placeholder="全部状态" options={options(statusLabels)} />
          </Field>
          <Field name="kind" label="需求类型">
            <Select allowClear placeholder="全部类型" options={options(kindLabels)} />
          </Field>
          <Field name="institutionId" label="意向机构">
            <Select
              allowClear
              showSearch
              placeholder="全部机构"
              options={services.data?.serviceInstitutions.map((r) => ({
                value: r.institutionId,
                label: r.institutionName + (r.enabled ? '' : '（已停用）'),
              }))}
            />
          </Field>
          <Field name="from" label="开始日期（北京时间）">
            <Input type="date" />
          </Field>
          <Field name="to" label="结束日期（含当天）">
            <Input type="date" />
          </Field>
          <Form.Item>
            <Button htmlType="submit" type="primary" icon={<IconSearch />}>
              查询需求
            </Button>
          </Form.Item>
        </Form>
        <ErrorNotice message={services.error} retry={services.reload} />
      </section>
      <section className="panel">
        <div className="section-caption">
          <h2>需求列表</h2>
          <span className="muted">
            {result.data ? '当前筛选共 ' + result.data.total + ' 条' : '正在读取完整范围总数'}
          </span>
        </div>
        <ErrorNotice message={result.error} retry={result.reload} />
        <Table
          rowKey="id"
          data={result.data?.items || []}
          loading={result.loading}
          scroll={{ x: 950 }}
          pagination={{
            current: page,
            pageSize: 25,
            total: result.data?.total || 0,
            onChange: setPage,
            showTotal: true,
          }}
          columns={[
            {
              title: '需求类型',
              dataIndex: 'kind',
              width: 130,
              render: (v) => kindLabels[v as keyof typeof kindLabels],
            },
            {
              title: '意向机构',
              width: 200,
              render: (_, r) => r.institutionName || '请顾问协助推荐',
            },
            {
              title: '当前状态',
              width: 140,
              render: (_, r) => (
                <Tag color={r.status === 'PENDING_CONTACT' ? 'orange' : 'gray'}>
                  {statusLabels[r.status as keyof typeof statusLabels]}
                </Tag>
              ),
            },
            {
              title: '创建时间（北京）',
              width: 170,
              render: (_, r) => <span className="datetime">{time(r.createdAt)}</span>,
            },
            {
              title: '数据标记',
              width: 140,
              render: (_, r) => (
                <Tag color={r.datasetMode === 'SYNTHETIC_TEST_ONLY' ? 'orange' : 'green'}>
                  {r.datasetMode === 'SYNTHETIC_TEST_ONLY' ? '合成测试' : '正式申请'}
                </Tag>
              ),
            },
            {
              title: '操作',
              width: 110,
              render: (_, r) => (
                <Button type="text" onClick={() => setSelected(r.id)}>
                  查看详情
                </Button>
              ),
            },
          ]}
        />
      </section>
      <RequestDetail id={selected} onClose={() => setSelected(null)} onChanged={result.reload} />
    </>
  );
}
