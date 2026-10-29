import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { Modal } from '../ui';
import { useWork } from '../state';
export default function NavigationGuard() {
  const { dirty, pending } = useWork();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty.size > 0 || pending.size > 0) && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty.size || pending.size) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty.size, pending.size]);
  return (
    <Modal
      title={pending.size ? '写入结果尚未确认' : '离开当前页面？'}
      visible={blocker.state === 'blocked'}
      okText={pending.size ? '留在此页' : '放弃修改并离开'}
      cancelText="继续编辑"
      onCancel={() => blocker.state === 'blocked' && blocker.reset()}
      onOk={() => {
        if (blocker.state === 'blocked') {
          if (pending.size) blocker.reset();
          else blocker.proceed();
        }
      }}
    >
      {pending.size
        ? '请先查询服务器状态或使用保留的原操作重试，操作编号与内容会保留。'
        : '当前有未保存输入。离开后这些输入将丢失。'}
    </Modal>
  );
}
