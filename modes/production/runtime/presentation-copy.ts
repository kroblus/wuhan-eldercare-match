const copy: readonly (readonly [string, string])[] = [
  [
    "合作机构",
    "养老机构"
  ],
  [
    "仅加载当前本地开发目录",
    "仅展示已核对的公开机构资料"
  ],
  [
    "当前本地开发目录未能读取",
    "机构公开资料暂时未能读取"
  ]
]
export const modeText = (text: string): string => copy.reduce((value, entry) => value.split(entry[0]).join(entry[1]), text)
