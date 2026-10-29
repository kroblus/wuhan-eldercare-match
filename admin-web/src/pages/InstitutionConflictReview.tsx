import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui';
import { useScrollLock } from '../ui/scrollLock';
import styles from './Institutions.module.css';

export type InstitutionDifference = { key: string; label: string; mine: string; server: string };
export default function InstitutionConflictReview({
  rows,
  draftRevision,
  locked,
  onApply,
  onClose,
}: {
  rows: InstitutionDifference[];
  draftRevision: number;
  locked: boolean;
  onApply: (choices: Record<string, 'mine' | 'server'>) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, 'mine' | 'server'>>({});
  const screen = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const row = rows[index];
  useScrollLock(true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    screen.current?.focus();
    return () => {
      previous?.focus();
    };
  }, []);
  function move(next: number) {
    setIndex(next);
    content.current?.scrollTo?.({ top: 0 });
  }
  return (
    <section
      ref={screen}
      tabIndex={-1}
      className={styles.conflictScreen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="institution-conflict-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        if (event.key !== 'Tab') return;
        const buttons = Array.from(
          screen.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
        );
        if (!buttons.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === screen.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <header className={styles.conflictHeader}>
        <Button onClick={onClose}>返回编辑</Button>
        <h2 id="institution-conflict-title">核对机构资料</h2>
        <p>本地输入已保留 · 服务器草稿 {draftRevision}</p>
      </header>
      <div ref={content} className={styles.conflictBody}>
        {locked && (
          <p role="status" className={styles.conflictWarning}>
            原写入结果尚未确认。可以查看差异，须先查询或重试原操作。
          </p>
        )}
        {row ? (
          <>
            <div className={styles.conflictProgress}>
              <strong>
                差异 {index + 1} / {rows.length}
              </strong>
              <span>
                已选 {Object.keys(choices).length} / {rows.length}
              </span>
            </div>
            <h3 className={styles.conflictFieldTitle}>{row.label}</h3>
            {row.key === 'recordJson' && (
              <p className={styles.conflictHint}>
                完整核验资料包含名称和地区；这些基础字段以各自的选择为准，其余事实与证据保留所选版本。
              </p>
            )}
            <div
              className={styles.conflictChoices}
              role="radiogroup"
              aria-label={`选择${row.label}版本`}
            >
              {(['mine', 'server'] as const).map((version) => (
                <button
                  key={version}
                  role="radio"
                  aria-checked={choices[row.key] === version}
                  className={choices[row.key] === version ? styles.selectedVersion : undefined}
                  onClick={() => setChoices((previous) => ({ ...previous, [row.key]: version }))}
                >
                  <span className={styles.versionHeading}>
                    <strong>{version === 'mine' ? '我的本地输入' : '服务器最新内容'}</strong>
                    <span aria-hidden="true">{choices[row.key] === version ? '✓' : '○'}</span>
                  </span>
                  <span
                    className={
                      row.key === 'recordJson' ? styles.jsonDifference : styles.versionValue
                    }
                  >
                    {row[version]}
                  </span>
                  <span className={styles.versionAction}>
                    {choices[row.key] === version
                      ? '已选择此版本'
                      : version === 'mine'
                        ? '保留本地'
                        : '采用服务器'}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p>内容没有差异。确认最新草稿版本后，仍须保存并重新人工确认。</p>
        )}
        <p className={styles.conflictHint}>
          选择暂不写回表单。返回上一项会保留选择，全部选完再继续编辑；此步骤不会提交服务器。
        </p>
      </div>
      <footer className={styles.conflictFooter}>
        <div>
          <Button disabled={index === 0} onClick={() => move(index - 1)}>
            上个差异
          </Button>
          <Button disabled={index >= rows.length - 1} onClick={() => move(index + 1)}>
            下个差异
          </Button>
        </div>
        <Button
          long
          type="primary"
          disabled={locked || Object.keys(choices).length !== rows.length}
          onClick={() => onApply(choices)}
        >
          确认选择并继续编辑
        </Button>
      </footer>
    </section>
  );
}
