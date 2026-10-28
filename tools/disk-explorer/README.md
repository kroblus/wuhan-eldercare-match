# 本机项目空间分析网页

从主目录运行（Python 3.10+，无需安装依赖）：

```powershell
python tools/disk-explorer/scan.py
```

然后双击 `output/disk-explorer/index.html`。生成的 HTML 自带样式、脚本和快照数据，离线可用；`snapshot.json` 是同次扫描的可核对数据。浏览器刷新只重读快照，更新磁盘数据需重新执行命令。

支持目录树、面包屑/上级、按大小/名称/文件数排序、当前目录递归搜索、分页、矩形树图下钻、文件类型筛选、文件详情/路径复制及当前筛选结果 CSV 导出。页面只读，没有删除操作。文件名经 DOM 文本方式展示，导出时中和 CSV 公式前缀。

读取名称、逻辑大小及修改时间，不读取文件内容。包含隐藏目录、`.git`、依赖、构建、归档和证据；不跟随符号链接/junction 等重解析点，读取失败和跳过项在页面列出。逻辑字节数不等于磁盘分配空间；硬链接按路径分别计数。自动排除报告目录，避免把旧报告反复计入。生成页面含本机路径，仅保留本机，默认不提交或上传。

需要其他扫描位置时使用显式路径：

```powershell
python tools/disk-explorer/scan.py --root "C:\path\to\folder" --output "C:\path\to\folder\output\disk-explorer"
```

轻量检查：

```powershell
python tools/disk-explorer/check_scan.py
node --check tools/disk-explorer/app.js
```
