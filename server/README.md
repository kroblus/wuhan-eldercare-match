# 后端占位

本目录当前仅用于声明未来后端边界，**尚未创建正式后端工程**。

计划技术基线：

- Spring Boot 3.x
- Java 21
- MySQL 8.x
- V1 默认不引入 Redis

正式创建后端前必须由主 SOL 冻结：

1. 评估答案、老人画像、机构能力和推荐结果 contract；
2. 微信登录与匿名评估的边界；
3. Elder / Assessment 历史保留规则；
4. Recommendation 与 Assessment 的绑定；
5. Appointment 的 `SUBMITTED != CONFIRMED` 状态语义；
6. 高敏感健康数据的最小采集、授权和归属校验；
7. API 契约和数据库 migration 策略。

本批禁止在此目录添加伪 Controller、伪数据接口或无法持久化的“完成版”后端。
