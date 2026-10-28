import { useRenderMark } from '../useRenderMark';
import '@arco-design/web-react/es/InputNumber/style/css.js';
import '@arco-design/web-react/es/Collapse/style/css.js';
import '@arco-design/web-react/es/Table/style/css.js';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Collapse,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
} from '@arco-design/web-react';
import { IconRefresh, IconDelete, IconArrowRight } from '@arco-design/web-react/icon';
import { z } from 'zod';
import { client, describe } from '../api/client';
import {
  calendarSchema,
  p1,
  serviceSchema,
  visitLabels,
  type ServiceInstitution,
} from '../api/schema';
import { useDirty, useMutation } from '../state';
import { time, today, toUtc } from '../time';
import RequestDetail from '../components/RequestDetail';
import { confirmAction, Field } from '../components/shared';
import styles from './Visits.module.css';

type Calendar = z.infer<typeof calendarSchema>;
type DateRange = { from: string; to: string };
type BlockInput = { staffId: string; start: string; end: string };
type BlockBody = { action: 'BLOCK'; blockId: string; staffId: string; start: string; end: string };
type CapacityInput = { institutionId: string; capacity: number };
const savedSchema = p1.extend({ saved: z.literal(true) });
const beijingLocal = (value: string) =>
  new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16);

function BlockForm({ onSaved }: { onSaved: () => void }) {
  const mutation = useMutation('visits/resource/block', savedSchema);
  const retained = mutation.pending?.body as BlockBody | undefined;
  const [form] = Form.useForm<BlockInput>();
  const [dirty, setDirty] = useState(false),
    [feedback, setFeedback] = useState('');
  useDirty('visits/resource/block-input', dirty);
  async function submit(values: BlockInput) {
    if (mutation.busy) return;
    if (!retained && (!values.start || !values.end || values.start >= values.end)) {
      mutation.setError('请核对开始与结束时间。');
      return;
    }
    const body = retained || {
      action: 'BLOCK',
      blockId: crypto.randomUUID(),
      staffId: values.staffId.trim(),
      start: toUtc(values.start),
      end: toUtc(values.end),
    };
    try {
      const result = await mutation.run('/resources', body);
      if (result?.saved) {
        form.resetFields();
        setDirty(false);
        setFeedback('不可用时段已由服务器保存。');
        onSaved();
      }
    } catch {
      setFeedback('操作未完成，请核对错误。结果未知时保留原编号与原内容。');
    }
  }
  return (
    <section aria-labelledby="staff-block-title">
      <h3 id="staff-block-title">负责人不可用</h3>
      <p className={styles.description}>
        登记请假、其他工作等不可用时段。服务器会检查已确认行程与交通缓冲冲突。
      </p>
      <Form
        form={form}
        layout="vertical"
        disabled={mutation.busy || !!mutation.pending}
        initialValues={
          retained
            ? {
                staffId: retained.staffId,
                start: beijingLocal(retained.start),
                end: beijingLocal(retained.end),
              }
            : { staffId: '' }
        }
        onValuesChange={() => {
          setDirty(true);
          setFeedback('');
        }}
        onSubmit={submit}
      >
        <div className="filter-grid">
          <Field name="staffId" label="负责人标识" required>
            <Input aria-label="不可用负责人标识" maxLength={80} />
          </Field>
          <Field name="start" label="开始（北京时间）" required>
            <Input type="datetime-local" aria-label="不可用开始时间" />
          </Field>
          <Field name="end" label="结束（北京时间）" required>
            <Input type="datetime-local" aria-label="不可用结束时间" />
          </Field>
        </div>
        <Button type="primary" htmlType="submit" loading={mutation.busy}>
          {mutation.pending ? '使用原内容重试登记' : '登记不可用时段'}
        </Button>
      </Form>
      {mutation.pending && !mutation.busy && (
        <Alert
          type="warning"
          content="上次写入结果尚未确认。输入已锁定，重试沿用原 blockId 和完整内容；不会自动重复发送。"
        />
      )}
      {mutation.error && <Alert type="error" content={mutation.error} />}
      <p role="status" className={styles.feedback}>
        {feedback}
      </p>
    </section>
  );
}
function CapacityForm({
  institutions,
  onSaved,
}: {
  institutions: ServiceInstitution[];
  onSaved: () => void;
}) {
  const mutation = useMutation('visits/resource/capacity', savedSchema);
  const retained = mutation.pending?.body as (CapacityInput & { action: 'CAPACITY' }) | undefined;
  const [form] = Form.useForm<CapacityInput>();
  const [dirty, setDirty] = useState(false),
    [feedback, setFeedback] = useState('');
  const enabled = institutions.filter((row) => row.enabled);
  useDirty('visits/resource/capacity-input', dirty);
  async function submit(values: CapacityInput) {
    if (mutation.busy) return;
    if (
      !retained &&
      (!Number.isInteger(values.capacity) || values.capacity < 0 || values.capacity > 100)
    ) {
      mutation.setError('同时接待组数须为0至100的整数。');
      return;
    }
    if (
      !retained &&
      !(await confirmAction(
        '保存机构接待容量？',
        '仅在机构明确限定时配置；0 表示删除手工限制。存在未来确认行程时，请先处理行程。',
      ))
    )
      return;
    try {
      const result = await mutation.run(
        '/resources',
        retained || {
          action: 'CAPACITY',
          institutionId: values.institutionId,
          capacity: values.capacity,
        },
      );
      if (result?.saved) {
        setDirty(false);
        setFeedback('容量设置已由服务器保存。');
        onSaved();
      }
    } catch {
      setFeedback('容量设置未完成。原行程和本次输入已保留。');
    }
  }
  return (
    <section aria-labelledby="institution-capacity-title">
      <h3 id="institution-capacity-title">机构接待容量</h3>
      <p className={styles.description}>
        手工配置同时接待的组数，不代表机构真实护理能力。未配置时不额外限制组数；负责人和本人冲突仍须检查。
      </p>
      <Form
        form={form}
        layout="vertical"
        disabled={mutation.busy || !!mutation.pending}
        initialValues={retained || { capacity: 0 }}
        onValuesChange={() => {
          setDirty(true);
          setFeedback('');
        }}
        onSubmit={submit}
      >
        <div className="filter-grid">
          <Field name="institutionId" label="配置机构" required>
            <Select
              aria-label="容量配置机构"
              placeholder="选择启用的服务机构"
              options={[
                ...enabled.map((row) => ({ value: row.institutionId, label: row.institutionName })),
                ...(retained && !enabled.some((row) => row.institutionId === retained.institutionId)
                  ? [
                      {
                        value: retained.institutionId,
                        label: retained.institutionId + '（保留的原操作）',
                      },
                    ]
                  : []),
              ]}
            />
          </Field>
          <Field name="capacity" label="同时接待组数（0 = 不限制）" required>
            <InputNumber aria-label="同时接待组数" min={0} max={100} precision={0} />
          </Field>
        </div>
        <Button htmlType="submit" loading={mutation.busy}>
          {mutation.pending ? '使用原内容重试设置' : '保存容量设置'}
        </Button>
      </Form>
      {mutation.pending && !mutation.busy && (
        <Alert
          type="warning"
          content="容量设置结果尚未确认。请先查询实际容量，或手工重试保留的同一目标值。"
        />
      )}
      {mutation.error && <Alert type="error" content={mutation.error} />}
      <p role="status" className={styles.feedback}>
        {feedback}
      </p>
    </section>
  );
}

export default function Visits() {
  const [form] = Form.useForm<DateRange>();
  const [calendar, setCalendar] = useState<Calendar | null>(null),
    [range, setRange] = useState<DateRange | null>(null),
    [status, setStatus] = useState('');
  const [institutions, setInstitutions] = useState<ServiceInstitution[]>([]),
    [serviceError, setServiceError] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [requestId, setRequestId] = useState<string | null>(null),
    [feedback, setFeedback] = useState('');
  const generation = useRef(0),
    mounted = useRef(true);
  const removeMutation = useMutation('visits/resource/remove', savedSchema);
  const pendingRemove = removeMutation.pending?.body as
    | { action: 'REMOVE_BLOCK'; blockId: string }
    | undefined;

  async function query(values: DateRange) {
    if (!values.from || !values.to || values.from > values.to) {
      setError('请选择有效日期范围，结束日不能早于开始日。');
      return;
    }
    const current = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const result = await client.request(
        '/calendar?' + new URLSearchParams(values),
        calendarSchema,
      );
      if (mounted.current && current === generation.current) {
        setCalendar(result);
        setRange(values);
      }
    } catch (cause) {
      if (mounted.current && current === generation.current) {
        setCalendar(null);
        setError(describe(cause));
      }
    } finally {
      if (mounted.current && current === generation.current) setBusy(false);
    }
  }
  useRenderMark('admin-visits-ready', !!calendar);
  const refresh = () => {
    const values = form.getFieldsValue() as DateRange;
    void query(values);
  };
  async function loadInstitutions() {
    setServiceError('');
    try {
      const result = await client.request('/service-institutions', serviceSchema);
      if (mounted.current) setInstitutions(result.serviceInstitutions);
    } catch (cause) {
      if (mounted.current) setServiceError(describe(cause));
    }
  }
  useEffect(() => {
    mounted.current = true;
    void query({ from: today(), to: today() });
    void loadInstitutions();
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  function invalidateRange() {
    generation.current++;
    setCalendar(null);
    setRange(null);
    setBusy(false);
    setError('');
  }
  async function removeBlock(blockId?: string) {
    if (removeMutation.busy || (!blockId && !pendingRemove)) return;
    if (
      !pendingRemove &&
      !(await confirmAction(
        '移除这段不可用时间？',
        '移除后该负责人可被安排在这一时段；实际排期仍须通过服务器冲突检查。',
      ))
    )
      return;
    try {
      const result = await removeMutation.run(
        '/resources',
        pendingRemove || { action: 'REMOVE_BLOCK', blockId },
      );
      if (result?.saved) {
        setFeedback('服务器已移除该不可用时段。');
        refresh();
      }
    } catch {
      setFeedback('移除结果未完成，请核对错误或使用原内容重试。');
    }
  }
  const visible = calendar?.visits.filter((visit) => !status || visit.status === status) || [];
  return (
    <div className={styles.page}>
      <div className="page-heading">
        <div>
          <p className={styles.eyebrow}>行程 / 双方确认 / 资源</p>
          <h1>带看日程</h1>
          <p className={styles.description}>按真实确认安排带看，保留每一次改期与到访记录。</p>
        </div>
        <Tag color="gray" bordered>
          北京时间
        </Tag>
      </div>
      <section className="panel" aria-labelledby="visit-filter-title">
        <h2 id="visit-filter-title">查询带看安排</h2>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ from: today(), to: today() }}
          onValuesChange={invalidateRange}
          onSubmit={query}
        >
          <div className="filter-grid">
            <Field name="from" label="起始日" required>
              <Input type="date" aria-label="日程起始日" />
            </Field>
            <Field name="to" label="结束日（含当天）" required>
              <Input type="date" aria-label="日程结束日" />
            </Field>
            <Form.Item label="当前日期范围内状态">
              <Select
                aria-label="日程状态筛选"
                value={status}
                onChange={setStatus}
                options={[
                  { value: '', label: '全部状态' },
                  ...Object.entries(visitLabels).map(([value, label]) => ({ value, label })),
                ]}
              />
            </Form.Item>
          </div>
          <Button htmlType="submit" type="primary" icon={<IconRefresh />} loading={busy}>
            查询日程
          </Button>
        </Form>
        <p className={styles.description}>
          仅已确认行程占用资源。交通与准备缓冲由顾问填写，未使用路线测算；同一认证账号的需求共享冲突保护。
        </p>
        {error && <Alert type="error" content={error} />}
        {range && (
          <p className={styles.range}>
            {range.from} 至 {range.to} · 当前范围共 {calendar?.visits.length || 0} 场，状态筛选后{' '}
            {visible.length} 场
          </p>
        )}
        <Table
          rowKey="id"
          pagination={{ pageSize: 20, sizeCanChange: false, showTotal: true }}
          data={visible}
          loading={busy}
          noDataElement={
            error
              ? '读取失败，不能判断是否有安排。'
              : range
                ? '该日期与状态范围内没有带看安排。'
                : '选择日期后查询日程。'
          }
          scroll={{ x: 1040 }}
          columns={[
            {
              title: '带看时间（北京时间）',
              width: 220,
              render: (_, row) => (
                <div className={styles.timeCell}>
                  <strong>{time(row.start)}</strong>
                  <span>至 {time(row.end)}</span>
                </div>
              ),
            },
            {
              title: '机构 / 负责人',
              width: 230,
              render: (_, row) => (
                <div className={styles.timeCell}>
                  <strong>{row.institutionName}</strong>
                  <span>{row.staffId}</span>
                </div>
              ),
            },
            {
              title: '状态',
              width: 130,
              render: (_, row) => (
                <Tag
                  color={
                    row.status === 'CONFIRMED'
                      ? 'orange'
                      : row.status === 'ARRIVED'
                        ? 'green'
                        : 'gray'
                  }
                >
                  {visitLabels[row.status]}
                </Tag>
              ),
            },
            {
              title: '准备 / 交通缓冲',
              width: 160,
              render: (_, row) => `${row.bufferBefore} / ${row.bufferAfter} 分钟`,
            },
            { title: '集合说明', dataIndex: 'meetingNote', width: 200 },
            {
              title: '操作',
              width: 130,
              render: (_, row) => (
                <Button
                  type="text"
                  icon={<IconArrowRight />}
                  onClick={() => setRequestId(row.requestId)}
                >
                  查看及处理
                </Button>
              ),
            },
          ]}
        />
      </section>
      <section className="panel" aria-labelledby="resource-current-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="resource-current-title">当前资源配置</h2>
            <p className={styles.description}>
              不可用时段按上方日期范围展示；容量是本环境的全部手工配置。
            </p>
          </div>
        </div>
        {calendar ? (
          <>
            <div className={styles.capacities}>
              {calendar.capacities.length ? (
                calendar.capacities.map((item, index) => (
                  <Tag key={index} bordered>
                    {item.institutionName} · 同时 {item.capacity} 组
                  </Tag>
                ))
              ) : (
                <p className={styles.description}>
                  未配置机构组数限制。负责人和本人冲突检查持续生效。
                </p>
              )}
            </div>
            <Table
              rowKey="id"
              pagination={false}
              data={calendar.blocks}
              noDataElement="该日期范围未登记负责人不可用时段"
              scroll={{ x: 720 }}
              columns={[
                { title: '负责人', dataIndex: 'staffId', width: 160 },
                {
                  title: '不可用时间（北京时间）',
                  width: 360,
                  render: (_, row) => `${time(row.start)} 至 ${time(row.end)}`,
                },
                {
                  title: '操作',
                  width: 160,
                  render: (_, row) => (
                    <Button
                      status="danger"
                      type="text"
                      icon={<IconDelete />}
                      disabled={removeMutation.busy || !!removeMutation.pending}
                      onClick={() => void removeBlock(row.id)}
                    >
                      移除不可用时段
                    </Button>
                  ),
                },
              ]}
            />
          </>
        ) : (
          <p className={styles.description}>查询成功后显示实际配置。</p>
        )}
        {pendingRemove && !removeMutation.busy && (
          <Alert
            type="warning"
            content={
              <Space wrap>
                <span>上次移除的结果尚未确认，保留原时段编号。</span>
                <Button onClick={() => void removeBlock()}>使用原内容重试移除</Button>
              </Space>
            }
          />
        )}
        {removeMutation.error && <Alert type="error" content={removeMutation.error} />}
        <p role="status" className={styles.feedback}>
          {feedback}
        </p>
      </section>
      <section className="panel">
        <Collapse bordered={false}>
          <Collapse.Item name="resources" header="维护负责人不可用与机构接待容量">
            <div className={styles.resourceGrid}>
              <BlockForm onSaved={refresh} />
              <CapacityForm institutions={institutions} onSaved={refresh} />
            </div>
            {serviceError && (
              <Alert
                type="warning"
                content={
                  <Space wrap>
                    <span>机构名单读取失败：{serviceError}</span>
                    <Button size="small" onClick={() => void loadInstitutions()}>
                      重新读取名单
                    </Button>
                  </Space>
                }
              />
            )}
          </Collapse.Item>
        </Collapse>
      </section>
      <RequestDetail id={requestId} onClose={() => setRequestId(null)} onChanged={refresh} />
    </div>
  );
}
