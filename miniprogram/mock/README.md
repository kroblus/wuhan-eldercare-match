# Mock 数据使用边界

`institutions.mock.ts` 只服务于第一批 Bootstrap 的页面壳层和流程联调，所有记录均带有
`dataProvenance: 'MOCK_DEVELOPMENT_ONLY'`，名称也显式包含“示例”或“Mock”。

这些记录不是武汉真实合作机构资料，不得用于上线、推荐结论、价格承诺、护理能力承诺或 VR 展示。
未提供的地址、价格、床位、资质、护理能力、图片和 VR 地址保持 `null`、`unknown` 或“需咨询”。
接入后端真实机构数据前，页面必须继续展示开发 Mock 标记，直到数据来源被明确替换并完成独立验收。
