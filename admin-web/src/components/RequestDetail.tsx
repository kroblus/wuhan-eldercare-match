import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  useMobile,
  Button,
  Checkbox,
  Collapse,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Spin,
  Tag,
  Timeline,
} from '../ui';
import { client, describe } from '../api/client';
import {
  detailSchema,
  serviceSchema,
  kindLabels,
  statusLabels,
  visitLabels,
  followupLabels,
  type Detail,
  type Visit,
  type ServiceInstitution,
} from '../api/schema';
import { useRead } from '../useRead';
import { useDirty, useMutation, useWork } from '../state';
import { Field, options, ErrorNotice, confirmAction } from './shared';
import { time, toUtc, beijingInput } from '../time';
import styles from './RequestDetail.module.css';
type FollowupValues = {
  result: string;
  note?: string;
  nextContactAt?: string;
  nextAction?: string;
  feedbackSource?: string;
  institutionId?: string;
};
export function Followup({
  detail,
  onSaved,
}: {
  detail: Detail;
  onSaved: (value: Detail) => void;
}) {
  const [form] = Form.useForm<FollowupValues>(),
    [dirty, setDirty] = useState(false);
  const item = detail.item,
    key = item.id + '/followup';
  useDirty(key, dirty);
  const mutation = useMutation(key, detailSchema, (r) => r.item.id === detail.item.id);
  const labels =
    item.status === 'CLOSED'
      ? Object.fromEntries(
          Object.entries(followupLabels).filter(([k]) =>
            ['MOVED_IN', 'NOT_MOVED_IN', 'UNKNOWN_FEEDBACK'].includes(k),
          ),
        )
      : followupLabels;
  const linked = Array.from(
    new Map(
      [
        ...(item.institutionId
          ? [
              {
                institutionId: item.institutionId,
                institutionName: item.institutionName || item.institutionId,
              },
            ]
          : []),
        ...item.visits,
      ].map((v) => [v.institutionId, { value: v.institutionId, label: v.institutionName }]),
    ).values(),
  );
  async function save(v: FollowupValues) {
    if (
      !mutation.pending &&
      v.result === 'REFUSED' &&
      !(await confirmAction('确认结束联系？', '拒绝联系会结束这份需求，并取消尚未完成的带看安排。'))
    )
      return;
    try {
      const result = await mutation.run('/requests/' + item.id + '/followups', {
        operationId: crypto.randomUUID(),
        result: v.result,
        note: v.note?.trim() || null,
        nextContactAt: toUtc(v.nextContactAt),
        nextAction: v.nextAction?.trim() || null,
        feedbackSource: v.feedbackSource || null,
        institutionId: v.institutionId || null,
      });
      if (result) {
        form.resetFields();
        form.setFieldValue(
          'result',
          result.item.status === 'CLOSED' ? 'UNKNOWN_FEEDBACK' : 'CONNECTED',
        );
        setDirty(false);
        onSaved(result);
      }
    } catch {
      /* The mutation keeps the original payload and feedback. */
    }
  }
  return (
    <section
      className={styles.section}
      id="request-contact"
      aria-labelledby="request-contact-title"
    >
      <p className={styles.eyebrow}>联系跟进</p>
      <h3 id="request-contact-title">记录联系与后续反馈</h3>
      <Form
        id={key}
        form={form}
        layout="vertical"
        initialValues={{ result: item.status === 'CLOSED' ? 'UNKNOWN_FEEDBACK' : 'CONNECTED' }}
        onValuesChange={() => setDirty(true)}
        onSubmit={save}
        disabled={mutation.busy || !!mutation.pending}
      >
        <div className="form-two">
          <Field name="result" label="本次结果" required>
            <Select options={options(labels)} />
          </Field>
          <Field name="nextContactAt" label="下次联系（北京时间）">
            <Input type="datetime-local" />
          </Field>
        </div>
        <Field name="note" label="内部备注">
          <Input.TextArea maxLength={500} showWordLimit autoSize={{ minRows: 3, maxRows: 5 }} />
        </Field>
        <Field name="nextAction" label="下一动作（有下次时间时必填）">
          <Input maxLength={200} />
        </Field>
        <div className="form-two">
          <Field name="feedbackSource" label="入住反馈来源">
            <Select
              allowClear
              options={options({
                FAMILY: '家属明确反馈',
                INSTITUTION: '机构明确反馈',
                CONSULTANT: '顾问明确核实',
              })}
            />
          </Field>
          <Field name="institutionId" label="反馈关联机构">
            <Select allowClear options={linked} />
          </Field>
        </div>
        <p className="muted">
          入住反馈必须有来源且关联本需求或已安排机构。拒绝联系会结束待办；不涉及签约、收费或结算。
        </p>
        <ErrorNotice message={mutation.error} />
        {mutation.pending && (
          <Alert
            type="warning"
            content="结果尚未确认，输入已锁定。可以查询服务器记录，或使用原内容和编号重试。"
          />
        )}
        <div className={styles.formActions}>
          <Button
            type="primary"
            loading={mutation.busy}
            disabled={mutation.busy}
            onClick={() =>
              mutation.pending ? void save(form.getFieldsValue() as FollowupValues) : form.submit()
            }
          >
            {mutation.pending ? '使用原操作重试联系' : '保存联系记录'}
          </Button>
        </div>
      </Form>
    </section>
  );
}
type VisitValues = {
  institutionId: string;
  staffId: string;
  start: string;
  end: string;
  bufferBefore: number;
  bufferAfter: number;
  meetingNote: string;
  familyConfirmed: boolean;
  institutionConfirmed: boolean;
  action: string;
};
export function VisitEditor({
  detail,
  visit,
  services,
  onSaved,
}: {
  detail: Detail;
  visit?: Visit;
  services: ServiceInstitution[];
  onSaved: (value: Detail) => void;
}) {
  const [form] = Form.useForm<VisitValues>(),
    [dirty, setDirty] = useState(false);
  const key = detail.item.id + '/' + (visit?.id || 'new') + '/visit';
  useDirty(key, dirty);
  const mutation = useMutation(key, detailSchema, (r) => r.item.id === detail.item.id);
  const choices = services
    .filter((r) => r.enabled || r.institutionId === visit?.institutionId)
    .map((r) => ({
      value: r.institutionId,
      label: r.institutionName + (r.enabled ? '' : '（已停用）'),
    }));
  if (visit && !choices.some((v) => v.value === visit.institutionId))
    choices.push({ value: visit.institutionId, label: visit.institutionName + '（历史机构）' });
  async function save(v: VisitValues) {
    const action = visit?.status === 'CONFIRMED' ? 'RESCHEDULE' : v.action;
    if (
      !mutation.pending &&
      ['CONFIRM', 'RESCHEDULE'].includes(action) &&
      !(await confirmAction(
        action === 'RESCHEDULE' ? '确认调整这场带看？' : '确认安排这场带看？',
        '已取得家属与机构确认后提交；服务器将检查人员、家庭、容量与交通缓冲冲突。',
      ))
    )
      return;
    try {
      const result = await mutation.run('/requests/' + detail.item.id + '/visits', {
        operationId: crypto.randomUUID(),
        visitId: visit?.id || crypto.randomUUID(),
        expectedRevision: visit?.revision || 0,
        action,
        institutionId: v.institutionId,
        staffId: v.staffId.trim(),
        start: toUtc(v.start),
        end: toUtc(v.end),
        bufferBefore: v.bufferBefore || 0,
        bufferAfter: v.bufferAfter || 0,
        familyConfirmed: !!v.familyConfirmed,
        institutionConfirmed: !!v.institutionConfirmed,
        meetingNote: v.meetingNote.trim(),
      });
      if (result) {
        if (!visit) form.resetFields();
        setDirty(false);
        onSaved(result);
      }
    } catch {
      /* Keep editable inputs on a definite rejection. */
    }
  }
  return (
    <Form
      id={key}
      form={form}
      layout="vertical"
      initialValues={{
        institutionId: visit?.institutionId || detail.item.institutionId || undefined,
        staffId: visit?.staffId || '',
        start: beijingInput(visit?.start),
        end: beijingInput(visit?.end),
        bufferBefore: visit?.bufferBefore || 0,
        bufferAfter: visit?.bufferAfter || 0,
        meetingNote: visit?.meetingNote || '',
        familyConfirmed: visit?.familyConfirmed || false,
        institutionConfirmed: visit?.institutionConfirmed || false,
        action: 'SAVE_DRAFT',
      }}
      onValuesChange={() => setDirty(true)}
      onSubmit={save}
      disabled={mutation.busy || !!mutation.pending}
    >
      <div className="form-two">
        <Field name="institutionId" label="带看机构" required>
          <Select options={choices} />
        </Field>
        <Field name="staffId" label="负责人标识" required>
          <Input maxLength={80} />
        </Field>
        <Field name="start" label="开始（北京时间）" required>
          <Input type="datetime-local" />
        </Field>
        <Field name="end" label="结束（北京时间）" required>
          <Input type="datetime-local" />
        </Field>
        <Field name="bufferBefore" label="提前准备缓冲 / 分钟">
          <InputNumber min={0} max={240} precision={0} />
        </Field>
        <Field name="bufferAfter" label="结束后交通缓冲 / 分钟">
          <InputNumber min={0} max={240} precision={0} />
        </Field>
      </div>
      <Field name="meetingNote" label="集合与出行说明（用户可见）" required>
        <Input.TextArea maxLength={300} autoSize={{ minRows: 2, maxRows: 4 }} />
      </Field>
      <Form.Item field="familyConfirmed" triggerPropName="checked">
        <Checkbox>已取得家属确认</Checkbox>
      </Form.Item>
      <Form.Item field="institutionConfirmed" triggerPropName="checked">
        <Checkbox>已取得机构确认</Checkbox>
      </Form.Item>
      {visit?.status !== 'CONFIRMED' && (
        <Field name="action" label="保存方式" required>
          <Select
            options={options({
              SAVE_DRAFT: '仅保存待确认，不占用时段',
              CONFIRM: '双方确认，检查冲突后排期',
            })}
          />
        </Field>
      )}
      <p className="muted">缓冲由负责人手动填写，未测算路线。失败保留原安排，不自动发送消息。</p>
      <ErrorNotice message={mutation.error} />
      {mutation.pending && (
        <Alert type="warning" content="写入结果尚未确认，原编号和内容已保留。" />
      )}
      <div className={styles.formActions}>
        <Button
          type="primary"
          disabled={mutation.busy}
          loading={mutation.busy}
          onClick={() =>
            mutation.pending ? void save(form.getFieldsValue() as VisitValues) : form.submit()
          }
        >
          {mutation.pending
            ? '使用原操作重试安排'
            : visit?.status === 'CONFIRMED'
              ? '确认改期'
              : '保存带看安排'}
        </Button>
      </div>
    </Form>
  );
}
function Outcome({
  detail,
  visit,
  onSaved,
}: {
  detail: Detail;
  visit: Visit;
  onSaved: (value: Detail) => void;
}) {
  const [form] = Form.useForm<{ action: string; actualAt: string }>(),
    [dirty, setDirty] = useState(false);
  const key = detail.item.id + '/' + visit.id + '/outcome';
  useDirty(key, dirty);
  const mutation = useMutation(key, detailSchema, (r) => r.item.id === detail.item.id);
  async function save(v: { action: string; actualAt: string }) {
    if (
      !mutation.pending &&
      !(await confirmAction(
        '确认记录这场结果？',
        '取消、到访和未到访都将结束这场安排，请按实际发生的情况记录。',
      ))
    )
      return;
    try {
      const response = await mutation.run('/requests/' + detail.item.id + '/visits', {
        operationId: crypto.randomUUID(),
        visitId: visit.id,
        expectedRevision: visit.revision,
        action: v.action,
        ...(v.action === 'CANCEL' ? {} : { actualAt: toUtc(v.actualAt) }),
      });
      if (response) {
        setDirty(false);
        onSaved(response);
      }
    } catch {}
  }
  return (
    <Form
      id={key}
      layout="vertical"
      form={form}
      initialValues={{ action: 'CANCEL', actualAt: beijingInput(new Date().toISOString()) }}
      onValuesChange={() => setDirty(true)}
      onSubmit={save}
      disabled={mutation.busy || !!mutation.pending}
    >
      <div className="form-two">
        <Field name="action" label="本场结果">
          <Select
            options={options(
              visit.status === 'CONFIRMED'
                ? { CANCEL: '取消这场', ARRIVE: '记录已到访', NO_SHOW: '记录未到访' }
                : { CANCEL: '取消这场' },
            )}
          />
        </Field>
        <Field name="actualAt" label="实际时间（北京，到访时必填）">
          <Input type="datetime-local" />
        </Field>
      </div>
      <ErrorNotice message={mutation.error} />
      <div className={styles.formActions}>
        <Button
          status="warning"
          loading={mutation.busy}
          disabled={mutation.busy}
          onClick={() =>
            mutation.pending
              ? void save(form.getFieldsValue() as { action: string; actualAt: string })
              : form.submit()
          }
        >
          {mutation.pending ? '使用原操作重试结果' : '提交本场结果'}
        </Button>
      </div>
    </Form>
  );
}
const eventLabels: Record<string, string> = {
  REQUEST_SUBMITTED: '提交需求',
  REQUEST_CANCELLED: '取消需求',
  FOLLOWUP: '联系与反馈',
  VISIT_SAVE_DRAFT: '保存待确认安排',
  VISIT_CONFIRM: '双方确认带看',
  VISIT_RESCHEDULE: '带看改期',
  VISIT_CANCEL: '取消本场',
  VISIT_ARRIVE: '记录到访',
  VISIT_NO_SHOW: '记录未到访',
};
export default function RequestDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const mobile = useMobile();
  const [data, setData] = useState<Detail>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [recovered, setRecovered] = useState<Record<string, string>>({});
  const generation = useRef(0),
    work = useWork();
  const services = useRead(id ? '/service-institutions' : null, serviceSchema);
  async function load(target: string) {
    const n = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await client.request('/requests/' + encodeURIComponent(target), detailSchema);
      if (n !== generation.current) return;
      if (result.item.id !== target) throw Error('详情关联不正确。');
      const recorded = new Set(result.events.map((e) => e.operationId));
      const acknowledged: Record<string, string> = {};
      for (const [key, pending] of work.pending)
        if (
          key.startsWith(target + '/') &&
          pending.body &&
          typeof pending.body === 'object' &&
          'operationId' in pending.body &&
          recorded.has(String(pending.body.operationId))
        ) {
          acknowledged[key] = String(pending.body.operationId);
          work.setPending(key, null);
        }
      if (Object.keys(acknowledged).length) setRecovered((old) => ({ ...old, ...acknowledged }));
      setData(result);
      setMessage(
        Object.keys(acknowledged).length
          ? '已核对原操作已保存；对应表单已更新，其他未保存输入保留。'
          : '已读取服务器最新记录；未保存的表单输入继续保留。',
      );
    } catch (e) {
      if (n === generation.current) setError(describe(e));
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    setData(undefined);
    setMessage('');
    setRecovered({});
    if (id) void load(id);
    return () => {
      generation.current++;
    };
  }, [id]);
  async function close() {
    if ([...work.pending.keys()].some((k) => k.startsWith(id + '/'))) {
      setError('写入结果尚未确认，请先查询服务器状态或使用原操作重试。');
      return;
    }
    if (
      [...work.dirty.keys()].some((k) => k.startsWith(id + '/')) &&
      !(await confirmAction('关闭详情并放弃输入？', '尚未保存的联系或带看输入将被清除。'))
    )
      return;
    onClose();
  }
  const saved = (value: Detail) => {
    generation.current++;
    setLoading(false);
    if (value.item.id !== id) {
      setError('保存响应关联不正确，请重新查询。');
      return;
    }
    setData(value);
    setMessage('服务器已保存记录。');
    onChanged?.();
  };
  return (
    <Drawer
      title="需求详情"
      visible={!!id}
      width={mobile ? '100vw' : 'min(820px,100vw)'}
      className={styles.drawer}
      footer={
        mobile && data ? (
          <nav className={styles.mobileActions} aria-label="需求处理快捷操作">
            {data.item.status !== 'CANCELLED' && (
              <Button
                type="primary"
                onClick={() =>
                  document.getElementById('request-contact')?.scrollIntoView({ block: 'start' })
                }
              >
                联系与反馈
              </Button>
            )}
            <Button
              onClick={() =>
                document.getElementById('request-visits')?.scrollIntoView({ block: 'start' })
              }
            >
              查看带看行程
            </Button>
          </nav>
        ) : null
      }
      unmountOnExit
      onCancel={() => void close()}
    >
      <ErrorNotice message={error} />
      {id && (
        <Button loading={loading} onClick={() => void load(id)}>
          查询服务器最新记录
        </Button>
      )}
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
      {!data && loading ? (
        <Spin />
      ) : (
        data && (
          <div key={data.item.id} className={styles.content}>
            <nav className={styles.sectionNav} aria-label="需求详情分区">
              <a
                href="#request-info"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById('request-info')
                    ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }}
              >
                需求信息
              </a>
              {data.item.status !== 'CANCELLED' && (
                <a
                  href="#request-contact"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById('request-contact')
                      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  }}
                >
                  联系跟进
                </a>
              )}
              <a
                href="#request-visits"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById('request-visits')
                    ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }}
              >
                带看行程
              </a>
              <a
                href="#request-events"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById('request-events')
                    ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }}
              >
                事件记录
              </a>
            </nav>
            <section className={styles.section} id="request-info" aria-label="需求信息">
              {data.item.datasetMode === 'SYNTHETIC_TEST_ONLY' && (
                <Alert
                  type="warning"
                  content="合成测试资料 · 不是朋友的真实待办，不拨号、不通知机构。"
                />
              )}
              <h2>
                {kindLabels[data.item.kind]}{' '}
                <Tag color="green">{statusLabels[data.item.status]}</Tag>
              </h2>
              <Descriptions
                column={1}
                labelStyle={{ width: mobile ? undefined : '10rem' }}
                data={[
                  { label: '意向机构', value: data.item.institutionName || '请顾问协助推荐' },
                  { label: '联系人', value: data.item.contactName || '未提供' },
                  { label: '手机（本次服务用）', value: data.item.contactPhone || '未提供' },
                  {
                    label: '关系',
                    value:
                      (
                        { SELF: '本人', FAMILY: '家属', OTHER: '其他合法受托人' } as Record<
                          string,
                          string
                        >
                      )[data.item.relationship || ''] || '未提供',
                  },
                  {
                    label: '服务场景',
                    value:
                      (
                        {
                          LONG_TERM: '长期养老',
                          SHORT_STAY: '短期托养',
                          POST_OPERATION: '术后阶段',
                          UNDECIDED: '尚未确定',
                        } as Record<string, string>
                      )[data.item.serviceScenario || ''] || '未提供',
                  },
                  { label: '意向窗口（未确认）', value: data.item.preferredWindow || '待协商' },
                  { label: '参加人数', value: data.item.partySize },
                  { label: '协助说明', value: data.item.assistanceNote || '未填写' },
                  {
                    label: '需求来源',
                    value:
                      (
                        {
                          MINIPROGRAM: '小程序主动申请',
                          SYNTHETIC_TEST_ONLY: '合成测试',
                          OFFLINE_MANUAL: '线下人工来源',
                          SELF_TEST: '员工自测',
                        } as Record<string, string>
                      )[data.item.source || ''] || '来源待核对',
                  },
                  { label: '创建时间', value: time(data.item.createdAt) },
                  { label: '告知版本', value: data.item.consentVersion },
                ]}
              />
              {data.nextContact?.nextContactAt &&
                !['CLOSED', 'CANCELLED'].includes(data.item.status) && (
                  <Alert
                    content={
                      '下一动作：' +
                      data.nextContact.nextAction +
                      ' · ' +
                      time(data.nextContact.nextContactAt)
                    }
                  />
                )}
            </section>
            {data.item.status !== 'CANCELLED' && (
              <Followup
                key={recovered[data.item.id + '/followup'] || 'followup'}
                detail={data}
                onSaved={saved}
              />
            )}
            <section
              className={styles.section}
              id="request-visits"
              aria-labelledby="request-visits-title"
            >
              <p className={styles.eyebrow}>带看行程</p>
              <h3 id="request-visits-title">逐场带看安排</h3>
              <ErrorNotice message={services.error} retry={services.reload} />
              {!data.item.visits.length && (
                <p className="muted">尚无安排。带看意向不会自动占用时段。</p>
              )}
              {data.item.visits.map((v) => (
                <section className={styles.visitCard} key={v.id}>
                  <h3>
                    {v.institutionName} <Tag>{visitLabels[v.status]}</Tag>
                  </h3>
                  <p>
                    {time(v.start)} 至 {time(v.end)} · 北京时间
                  </p>
                  <p className="muted">
                    负责人 {v.staffId} · 前缓冲 {v.bufferBefore} 分钟 / 后缓冲 {v.bufferAfter} 分钟
                  </p>
                  <p>{v.meetingNote}</p>
                  {v.actualAt && <p>实际记录：{time(v.actualAt)}</p>}
                  {['DRAFT', 'CONFIRMED'].includes(v.status) &&
                    !['CLOSED', 'CANCELLED'].includes(data.item.status) && (
                      <Collapse>
                        <Collapse.Item name="edit" header="修改 / 确认这场安排">
                          <VisitEditor
                            key={recovered[data.item.id + '/' + v.id + '/visit'] || 'visit'}
                            detail={data}
                            visit={v}
                            services={services.data?.serviceInstitutions || []}
                            onSaved={saved}
                          />
                        </Collapse.Item>
                        <Collapse.Item name="result" header="取消 / 到访结果">
                          <Outcome
                            key={recovered[data.item.id + '/' + v.id + '/outcome'] || 'outcome'}
                            detail={data}
                            visit={v}
                            onSaved={saved}
                          />
                        </Collapse.Item>
                      </Collapse>
                    )}
                </section>
              ))}
              {!['CLOSED', 'CANCELLED'].includes(data.item.status) && (
                <Collapse>
                  <Collapse.Item name="new" header="新增一场带看">
                    <VisitEditor
                      key={recovered[data.item.id + '/new/visit'] || 'new-visit'}
                      detail={data}
                      services={services.data?.serviceInstitutions || []}
                      onSaved={saved}
                    />
                  </Collapse.Item>
                </Collapse>
              )}
            </section>
            <section
              className={styles.section}
              id="request-events"
              aria-labelledby="request-events-title"
            >
              <p className={styles.eyebrow}>服务记录</p>
              <h3 id="request-events-title">真实事件时间线</h3>
              <Timeline>
                {data.events.map((event, i) => (
                  <Timeline.Item key={event.operationId || i} label={time(event.occurredAt)}>
                    <b>{eventLabels[event.type] || event.type}</b>
                    {event.details?.result && (
                      <p>
                        {followupLabels[event.details.result as keyof typeof followupLabels] ||
                          event.details.result}
                      </p>
                    )}
                    {event.details?.note && <p>{event.details.note}</p>}
                    {event.details?.nextAction && <p>下一动作：{event.details.nextAction}</p>}
                    {event.details?.nextContactAt && (
                      <p>下次联系：{time(event.details.nextContactAt)}（北京时间）</p>
                    )}
                    {event.details?.feedbackSource && (
                      <p>
                        反馈来源：
                        {(
                          {
                            FAMILY: '家属明确反馈',
                            INSTITUTION: '机构明确反馈',
                            CONSULTANT: '顾问明确核实',
                          } as Record<string, string>
                        )[event.details.feedbackSource] || '待核对'}
                      </p>
                    )}
                  </Timeline.Item>
                ))}
              </Timeline>
            </section>
          </div>
        )
      )}
    </Drawer>
  );
}
