import { useRenderMark } from '../useRenderMark';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  useMobile,
  Button,
  Collapse,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
} from '../ui';
import { IconDownload, IconRefresh } from '../ui/icons';
import type { z } from 'zod';
import { client, describe } from '../api/client';
import { reportSchema, serviceSchema, type ServiceInstitution } from '../api/schema';
import { time, today } from '../time';
import styles from './Reports.module.css';

type Report = z.infer<typeof reportSchema>['report'];
type Filters = { from: string; to: string; institutionId?: string; source?: string };
const metricLabels: Record<string, string> = {
  newRequests: '新需求（条）',
  visitIntentRequests: '关联带看意向（条）',
  contactEvents: '期间联系记录（次）',
  connectedEvents: '已接通（次）',
  noAnswerEvents: '未接通（次）',
  refusedEvents: '拒绝联系（次）',
  confirmedSessions: '期间首次确认（场）',
  rescheduledEvents: '期间改期（次）',
  arrivedSessions: '期间实际到访（场）',
  arrivedRequests: '期间到访去重需求（条）',
  cancelledSessions: '取消带看（场）',
  noShowSessions: '未到访（场）',
  movedInFeedbackEvents: '有来源入住反馈（次）',
  notMovedInFeedbackEvents: '未入住反馈（次）',
  unknownFeedbackEvents: '未知入住反馈（次）',
};
const sourceLabels: Record<string, string> = {
  MINIPROGRAM: '小程序主动申请',
  OFFLINE_MANUAL: '线下人工来源',
  SELF_TEST: '员工自测',
  SYNTHETIC_TEST_ONLY: '合成测试',
  UNKNOWN: '来源未知',
  ALL: '本环境全部来源',
};
const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '未提供' : String(value);

export default function Reports() {
  const mobile = useMobile();
  const [form] = Form.useForm<Filters>();
  const [institutions, setInstitutions] = useState<ServiceInstitution[]>([]);
  const [serviceError, setServiceError] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState('预览查询完整筛选范围，下载沿用同一批次。');
  const [error, setError] = useState('');
  useRenderMark('admin-reports-ready', !!report);
  const generation = useRef(0);
  const mounted = useRef(true);
  const serviceGeneration = useRef(0);
  const inFlight = useRef(false);
  const downloadInFlight = useRef(false);

  async function loadInstitutions() {
    const current = ++serviceGeneration.current;
    setServiceError('');
    try {
      const response = await client.request('/service-institutions', serviceSchema);
      if (mounted.current && current === serviceGeneration.current)
        setInstitutions(response.serviceInstitutions);
    } catch (cause) {
      if (mounted.current && current === serviceGeneration.current)
        setServiceError(describe(cause));
    }
  }
  useEffect(() => {
    mounted.current = true;
    void loadInstitutions();
    return () => {
      mounted.current = false;
      generation.current++;
      serviceGeneration.current++;
    };
  }, []);

  function invalidate() {
    generation.current++;
    setReport(null);
    setFeedback('筛选已更改，请重新生成报告。');
    setError('');
  }
  async function generate(values: Filters) {
    if (inFlight.current) return;
    if (!values.from || !values.to || values.from > values.to) {
      setError('请选择有效日期范围，结束日不能早于开始日。');
      return;
    }
    const current = ++generation.current;
    inFlight.current = true;
    setBusy(true);
    setReport(null);
    setError('');
    setFeedback('正在查询完整筛选范围并固定本批次…');
    try {
      const response = await client.request('/reports', reportSchema, {
        method: 'POST',
        body: {
          from: values.from,
          to: values.to,
          institutionId: values.institutionId || null,
          source: values.source || null,
        },
      });
      if (!mounted.current || current !== generation.current) return;
      setReport(response.report);
      setFeedback('报告已生成。预览和 Excel 使用下方同一批次。');
    } catch (cause) {
      if (mounted.current && current === generation.current) {
        setError(describe(cause));
        setFeedback('尚未生成本批报告。');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function download() {
    if (!report || downloadInFlight.current) return;
    const snapshot = report,
      current = generation.current;
    downloadInFlight.current = true;
    setDownloading(true);
    setError('');
    try {
      const blob = await client.download(snapshot.snapshotId);
      if (!mounted.current || current !== generation.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `快康养-${snapshot.institutionId || '平台'}-${snapshot.from}-${snapshot.to}-${snapshot.snapshotId}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setFeedback('已发起本批次聚合 Excel 下载，请在浏览器下载列表确认；文件不含个人或隐藏明细。');
    } catch (cause) {
      if (mounted.current && current === generation.current) setError(describe(cause));
    } finally {
      downloadInFlight.current = false;
      if (mounted.current) setDownloading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className="page-heading">
        <div>
          <h1>服务报告</h1>
          <p className={styles.description}>用实际联系与到访记录，查看免费对接的阶段成果。</p>
        </div>
        <Tag bordered color="gray">
          对外聚合 · 无个人明细
        </Tag>
      </div>
      <section className="panel" aria-labelledby="report-filter-title">
        <div className={styles.sectionHeading}>
          <h2 id="report-filter-title">选择统计范围</h2>
          <span className={styles.description}>北京时间 · 包含结束日全天</span>
        </div>
        {serviceError && (
          <Alert
            type="warning"
            content={
              <Space wrap>
                <span>机构筛选名单读取失败：{serviceError}</span>
                <Button size="small" icon={<IconRefresh />} onClick={() => void loadInstitutions()}>
                  重试名单
                </Button>
              </Space>
            }
          />
        )}
        <Form
          form={form}
          layout="vertical"
          initialValues={{ from: today(), to: today(), institutionId: '', source: '' }}
          onValuesChange={invalidate}
          onSubmit={generate}
        >
          <div className="filter-grid">
            <Form.Item
              label="开始日期"
              field="from"
              rules={[{ required: true, message: '请选择开始日期' }]}
            >
              <Input type="date" aria-label="报告开始日期" />
            </Form.Item>
            <Form.Item
              label="结束日期（含当天）"
              field="to"
              rules={[{ required: true, message: '请选择结束日期' }]}
            >
              <Input type="date" aria-label="报告结束日期" />
            </Form.Item>
            <Form.Item label="机构范围" field="institutionId">
              <Select
                aria-label="报告机构范围"
                options={[
                  { value: '', label: '平台去重总览' },
                  ...institutions.map((row) => ({
                    value: row.institutionId,
                    label: row.institutionName + (row.enabled ? '' : '（已停用，含历史记录）'),
                  })),
                ]}
              />
            </Form.Item>
            <Form.Item label="数据来源" field="source">
              <Select
                aria-label="报告数据来源"
                options={[
                  { value: '', label: '本环境全部来源' },
                  ...Object.entries(sourceLabels)
                    .filter(([value]) => !['UNKNOWN', 'ALL'].includes(value))
                    .map(([value, label]) => ({ value, label })),
                ]}
              />
            </Form.Item>
          </div>
          <Space wrap className={styles.reportActions}>
            <Button type="primary" htmlType="submit" loading={busy}>
              生成报告预览
            </Button>
            <Button
              icon={<IconDownload />}
              onClick={() => void download()}
              disabled={!report}
              loading={downloading}
            >
              下载本批次 Excel
            </Button>
          </Space>
        </Form>
        <p className={styles.feedback} role="status" aria-live="polite">
          {feedback}
        </p>
        {error && <Alert type="error" content={error} />}
      </section>
      {report ? (
        <>
          <section className="panel" aria-labelledby="report-result-title">
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="report-result-title">{report.institutionName}</h2>
                <p className={styles.description}>
                  {report.from} 至 {report.to} · 来源：
                  {sourceLabels[report.sourceFilter] || report.sourceFilter}
                </p>
              </div>
              <Tag color="gray">本批次已固定</Tag>
            </div>
            <div className={styles.metricGrid}>
              {['newRequests', 'contactEvents', 'confirmedSessions', 'arrivedSessions'].map(
                (key) => (
                  <article className={styles.metric} key={key}>
                    <p>{metricLabels[key]}</p>
                    <strong>{count(report.metrics[key])}</strong>
                  </article>
                ),
              )}
            </div>
            <Alert type="info" content={report.warning} />
            <details className="report-provenance">
              <summary>查看批次与统计口径</summary>
              <dl className={styles.meta}>
                <div>
                  <dt>生成 / 观察截止</dt>
                  <dd>{time(report.generatedAt)}（北京时间）</dd>
                </div>
                <div>
                  <dt>统计口径</dt>
                  <dd>{report.policyVersion}</dd>
                </div>
                <div className={styles.batch}>
                  <dt>批次编号</dt>
                  <dd>{report.snapshotId}</dd>
                </div>
              </dl>
            </details>
          </section>
          <section className="panel" aria-labelledby="report-activity-title">
            <details className={styles.detailSection} open={!mobile || undefined}>
              <summary>
                <h2 id="report-activity-title">期间活动</h2>
              </summary>
              {mobile ? (
                <dl className={styles.metricList}>
                  {Object.entries(metricLabels).map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{count(report.metrics[key])}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <Table
                  border={false}
                  rowKey="key"
                  pagination={false}
                  data={Object.entries(metricLabels).map(([key, label]) => ({
                    key,
                    label,
                    value: count(report.metrics[key]),
                  }))}
                  columns={[
                    { title: '指标', dataIndex: 'label' },
                    { title: '实际数量', dataIndex: 'value', width: 150 },
                  ]}
                  scroll={{ x: 480 }}
                />
              )}
            </details>
          </section>
          <section className="panel" aria-labelledby="report-cohort-title">
            <h2 id="report-cohort-title">同批需求转化</h2>
            <p className={styles.cohort}>
              同批需求分母 <strong>{count(report.metrics.cohortDenominator)}</strong>{' '}
              条，其中明确到访 <strong>{count(report.metrics.cohortArrivedRequests)}</strong>{' '}
              条。到访率：
              <strong>
                {report.metrics.cohortArrivalRate === null ||
                report.metrics.cohortArrivalRate === undefined
                  ? '无可用比率'
                  : (report.metrics.cohortArrivalRate * 100).toFixed(1) + '%'}
              </strong>
              。
            </p>
            <p className={styles.description}>
              分母为本区间创建的关联需求，观察至本批生成时刻；期间发生的活动与同批需求转化分别统计。
            </p>
          </section>
          <section className="panel" aria-labelledby="report-profiles-title">
            <details className={styles.detailSection} open={!mobile || undefined}>
              <summary>
                <h2 id="report-profiles-title">需求画像</h2>
              </summary>
              {mobile ? (
                <div className={styles.detailCards}>
                  {report.profiles.map((row) => (
                    <article key={row.dimension + '/' + row.category}>
                      <h3>
                        {row.dimension} · {row.category}
                      </h3>
                      <p>需求数：{row.count === null ? '不展示' : `${row.count} 条`}</p>
                      <p className={styles.description}>{row.note}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <Table
                  border={false}
                  rowKey={(row) => row.dimension + '/' + row.category}
                  pagination={false}
                  data={report.profiles}
                  columns={[
                    { title: '维度', dataIndex: 'dimension' },
                    { title: '分类', dataIndex: 'category' },
                    {
                      title: '需求数（条）',
                      render: (_, row) => (row.count === null ? '不展示' : row.count),
                    },
                    { title: '说明', dataIndex: 'note' },
                  ]}
                  scroll={{ x: 760 }}
                />
              )}
            </details>
          </section>
          <section className="panel" aria-labelledby="report-institutions-title">
            <details className={styles.detailSection} open={!mobile || undefined}>
              <summary>
                <h2 id="report-institutions-title">分机构成果</h2>
              </summary>
              <p className={styles.description}>各机构行独立去重，平台总数不能由这些行相加。</p>
              {mobile ? (
                <div className={styles.detailCards}>
                  {report.institutions.map((row) => (
                    <article key={row.institutionName}>
                      <h3>{row.institutionName}</h3>
                      <dl className={styles.metricList}>
                        {(
                          [
                            'newRequests',
                            'confirmedSessions',
                            'arrivedSessions',
                            'arrivedRequests',
                            'movedInFeedbackEvents',
                          ] as const
                        ).map((key) => (
                          <div key={key}>
                            <dt>{metricLabels[key]}</dt>
                            <dd>{count(row.metrics[key])}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <Table
                  border={false}
                  rowKey="institutionName"
                  pagination={false}
                  data={report.institutions}
                  columns={[
                    { title: '机构', dataIndex: 'institutionName', width: 200 },
                    ...(
                      [
                        'newRequests',
                        'confirmedSessions',
                        'arrivedSessions',
                        'arrivedRequests',
                        'movedInFeedbackEvents',
                      ] as const
                    ).map((key) => ({
                      title: metricLabels[key],
                      width: 150,
                      render: (_: unknown, row: Report['institutions'][number]) =>
                        count(row.metrics[key]),
                    })),
                  ]}
                  scroll={{ x: 960 }}
                />
              )}
            </details>
          </section>
          <section className="panel" aria-labelledby="report-sources-title">
            <details className={styles.detailSection} open={!mobile || undefined}>
              <summary>
                <h2 id="report-sources-title">数据来源</h2>
              </summary>
              {mobile ? (
                <dl className={styles.metricList}>
                  {report.sources.map((row) => (
                    <div key={row.source}>
                      <dt>{sourceLabels[row.source] || row.source}</dt>
                      <dd>{row.count} 条</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <Table
                  border={false}
                  rowKey="source"
                  pagination={false}
                  data={report.sources}
                  columns={[
                    { title: '来源', render: (_, row) => sourceLabels[row.source] || row.source },
                    { title: '同批需求（条）', dataIndex: 'count' },
                  ]}
                  scroll={{ x: 440 }}
                />
              )}
              <Collapse bordered={false} className={styles.rules}>
                <Collapse.Item header="统计口径与小样本规则" name="rules">
                  {report.rules.map((rule, index) => (
                    <p key={index}>{rule}</p>
                  ))}
                </Collapse.Item>
              </Collapse>
            </details>
          </section>
        </>
      ) : (
        <section className="panel">
          <Empty description={busy ? '正在生成本批报告…' : '选择范围后生成服务报告'} />
          <p className={styles.emptyNote}>
            报告由服务器查询完整范围生成；当前需求列表页不会用于汇总。
          </p>
        </section>
      )}
    </div>
  );
}
