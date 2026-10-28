import { useRenderMark } from '../useRenderMark';
import '@arco-design/web-react/es/Checkbox/style/css.js';
import '@arco-design/web-react/es/InputNumber/style/css.js';
import '@arco-design/web-react/es/Collapse/style/css.js';
import '@arco-design/web-react/es/Table/style/css.js';
import { useState, useRef } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
} from '@arco-design/web-react';
import { IconPlus, IconArrowLeft, IconRefresh, IconSearch } from '@arco-design/web-react/icon';
import { ApiError, client, describe } from '../api/client';
import {
  accessSchema,
  draftResponse,
  importSchema,
  institutionsSchema,
  profileSchema,
  publishSchema,
  recordSchema,
  templateSchema,
  type Draft,
  type Profile,
} from '../api/schema';
import { useRead } from '../useRead';
import { useDirty, useMutation, useWork } from '../state';
import { Field, ErrorNotice, options, confirmAction } from '../components/shared';
import styles from './Institutions.module.css';
const statusLabels = {
  NONE: '尚无草稿',
  DRAFT: '资料草稿',
  CONFIRMED: '已人工确认',
  PUBLISHED: '已发布',
};
export function signature(value: unknown): string {
  return value && typeof value === 'object'
    ? Array.isArray(value)
      ? '[' + value.map(signature).join(',') + ']'
      : '{' +
        Object.keys(value)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + signature((value as Record<string, unknown>)[k]))
          .join(',') +
        '}'
    : JSON.stringify(value);
}
export function sameContent(
  item: Draft,
  body: { record: unknown; publicProfile: unknown },
  published = false,
) {
  if (
    signature(item.record) === signature(body.record) &&
    signature(item.publicProfile) === signature(body.publicProfile)
  )
    return true;
  const record = structuredClone(body.record) as Record<string, unknown>;
  if (published && record) {
    record.recordRevision = item.publishedRecordRevision;
    record.recordStatus = 'published';
    if (Array.isArray(record.evidence))
      for (const evidence of record.evidence)
        if (evidence && typeof evidence === 'object')
          evidence.recordRevision = item.publishedRecordRevision;
  }
  return (
    signature(item.record) === signature(record) &&
    signature(item.publicProfile) === signature(body.publicProfile)
  );
}
type Values = {
  name: string;
  regionCode: string;
  regionDisplayName: string;
  hasProfile: boolean;
  source: string;
  room: string;
  address: string;
  nature: string;
  tags: string;
  tagNote: string;
  otherFees: string;
  priceNote: string;
  historyNote: string;
  recordJson: string;
};
type Price = { level: string; bed?: number; care?: number; food?: number; total?: number };
function valuesOf(item: Draft): Values {
  const p = item.publicProfile;
  return {
    name: p?.name || String(item.record?.identity.name?.value || ''),
    regionCode: String(item.record?.identity.regionCode?.value || ''),
    regionDisplayName: String(item.record?.identity.regionDisplayName?.value || ''),
    hasProfile: !!p,
    source: p?.source || '',
    room: p?.room || '',
    address: p?.address || '',
    nature: p?.nature || '',
    tags: p?.tags.join('\n') || '',
    tagNote: p?.tagNote || '',
    otherFees: p?.otherFees || '',
    priceNote: p?.priceNote || '',
    historyNote: p?.historyNote || '',
    recordJson: JSON.stringify(item.record, null, 2),
  };
}
export function buildCandidate(v: Values, prices: Price[], id: string) {
  const record = recordSchema.parse(JSON.parse(v.recordJson));
  if (record.institutionId !== id) throw Error('高级资料的机构 ID 必须与当前机构一致。');
  if (!v.name.trim()) throw Error('请填写机构名称。');
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(v.regionCode.trim()) || !v.regionDisplayName.trim())
    throw Error('请按实际资料填写地区代码和名称，未知时先核实。');
  const publicProfile = v.hasProfile
    ? profileSchema.parse({
        schemaVersion: 'institution-public-profile-v1',
        id,
        name: v.name.trim(),
        source: v.source.trim(),
        room: v.room.trim(),
        address: v.address.trim(),
        nature: v.nature.trim(),
        tags: v.tags
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        tagNote: v.tagNote.trim(),
        prices,
        otherFees: v.otherFees.trim(),
        priceNote: v.priceNote.trim(),
        historyNote: v.historyNote.trim(),
      })
    : null;
  return { record, publicProfile };
}
export function Editor({
  initial,
  onListChanged,
  onBack,
}: {
  initial: Draft;
  onListChanged: () => void;
  onBack: () => void;
}) {
  const [current, setCurrent] = useState(initial),
    [dirty, setDirty] = useState(initial.draftRevision === 0),
    [prices, setPrices] = useState<Price[]>(initial.publicProfile?.prices || []),
    [hasProfile, setHasProfile] = useState(!!initial.publicProfile),
    [conflict, setConflict] = useState(false),
    [latest, setLatest] = useState<Draft>(),
    [comparing, setComparing] = useState(false),
    [reading, setReading] = useState(false),
    [feedback, setFeedback] = useState(''),
    [error, setError] = useState(''),
    [confirmDirty, setConfirmDirty] = useState(false),
    [accessDirty, setAccessDirty] = useState(false);
  const basicSection = useRef<HTMLDetailsElement>(null);
  const [form] = Form.useForm<Values>(),
    [confirmForm] = Form.useForm<{
      sourceReference: string;
      confirmedBy: string;
      confirmedOn: string;
    }>(),
    [accessForm] = Form.useForm<{ enabled: boolean; sourceReference: string }>();
  const syncing = useRef(false);
  function writeDraft(values: Partial<Values>) {
    syncing.current = true;
    try {
      form.setFieldsValue(values);
    } finally {
      syncing.current = false;
    }
  }
  const id = current.institutionId,
    path = '/institutions/' + encodeURIComponent(id),
    key = 'institution:' + id;
  useDirty(key, dirty || confirmDirty || accessDirty);
  const save = useMutation(key + '/save', draftResponse, (r) => r.item.institutionId === id),
    confirm = useMutation(key + '/confirm', draftResponse, (r) => r.item.institutionId === id),
    publish = useMutation(
      key + '/publish',
      publishSchema,
      (r) => r.item.institutionId === id && r.publication.institutionId === id,
    ),
    access = useMutation(key + '/access', accessSchema, (r) => r.access.institutionId === id);
  const pending = save.pending || confirm.pending || publish.pending || access.pending,
    busy = save.busy || confirm.busy || publish.busy || access.busy || reading,
    locked = busy || !!pending;
  function changed(changes: Partial<Values>) {
    if (syncing.current) return;
    setDirty(true);
    setFeedback('资料已修改，发布已禁用；保存后需重新人工确认。');
    if ('hasProfile' in changes) setHasProfile(!!changes.hasProfile);
    if ('recordJson' in changes) {
      try {
        const record = recordSchema.parse(JSON.parse(changes.recordJson || ''));
        writeDraft({
          name: String(record.identity.name?.value || ''),
          regionCode: String(record.identity.regionCode?.value || ''),
          regionDisplayName: String(record.identity.regionDisplayName?.value || ''),
        });
      } catch {
        /* Retain incomplete JSON while editing. */
      }
      return;
    }
    for (const name of ['name', 'regionCode', 'regionDisplayName'] as const)
      if (name in changes) {
        try {
          const record = recordSchema.parse(JSON.parse(String(form.getFieldValue('recordJson')))),
            value = String(changes[name] || '').trim();
          if (record.identity[name]?.value !== value) {
            record.identity[name] = {
              availability: value ? 'provided' : 'unknown',
              value: value || null,
              verification: { status: 'unverified', evidenceIds: [] },
            };
            if (record.evidence)
              record.evidence = record.evidence.filter((e) => e.fieldPath !== 'identity.' + name);
            writeDraft({ recordJson: JSON.stringify(record, null, 2) });
          }
        } catch {
          /* Do not discard malformed advanced input. */
        }
      }
  }
  function accepted(next: Draft) {
    setCurrent(next);
    setDirty(false);
    setConflict(false);
    setLatest(undefined);
    writeDraft(valuesOf(next));
    setPrices(next.publicProfile?.prices || []);
    setHasProfile(!!next.publicProfile);
    onListChanged();
  }
  function failed(e: unknown) {
    if (e instanceof ApiError && e.status === 409) setConflict(true);
    setError(describe(e));
  }
  async function saveDraft() {
    setError('');
    try {
      const body =
        save.pending?.body || buildCandidate(form.getFieldsValue() as Values, prices, id);
      const response = await save.run(
        current.draftRevision === 0 ? '/institutions' : path + '/draft',
        save.pending?.body ||
          (current.draftRevision === 0
            ? { institutionId: id, ...(body as object) }
            : { expectedDraftRevision: current.draftRevision, ...(body as object) }),
        current.draftRevision === 0 ? 'POST' : 'PUT',
      );
      if (response) {
        accepted(response.item);
        confirmForm.setFieldsValue({ sourceReference: '', confirmedBy: '', confirmedOn: '' });
        setConfirmDirty(false);
        setFeedback('草稿已保存。请核对来源并完成人工确认。');
      }
    } catch (e) {
      failed(e);
    }
  }
  async function confirmDraft(v: {
    sourceReference: string;
    confirmedBy: string;
    confirmedOn: string;
  }) {
    setError('');
    try {
      const response = await confirm.run(path + '/confirm', {
        expectedDraftRevision: current.draftRevision,
        ...v,
      });
      if (response) {
        accepted(response.item);
        setConfirmDirty(false);
        setFeedback('本草稿已记录人工确认，可以发布。');
      }
    } catch (e) {
      failed(e);
    }
  }
  async function publishDraft() {
    if (
      !publish.pending &&
      !(await confirmAction(
        '发布已确认版本？',
        '发布生成新的不可变版本。旧推荐引用的历史版本会保留，服务接入不会自动改变。',
      ))
    )
      return;
    setError('');
    try {
      const response = await publish.run(path + '/publish', {
        operationId: crypto.randomUUID(),
        expectedDraftRevision: current.draftRevision,
      });
      if (response) {
        if (response.publication.institutionId !== id)
          throw Error('发布关联不正确，请查询服务器状态。');
        accepted(response.item);
        setFeedback(
          '服务器已确认发布第 ' +
            response.publication.recordRevision +
            ' 版。旧版本保留，服务接入独立管理。',
        );
      }
    } catch (e) {
      failed(e);
    }
  }
  async function saveAccess(v: { enabled: boolean; sourceReference: string }) {
    if (
      !access.pending &&
      !v.enabled &&
      current.serviceAccess.enabled &&
      !(await confirmAction(
        '停止接收本机构的新服务申请？',
        '旧需求、带看和历史报告继续保留。公开机构资料不会被删除。',
      ))
    )
      return;
    setError('');
    try {
      const response = await access.run(path + '/service-access', {
        operationId: crypto.randomUUID(),
        expectedAccessRevision: current.serviceAccess.accessRevision,
        enabled: !!v.enabled,
        sourceReference: v.sourceReference.trim(),
      });
      if (response) {
        if (response.access.institutionId !== id) throw Error('服务接入关联不正确。');
        setCurrent((old) => ({ ...old, serviceAccess: response.access }));
        setAccessDirty(false);
        onListChanged();
        setFeedback(
          response.access.enabled
            ? '已允许接收本机构的新咨询与带看意向。'
            : '已停止新服务申请，旧记录保留。',
        );
      }
    } catch (e) {
      failed(e);
    }
  }
  async function readLatest() {
    if (busy) return;
    setReading(true);
    setError('');
    try {
      const result = await client.request(path + '/draft', draftResponse);
      if (result.item.institutionId !== id) throw Error('草稿关联不正确。');
      const next = result.item;
      if (save.pending) {
        const body = save.pending.body as { record: unknown; publicProfile: unknown };
        if (!sameContent(next, body)) {
          setLatest(next);
          setComparing(true);
          setFeedback('服务器内容与原保存内容不同；原请求仍保留，请核对后使用原内容重试。');
          return;
        }
        save.clear();
        accepted(next);
        setFeedback('已核对服务器：原草稿保存成功。');
        return;
      }
      if (publish.pending) {
        if (
          next.status !== 'PUBLISHED' ||
          !sameContent(next, { record: current.record, publicProfile: current.publicProfile }, true)
        ) {
          setFeedback('尚未确认原发布完成。原编号和内容继续保留，可重试原发布。');
          return;
        }
        publish.clear();
        accepted(next);
        setFeedback('已核对服务器：原版本发布成功。');
        return;
      }
      if (confirm.pending) {
        const body = confirm.pending.body as {
          sourceReference: string;
          confirmedBy: string;
          confirmedOn: string;
          expectedDraftRevision: number;
        };
        if (
          !next.confirmation ||
          !['sourceReference', 'confirmedBy', 'confirmedOn'].every(
            (k) => next.confirmation?.[k] === body[k as keyof typeof body],
          ) ||
          next.draftRevision !== body.expectedDraftRevision + 1 ||
          !sameContent(next, { record: current.record, publicProfile: current.publicProfile })
        ) {
          setFeedback('尚未确认人工确认已保存，请继续使用原内容查询或重试。');
          return;
        }
        confirm.clear();
        setCurrent(next);
        setConfirmDirty(false);
        setFeedback('已核对服务器人工确认记录。');
        return;
      }
      if (access.pending) {
        const body = access.pending.body as { enabled: boolean; expectedAccessRevision: number };
        if (
          next.serviceAccess.enabled !== body.enabled ||
          next.serviceAccess.accessRevision !== body.expectedAccessRevision + 1
        ) {
          setFeedback('尚未确认接入设置完成，原内容继续保留。');
          return;
        }
        access.clear();
        setCurrent((old) => ({ ...old, serviceAccess: next.serviceAccess }));
        accessForm.setFieldValue('enabled', next.serviceAccess.enabled);
        setAccessDirty(false);
        setFeedback('已核对服务接入状态。本地未保存资料继续保留。');
        return;
      }
      if (dirty || conflict) {
        setLatest(next);
        setComparing(true);
        setFeedback('本地输入已保留，请比较服务器最新内容后决定。');
      } else {
        accepted(next);
        setFeedback('已读取服务器草稿和发布状态。');
      }
    } catch (e) {
      failed(e);
    } finally {
      setReading(false);
    }
  }
  const updatePrice = (index: number, field: keyof Price, value: string | number) => {
    setPrices((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setDirty(true);
  };
  const comparisonLabels: Record<Exclude<keyof Values, 'recordJson'>, string> = {
    name: '机构名称',
    regionCode: '地区代码',
    regionDisplayName: '地区名称',
    hasProfile: '发布详细介绍',
    source: '公开资料来源',
    room: '居住条件',
    address: '实际地址',
    nature: '机构性质',
    tags: '展示标签',
    tagNote: '标签口径与未知项',
    otherFees: '另列费用及条件',
    priceNote: '价格口径与限制',
    historyNote: '历史版本说明',
  };
  const localValues = form.getFieldsValue();
  const latestValues = latest ? valuesOf(latest) : undefined;
  const comparisonRows = latestValues
    ? Object.entries(comparisonLabels)
        .map(([key, label]) => ({
          key,
          label,
          mine: localValues[key as keyof Values],
          server: latestValues[key as keyof Values],
        }))
        .filter((row) => row.mine !== row.server)
    : [];
  const displayValue = (value: unknown) =>
    typeof value === 'boolean' ? (value ? '是' : '否') : String(value || '未提供');
  const priceDescription = (rows: Price[]) =>
    rows.length
      ? rows
          .map(
            (row) =>
              `${row.level}：床位 ${row.bed ?? '未知'} + 护理 ${row.care ?? '未知'} + 伙食 ${row.food ?? '未知'} = 总月费 ${row.total ?? '未知'} 元`,
          )
          .join('\n')
      : '暂无公开价格';
  return (
    <>
      <div className="page-heading">
        <div>
          <Button type="text" icon={<IconArrowLeft />} onClick={onBack}>
            返回机构列表
          </Button>
          <h1>
            {current.publicProfile?.name ||
              String(current.record?.identity.name?.value || '新机构草稿')}
          </h1>
          <p className="muted institution-meta">
            稳定 ID：{id} · 草稿 {current.draftRevision} · 当前发布{' '}
            {current.currentRecordRevision || '暂无'}
          </p>
        </div>
        <div className="actions">
          <Tag color={dirty ? 'orange' : current.status === 'PUBLISHED' ? 'green' : 'gray'}>
            {dirty ? '有未保存修改' : statusLabels[current.status]}
          </Tag>
          <Button
            icon={<IconRefresh />}
            loading={reading}
            disabled={busy}
            onClick={() => void readLatest()}
          >
            查询服务器版本
          </Button>
        </div>
      </div>
      <ErrorNotice message={error} />
      {feedback && <Alert type="info" content={feedback} />}
      <div aria-live="polite">
        {conflict && (
          <Alert
            type="warning"
            content="检测到版本冲突，本地修改已保留。请先查询服务器版本、比较差异，再合并保存并重新确认。"
          />
        )}
        {pending && (
          <Alert
            type="warning"
            content="写入结果尚未确认。输入和原请求已保留；请查询服务器版本或重试原操作。"
          />
        )}
      </div>
      <div className="workflow-status" aria-label="资料发布流程">
        草稿 <span>→</span> 已保存 <span>→</span> 已确认 <span>→</span> 已发布{' '}
        <b>{dirty ? '已修改，需保存并重新确认' : statusLabels[current.status]}</b>
      </div>
      <div className={styles.editorGrid}>
        <div>
          <section className="panel">
            <h2>机构资料草稿</h2>
            <Form
              id="institution-draft"
              form={form}
              layout="vertical"
              initialValues={valuesOf(initial)}
              disabled={locked}
              onValuesChange={changed}
              onSubmit={() => void saveDraft()}
              onSubmitFailed={() => {
                if (basicSection.current) {
                  basicSection.current.open = true;
                  basicSection.current.scrollIntoView({ block: 'center' });
                  basicSection.current
                    .querySelector<HTMLInputElement>('input[aria-invalid="true"], input')
                    ?.focus();
                }
              }}
            >
              <div className="actions">
                <Button
                  type="primary"
                  loading={save.busy}
                  disabled={
                    busy ||
                    !!(confirm.pending || publish.pending || access.pending) ||
                    conflict ||
                    (!save.pending && !dirty)
                  }
                  onClick={() => (save.pending ? void saveDraft() : form.submit())}
                >
                  {save.pending ? '使用原内容重试保存' : '保存草稿'}
                </Button>
                <span className="muted">保存修改后需重新人工确认</span>
              </div>
              <details ref={basicSection} className="editor-section" open>
                <summary>基础资料</summary>
                <Field name="name" label="机构公开名称" required />
                <div className="form-two">
                  <Field name="regionCode" label="地区代码（按确认资料填写）" required />
                  <Field name="regionDisplayName" label="所属地区名称" required />
                </div>
                <p className="muted">
                  名称或地区修改会撤销该字段原核验依据，不自动变成已核验事实。
                </p>
                <Form.Item field="hasProfile" triggerPropName="checked">
                  <Checkbox>同时发布详细介绍与价目表</Checkbox>
                </Form.Item>
              </details>
              <div hidden={!hasProfile}>
                <details className="editor-section">
                  <summary>公开介绍</summary>
                  <Field name="source" label="公开资料来源">
                    <Input.TextArea maxLength={1000} autoSize={{ minRows: 2, maxRows: 4 }} />
                  </Field>
                  <div className="form-two">
                    <Field name="address" label="实际地址（未知保持空白）" />
                    <Field name="nature" label="机构性质（按确认资料填写）" />
                    <Field name="room" label="房间与居住条件" />
                  </div>
                  <Field name="tags" label="展示标签（每行一个）">
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
                  </Field>
                  <Field name="tagNote" label="标签口径及未核实事项">
                    <Input.TextArea maxLength={1000} autoSize={{ minRows: 2, maxRows: 4 }} />
                  </Field>
                  <Alert
                    type="info"
                    content="“医养结合”等展示标签不会改写医疗资格、护理能力或接收核实结论。"
                  />
                </details>
                <details className="editor-section">
                  <summary>公示价格</summary>
                  <div className="section-caption">
                    <h3>公示价格 / 元每月</h3>
                    <Button
                      disabled={locked}
                      icon={<IconPlus />}
                      onClick={() => {
                        setPrices((v) => [...v, { level: '' }]);
                        setDirty(true);
                      }}
                    >
                      增加价格行
                    </Button>
                  </div>
                  {!prices.length && (
                    <p className="muted">暂无已公开价格，保持未知。请勿填写推测金额。</p>
                  )}
                  {prices.map((row, index) => (
                    <div className={styles.priceRow} key={index}>
                      <label>
                        公示护理档位
                        <Input
                          aria-label={'第' + (index + 1) + '行护理档位'}
                          value={row.level}
                          maxLength={80}
                          disabled={locked}
                          onChange={(v) => updatePrice(index, 'level', v)}
                        />
                      </label>
                      {(
                        [
                          ['bed', '床位费'],
                          ['care', '护理费'],
                          ['food', '伙食费'],
                          ['total', '总月费'],
                        ] as const
                      ).map(([field, label]) => (
                        <label key={field}>
                          {label}
                          <InputNumber
                            aria-label={'第' + (index + 1) + '行' + label}
                            min={0}
                            max={10000000}
                            precision={0}
                            disabled={locked}
                            value={row[field]}
                            onChange={(v) => updatePrice(index, field, v)}
                          />
                        </label>
                      ))}
                      <Button
                        status="danger"
                        type="text"
                        disabled={locked}
                        onClick={() => {
                          setPrices((rows) => rows.filter((_, i) => i !== index));
                          setDirty(true);
                        }}
                      >
                        移除此行
                      </Button>
                    </div>
                  ))}
                  <Field name="otherFees" label="另列费用及使用 / 退还条件">
                    <Input.TextArea maxLength={2000} autoSize={{ minRows: 2, maxRows: 5 }} />
                  </Field>
                  <Field name="priceNote" label="费用口径、适用限制及待确认信息">
                    <Input.TextArea maxLength={2000} autoSize={{ minRows: 2, maxRows: 5 }} />
                  </Field>
                  <Field name="historyNote" label="与旧版本的关系说明">
                    <Input.TextArea maxLength={2000} autoSize={{ minRows: 2, maxRows: 5 }} />
                  </Field>
                </details>
              </div>
              <Collapse>
                <Collapse.Item
                  destroyOnHide={false}
                  name="advanced"
                  header="高级资料 · 完整事实、核验与护理证据 JSON"
                >
                  <p className="muted">
                    保留 unknown / unavailable / unverified / expired / false
                    的区别；公开标签不代替能力证据。
                  </p>
                  <Field name="recordJson" label="Institution V1.2.1 完整资料">
                    <Input.TextArea
                      className="code-input"
                      autoSize={{ minRows: 12, maxRows: 26 }}
                      spellCheck={false}
                    />
                  </Field>
                </Collapse.Item>
              </Collapse>
            </Form>
          </section>
        </div>
        <aside>
          <section className="panel">
            <details className="editor-section">
              <summary>来源与确认</summary>
              <p className="muted">只确认已保存的这一份草稿。来源、确认人和日期均按实际填写。</p>
              <Form
                id="institution-confirm"
                form={confirmForm}
                layout="vertical"
                initialValues={initial.confirmation || {}}
                onValuesChange={() => setConfirmDirty(true)}
                disabled={locked || dirty || conflict || !current.draftRevision}
                onSubmit={confirmDraft}
              >
                <Field name="sourceReference" label="本次确认来源引用" required>
                  <Input.TextArea maxLength={1000} autoSize={{ minRows: 2, maxRows: 5 }} />
                </Field>
                <Field name="confirmedBy" label="实际确认人 / 可追溯标识" required />
                <Field name="confirmedOn" label="实际人工确认日期" required>
                  <Input type="date" />
                </Field>
                <Button
                  long
                  disabled={
                    busy ||
                    dirty ||
                    conflict ||
                    !!(save.pending || publish.pending || access.pending) ||
                    !current.draftRevision
                  }
                  loading={confirm.busy}
                  onClick={() =>
                    confirm.pending
                      ? void confirmDraft(
                          confirmForm.getFieldsValue() as {
                            sourceReference: string;
                            confirmedBy: string;
                            confirmedOn: string;
                          },
                        )
                      : confirmForm.submit()
                  }
                >
                  {confirm.pending ? '使用原内容重试确认' : '确认已保存草稿'}
                </Button>
              </Form>
            </details>
          </section>
          <section className="panel">
            <details className="editor-section">
              <summary>版本发布</summary>
              <p className="muted">新版本供当前目录使用。旧推荐和历史资料继续引用原版本。</p>
              <Button
                type="primary"
                long
                loading={publish.busy}
                disabled={
                  busy ||
                  dirty ||
                  conflict ||
                  !!(save.pending || confirm.pending || access.pending) ||
                  (!publish.pending && (current.status !== 'CONFIRMED' || !current.confirmation))
                }
                onClick={() => void publishDraft()}
              >
                {publish.pending ? '使用原操作重试发布' : '发布已确认版本'}
              </Button>
              {current.publishedRecordRevision && (
                <p>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={
                      '/api/v1/institution-publications/' +
                      encodeURIComponent(id) +
                      '/revisions/' +
                      current.publishedRecordRevision
                    }
                  >
                    读取已发布第 {current.publishedRecordRevision} 版公开资料 ↗
                  </a>
                </p>
              )}
            </details>
          </section>
          <section className="panel">
            <h2>平台免费服务接入</h2>
            <Tag color={current.serviceAccess.enabled ? 'green' : 'gray'}>
              {current.serviceAccess.enabled ? '允许新服务申请' : '未接收新服务申请'}
            </Tag>
            <p className="muted">与资料发布独立。接入不代表护理资格、床位、官方认证或确认预约。</p>
            <Form
              id="institution-access"
              form={accessForm}
              layout="vertical"
              initialValues={{ enabled: initial.serviceAccess.enabled, sourceReference: '' }}
              onValuesChange={() => setAccessDirty(true)}
              disabled={
                locked ||
                conflict ||
                (!current.currentRecordRevision && !current.serviceAccess.enabled)
              }
              onSubmit={saveAccess}
            >
              <Form.Item field="enabled" triggerPropName="checked">
                <Checkbox>允许接收新咨询 / 带看意向</Checkbox>
              </Form.Item>
              <Field name="sourceReference" label="接入决定来源 / 确认说明" required>
                <Input.TextArea maxLength={1000} autoSize={{ minRows: 2, maxRows: 5 }} />
              </Field>
              <Button
                long
                loading={access.busy}
                disabled={
                  busy ||
                  conflict ||
                  !!(save.pending || confirm.pending || publish.pending) ||
                  (!access.pending &&
                    !current.currentRecordRevision &&
                    !current.serviceAccess.enabled)
                }
                onClick={() =>
                  access.pending
                    ? void saveAccess(
                        accessForm.getFieldsValue() as {
                          enabled: boolean;
                          sourceReference: string;
                        },
                      )
                    : accessForm.submit()
                }
              >
                {access.pending ? '使用原操作重试接入' : '保存接入设置'}
              </Button>
            </Form>
          </section>
        </aside>
      </div>
      <Modal
        visible={comparing}
        title="核对服务器最新版本"
        style={{ width: 1000 }}
        footer={null}
        onCancel={() => setComparing(false)}
      >
        <p>
          本地输入仍保留。服务器草稿 {latest?.draftRevision} / 发布版本{' '}
          {latest?.currentRecordRevision || '暂无'}；当前编辑基于草稿 {current.draftRevision}。
        </p>
        <p className="muted">
          逐项核对不同内容。未选择“采用服务器值”的项目仍保留你的本地输入，继续后还需保存并重新确认。
        </p>
        <div className={styles.differences}>
          {comparisonRows.length === 0 && <p className="muted">公开字段没有差异</p>}
          {comparisonRows.map((row) => (
            <section className={styles.difference} key={row.key}>
              <h3>{row.label}</h3>
              <div>
                <small>我的本地输入</small>
                <p>{displayValue(row.mine)}</p>
              </div>
              <div>
                <small>服务器最新内容</small>
                <p>{displayValue(row.server)}</p>
              </div>
              <Button
                disabled={!!pending}
                type="text"
                onClick={() => {
                  const values = { [row.key]: row.server };
                  writeDraft(values);
                  changed(values);
                }}
              >
                采用服务器值
              </Button>
            </section>
          ))}
        </div>
        {latest && signature(prices) !== signature(latest.publicProfile?.prices || []) && (
          <section className="panel">
            <h3>公示价格不同</h3>
            <div className={styles.comparison}>
              <div>
                <b>我的本地价格</b>
                <p style={{ whiteSpace: 'pre-wrap' }}>{priceDescription(prices)}</p>
              </div>
              <div>
                <b>服务器价格</b>
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  {priceDescription(latest.publicProfile?.prices || [])}
                </p>
              </div>
            </div>
            <Button
              disabled={!!pending}
              onClick={() => {
                setPrices(latest.publicProfile?.prices || []);
                setDirty(true);
              }}
            >
              采用服务器价格
            </Button>
          </section>
        )}
        <Collapse>
          <Collapse.Item name="facts" header="高级核验与护理资料差异（仅修改过完整资料时核对）">
            <p className="muted">
              名称和地区的修改也会反映在这里。涉及证据或护理能力时，逐项按来源核对后再保存。
            </p>
            <div className={styles.comparison}>
              <section>
                <h3>我的完整资料</h3>
                <pre>{localValues.recordJson}</pre>
              </section>
              <section>
                <h3>服务器完整资料</h3>
                <pre>{JSON.stringify(latest?.record, null, 2)}</pre>
              </section>
            </div>
            <Button
              disabled={!!pending || !latest}
              onClick={() => {
                if (latest) {
                  const values = { recordJson: JSON.stringify(latest.record, null, 2) };
                  writeDraft(values);
                  changed(values);
                }
              }}
            >
              采用服务器完整核验资料（含名称与地区）
            </Button>
          </Collapse.Item>
        </Collapse>
        <div className="actions">
          <Button
            disabled={!!pending}
            type="primary"
            onClick={() => {
              if (latest) {
                setCurrent(latest);
                setConflict(false);
                setDirty(true);
                setComparing(false);
                setFeedback(
                  '已采用服务器最新版本作为保存基准。本地修改保留；请完成合并、保存草稿并重新确认。',
                );
              }
            }}
          >
            保留我的修改，以最新版本为基准继续编辑
          </Button>
          <Button
            disabled={!!pending}
            onClick={async () => {
              if (
                latest &&
                (await confirmAction('改用服务器资料？', '本地未保存的机构内容将被替换。'))
              ) {
                accepted(latest);
                setComparing(false);
                setFeedback('已采用服务器资料，本地未保存修改已放弃。');
              }
            }}
          >
            放弃本地修改，采用服务器资料
          </Button>
          <Button onClick={() => setComparing(false)}>继续核对</Button>
        </div>
      </Modal>
    </>
  );
}
export function BaselineImport({ onSaved }: { onSaved: () => void }) {
  const [form] = Form.useForm<{
      catalog: string;
      sourceReference: string;
      preserveExistingFacts: boolean;
    }>(),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState('');
  useDirty('institution:baseline', dirty);
  const mutation = useMutation('institution:baseline/import', importSchema);
  async function submit(v: {
    catalog: string;
    sourceReference: string;
    preserveExistingFacts: boolean;
  }) {
    if (!mutation.pending && !v.preserveExistingFacts) {
      mutation.setError('请确认保留原事实和核验日期。');
      return;
    }
    try {
      let body = mutation.pending?.body;
      if (!body) {
        const imported: unknown = JSON.parse(v.catalog);
        if (!imported || typeof imported !== 'object') throw Error('目录 JSON 格式不正确。');
        body = {
          operationId: crypto.randomUUID(),
          sourceReference: v.sourceReference.trim(),
          preserveExistingFacts: true,
          ...('catalog' in imported
            ? {
                catalog: imported.catalog,
                historicalRecords:
                  'historicalRecords' in imported ? imported.historicalRecords : [],
              }
            : { catalog: imported }),
        };
      }
      const response = await mutation.run('/institutions/import-baseline', body);
      if (response) {
        setDirty(false);
        setMessage('服务器已确认导入 ' + response.imported + ' 条已有版本，原事实与核验日期保留。');
        onSaved();
      }
    } catch (e) {
      mutation.setError(describe(e));
    }
  }
  return (
    <Collapse>
      <Collapse.Item name="import" header="已有目录迁移 · 文件导入或粘贴 JSON">
        <p className="muted">
          只迁移已有版本。同一版本内容不同会被拒绝；历史记录与当前目录分别处理，不视为本次重新核验。
        </p>
        <Form
          id="institution-import"
          form={form}
          layout="vertical"
          onValuesChange={() => setDirty(true)}
          onSubmit={submit}
          disabled={mutation.busy || !!mutation.pending}
        >
          <label className={styles.file}>
            现有目录 JSON 文件
            <input
              type="file"
              accept="application/json,.json"
              disabled={mutation.busy || !!mutation.pending}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 12 * 1024 * 1024) {
                  mutation.setError('文件超过 12 MiB，请核对导出内容。');
                  return;
                }
                const epoch = client.epoch;
                try {
                  const text = await file.text();
                  if (epoch === client.epoch) {
                    form.setFieldValue('catalog', text);
                    setDirty(true);
                  }
                } catch {
                  mutation.setError('文件读取失败，可重新选择或粘贴 JSON。');
                }
              }}
            />
          </label>
          <Field name="catalog" label="或粘贴完整目录 JSON" required>
            <Input.TextArea className="code-input" autoSize={{ minRows: 5, maxRows: 15 }} />
          </Field>
          <Field name="sourceReference" label="本次迁移来源引用" required>
            <Input maxLength={1000} />
          </Field>
          <Form.Item field="preserveExistingFacts" triggerPropName="checked">
            <Checkbox>我确认仅迁移现有版本，保留原核验日期，不代表本次重新核验</Checkbox>
          </Form.Item>
          <ErrorNotice message={mutation.error} />
          {message && <Alert type="success" content={message} />}
          <Button
            type="primary"
            loading={mutation.busy}
            disabled={mutation.busy}
            onClick={() =>
              mutation.pending
                ? void submit(
                    form.getFieldsValue() as {
                      catalog: string;
                      sourceReference: string;
                      preserveExistingFacts: boolean;
                    },
                  )
                : form.submit()
            }
          >
            {mutation.pending ? '使用原操作重试导入' : '导入现有目录'}
          </Button>
        </Form>
      </Collapse.Item>
    </Collapse>
  );
}
export default function Institutions() {
  const list = useRead('/institutions', institutionsSchema),
    [current, setCurrent] = useState<Draft>(),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [newId, setNewId] = useState('');
  const work = useWork();
  async function canLeave() {
    if ([...work.pending.keys()].some((k) => k.startsWith('institution:'))) {
      setError('写入结果尚未确认，请先查询或使用原操作重试。');
      return false;
    }
    if ([...work.dirty.keys()].some((k) => k.startsWith('institution:')))
      return confirmAction('离开并放弃未保存输入？', '请先确认当前机构或导入内容已保存。');
    return true;
  }
  async function open(id: string) {
    if (!(await canLeave())) return;
    setBusy(true);
    setError('');
    try {
      const r = await client.request(
        '/institutions/' + encodeURIComponent(id) + '/draft',
        draftResponse,
      );
      if (r.item.institutionId !== id) throw Error('机构关联不正确。');
      setCurrent(r.item);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!/^[a-z][a-z0-9-]{1,99}$/.test(newId)) {
      setError('稳定 ID 需小写字母开头，使用字母、数字、短横线，长度 2–100。');
      return;
    }
    if (!(await canLeave())) return;
    setBusy(true);
    setError('');
    try {
      const r = await client.request(
        '/institutions/template?' + new URLSearchParams({ institutionId: newId }),
        templateSchema,
      );
      if (r.record.institutionId !== newId) throw Error('模板机构关联不正确。');
      setCurrent({
        institutionId: newId,
        draftRevision: 0,
        baseRecordRevision: null,
        currentRecordRevision: null,
        status: 'DRAFT',
        record: r.record,
        publicProfile: null,
        confirmation: null,
        publishedRecordRevision: null,
        serviceAccess: { enabled: false, accessRevision: 0 },
      });
      setCreating(false);
      setNewId('');
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }
  useRenderMark('admin-institutions-ready', !!list.data);
  if (current)
    return (
      <>
        <ErrorNotice message={error} />
        <Editor
          key={current.institutionId}
          initial={current}
          onListChanged={list.reload}
          onBack={() =>
            void canLeave().then((ok) => {
              if (ok) setCurrent(undefined);
            })
          }
        />
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>机构资料</h1>
          <p>从草稿到发布，每次更新都有来源，每个旧版本都保留。</p>
        </div>
        <Button type="primary" icon={<IconPlus />} onClick={() => setCreating(true)}>
          新建机构草稿
        </Button>
      </div>
      <ErrorNotice message={error || list.error} retry={list.reload} />
      <section className="panel">
        <div className="filter-grid">
          <label>
            机构名称 / 稳定 ID
            <Input
              prefix={<IconSearch />}
              value={search}
              onChange={setSearch}
              placeholder="搜索当前全部机构"
            />
          </label>
          <label>
            资料状态
            <Select
              allowClear
              value={status}
              onChange={(v) => setStatus(v || '')}
              options={options(statusLabels)}
              placeholder="全部状态"
            />
          </label>
          <Button icon={<IconRefresh />} onClick={list.reload}>
            刷新机构列表
          </Button>
        </div>
        <p className="muted">
          搜索和状态筛选作用于服务器返回的完整机构列表。公开资料与平台服务接入独立。
        </p>
        <Table
          border={false}
          rowKey="institutionId"
          loading={busy || list.loading}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 15 }}
          data={
            list.data?.items.filter(
              (r) =>
                (!status || r.status === status) &&
                (!search || (r.name || '').includes(search) || r.institutionId.includes(search)),
            ) || []
          }
          columns={[
            {
              title: '机构',
              width: 250,
              render: (_, r) => (
                <>
                  <b>{r.name || '尚未填写公开名称'}</b>
                  <p className="muted">{r.institutionId}</p>
                </>
              ),
            },
            {
              title: '资料状态',
              width: 150,
              render: (_, r) => (
                <Tag
                  color={
                    r.status === 'PUBLISHED'
                      ? 'green'
                      : r.status === 'CONFIRMED'
                        ? 'orange'
                        : 'gray'
                  }
                >
                  {statusLabels[r.status as keyof typeof statusLabels]}
                </Tag>
              ),
            },
            {
              title: '当前发布',
              width: 120,
              render: (_, r) =>
                r.currentRecordRevision ? '第 ' + r.currentRecordRevision + ' 版' : '暂无',
            },
            { title: '草稿', width: 90, dataIndex: 'draftRevision' },
            {
              title: '服务接入',
              width: 140,
              render: (_, r) => {
                const access = r.serviceAccess as { enabled?: boolean } | undefined;
                return (
                  <Tag color={access?.enabled ? 'green' : 'gray'}>
                    {access?.enabled ? '接收新申请' : '未接收新申请'}
                  </Tag>
                );
              },
            },
            {
              title: '操作',
              width: 100,
              render: (_, r) => (
                <Button type="text" onClick={() => void open(r.institutionId)}>
                  维护资料
                </Button>
              ),
            },
          ]}
        />
      </section>
      <section className="panel">
        <BaselineImport onSaved={list.reload} />
      </section>
      <Modal
        visible={creating}
        title="新建机构草稿"
        onCancel={() => setCreating(false)}
        onOk={create}
        confirmLoading={busy}
        okText="准备新草稿"
      >
        <p>一个院区沿用同一个稳定 ID，改名也不更换。模板中的事实保持未知，直到有可追溯来源。</p>
        <label>
          机构稳定 ID
          <Input
            value={newId}
            onChange={setNewId}
            maxLength={100}
            placeholder="例如 wh-campus-east"
          />
        </label>
      </Modal>
    </>
  );
}
