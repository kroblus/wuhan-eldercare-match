import { useRenderMark } from '../useRenderMark';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Form, Input, Select, Table, Tag, Modal, useMobile } from '../ui';
import { IconSearch } from '../ui/icons';
import { listSchema, serviceSchema, statusLabels, kindLabels } from '../api/schema';
import { useRead } from '../useRead';
import { Field, options, ErrorNotice } from '../components/shared';
import RequestDetail from '../components/RequestDetail';
import { time } from '../time';
export default function Requests() {
  const mobile = useMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [params] = useSearchParams();
  const [form] = Form.useForm();
  const initial = params.get('status') || '';
  const [filter, setFilter] = useState<Record<string, string>>(initial ? { status: initial } : {}),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null);
  const query = new URLSearchParams({ limit: '25', offset: String((page - 1) * 25), ...filter });
  const result = useRead('/requests?' + query, listSchema),
    services = useRead('/service-institutions', serviceSchema);
  useRenderMark('admin-requests-ready', !!result.data);
  const filterForm = (
    <Form
      form={form}
      layout="vertical"
      className="filter-grid"
      initialValues={{ status: initial }}
      onSubmit={(values) => {
        setFiltersOpen(false);
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
      <details className="filter-extra">
        <summary>按日期筛选</summary>
        <div className="form-two">
          {' '}
          <Field name="from" label="开始日期（北京时间）">
            <Input type="date" />
          </Field>
          <Field name="to" label="结束日期（含当天）">
            <Input type="date" />
          </Field>
        </div>
      </details>
      <Form.Item>
        <Button htmlType="submit" type="primary" icon={<IconSearch />}>
          查询需求
        </Button>
        <Button
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({ status: undefined });
            setFilter({});
            setPage(1);
          }}
        >
          重置
        </Button>
      </Form.Item>
    </Form>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>需求管理</h1>
          <p>记录每次联系，为每个家庭明确下一步。</p>
        </div>
        <Tag>服务器分页 · 每页 25 条</Tag>
      </div>
      {mobile ? (
        <>
          <div className="mobile-filter-summary">
            <p>
              {filter.status
                ? statusLabels[filter.status as keyof typeof statusLabels]
                : '全部需求'}{' '}
              · {result.data?.total ?? '—'} 条
            </p>
            <Button onClick={() => setFiltersOpen(true)}>筛选需求</Button>
          </div>
          <Modal
            visible={filtersOpen}
            title="筛选需求"
            footer={null}
            onCancel={() => setFiltersOpen(false)}
          >
            {filterForm}
            <Button long type="primary" onClick={() => form.submit()}>
              查看结果
            </Button>
          </Modal>
        </>
      ) : (
        <section className="panel">{filterForm}</section>
      )}
      <ErrorNotice message={services.error} retry={services.reload} />
      <section className={mobile ? 'request-list' : 'panel'}>
        <div className="section-caption">
          <h2>需求列表</h2>
          <span className="muted">
            {result.data ? '当前筛选共 ' + result.data.total + ' 条' : '正在读取完整范围总数'}
          </span>
        </div>
        <ErrorNotice message={result.error} retry={result.reload} />
        {mobile ? (
          <>
            <div className="request-cards">
              {result.data?.items.map((r) => (
                <button key={r.id} className="request-card" onClick={() => setSelected(r.id)}>
                  <header>
                    <h2>{kindLabels[r.kind]}</h2>
                    <Tag color={r.status === 'PENDING_CONTACT' ? 'green' : 'gray'}>
                      {statusLabels[r.status]}
                    </Tag>
                  </header>
                  <p>{r.institutionName || '请顾问协助推荐'}</p>
                  <footer>
                    <span>
                      {time(r.createdAt)}
                      <br />
                      {r.datasetMode === 'SYNTHETIC_TEST_ONLY' ? '合成测试' : '正式申请'}
                    </span>
                    <span>查看详情 →</span>
                  </footer>
                </button>
              ))}
              {result.loading && <p role="status">正在读取需求…</p>}
              {result.data && !result.data.items.length && (
                <p className="ui-empty">当前筛选暂无需求</p>
              )}
            </div>
            <div className="ui-pagination">
              <Button disabled={page === 1 || result.loading} onClick={() => setPage((v) => v - 1)}>
                上一页
              </Button>
              <span>第 {page} 页</span>
              <Button
                disabled={!result.data?.hasMore || result.loading}
                onClick={() => setPage((v) => v + 1)}
              >
                下一页
              </Button>
            </div>
          </>
        ) : (
          <Table
            border={false}
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
                  <Tag color={r.status === 'PENDING_CONTACT' ? 'green' : 'gray'}>
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
                  <Tag color={r.datasetMode === 'SYNTHETIC_TEST_ONLY' ? 'gray' : 'green'}>
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
        )}
      </section>
      <RequestDetail id={selected} onClose={() => setSelected(null)} onChanged={result.reload} />
    </>
  );
}
